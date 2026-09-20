'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';

const WIDTH=1200,HEIGHT=675;
const clamp=(v:number)=>Math.max(0,Math.min(100,v));
type Dimensions={width:number;height:number};
type Drag={x:number;y:number;panX:number;panY:number;frameWidth:number;frameHeight:number};
export type PromotionImageCropperHandle={toBlob:()=>Promise<Blob>};

export const PromotionImageCropper=forwardRef<PromotionImageCropperHandle,{
  src:string;onAdjusted:()=>void;
}>(function PromotionImageCropper({src,onAdjusted},ref){
  const image=useRef<HTMLImageElement|null>(null);
  const frame=useRef<HTMLDivElement|null>(null);
  const drag=useRef<Drag|null>(null);
  const [dimensions,setDimensions]=useState<Dimensions|null>(null);
  const [zoom,setZoom]=useState(1);
  const [panX,setPanX]=useState(50);
  const [panY,setPanY]=useState(50);
  useEffect(()=>{setDimensions(null);setZoom(1);setPanX(50);setPanY(50);},[src]);
  function geometry(){
    if(!dimensions)return null;
    const cover=Math.max(WIDTH/dimensions.width,HEIGHT/dimensions.height);
    const width=dimensions.width*cover*zoom;
    const height=dimensions.height*cover*zoom;
    const extraX=Math.max(0,width-WIDTH);
    const extraY=Math.max(0,height-HEIGHT);
    return {width,height,extraX,extraY,left:-extraX*(panX/100),top:-extraY*(panY/100)};
  }
  const g=geometry();
  useImperativeHandle(ref,()=>({toBlob:async()=>{
    const img=image.current;
    const box=geometry();
    if(!img||!img.complete||!img.naturalWidth||!box)throw new Error('Espera a que termine de cargar la fotografía.');
    const canvas=document.createElement('canvas');
    canvas.width=WIDTH;canvas.height=HEIGHT;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Tu navegador no permite preparar el recorte de esta imagen.');
    try{ctx.drawImage(img,box.left,box.top,box.width,box.height);}
    catch{throw new Error('No pudimos procesar la imagen. Selecciona la fotografía desde tu computadora.');}
    return new Promise<Blob>((resolve,reject)=>{
      try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No fue posible exportar la fotografía. Si es una URL externa, selecciona el archivo desde tu computadora.')),'image/webp',0.9);}
      catch{reject(new Error('Para ajustar esta imagen, vuelve a seleccionarla desde tu computadora.'));}
    });
  }}));
  function onPointerDown(e:ReactPointerEvent<HTMLDivElement>){
    if(!g||!frame.current)return;
    const rect=frame.current.getBoundingClientRect();
    drag.current={x:e.clientX,y:e.clientY,panX,panY,frameWidth:rect.width,frameHeight:rect.height};
    frame.current.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e:ReactPointerEvent<HTMLDivElement>){
    const initial=drag.current;if(!initial||!g)return;
    if(g.extraX>0)setPanX(clamp(initial.panX-(e.clientX-initial.x)/initial.frameWidth*WIDTH/g.extraX*100));
    if(g.extraY>0)setPanY(clamp(initial.panY-(e.clientY-initial.y)/initial.frameHeight*HEIGHT/g.extraY*100));
    onAdjusted();
  }
  function release(e:ReactPointerEvent<HTMLDivElement>){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  return <div className="haut-image-cropper">
    <div className="haut-crop-top"><strong>Vista previa exacta del banner</strong><span>16:9 · 1200 × 675 px</span></div>
    <div className="haut-crop-frame" ref={frame} role="img" aria-label="Encuadre de la promoción tal como se mostrará en Inicio. Puedes arrastrar la fotografía para ajustarla." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={release} onPointerCancel={release}>
      {src?<img ref={image} key={src} src={src} alt="" crossOrigin="anonymous" draggable={false} onLoad={e=>setDimensions({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} onError={()=>setDimensions(null)} style={g?{width:`${g.width/WIDTH*100}%`,height:`${g.height/HEIGHT*100}%`,left:`${g.left/WIDTH*100}%`,top:`${g.top/HEIGHT*100}%`}:undefined}/>:<div className="haut-crop-placeholder">Selecciona una imagen para ver cómo se verá en Inicio</div>}
      <div className="haut-crop-guide" aria-hidden="true"/>
    </div>
    <p className="haut-crop-help">Arrastra la fotografía dentro del cuadro. El espacio visible será exactamente la imagen del carrusel, sin textos ni filtros encima.</p>
    <label className="haut-crop-control">Zoom <strong>{zoom.toFixed(2)}×</strong><input aria-label="Zoom de la imagen" type="range" min="1" max="3" step="0.05" value={zoom} disabled={!dimensions} onChange={e=>{setZoom(Number(e.target.value));onAdjusted();}}/></label>
    <div className="haut-crop-pos-controls"><label>Posición horizontal<input aria-label="Posición horizontal" type="range" min="0" max="100" value={panX} disabled={!dimensions||!g?.extraX} onChange={e=>{setPanX(Number(e.target.value));onAdjusted();}}/></label><label>Posición vertical<input aria-label="Posición vertical" type="range" min="0" max="100" value={panY} disabled={!dimensions||!g?.extraY} onChange={e=>{setPanY(Number(e.target.value));onAdjusted();}}/></label></div>
    <button type="button" className="secondary-button haut-crop-reset" onClick={()=>{setZoom(1);setPanX(50);setPanY(50);onAdjusted();}} disabled={!dimensions}>Restablecer encuadre</button>
  </div>;
});
