import {createClient} from 'npm:@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const supabaseUrl=Deno.env.get('SUPABASE_URL')!
const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const mercadoPagoAccessToken=Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')||''
const clientAppUrl=(Deno.env.get('CLIENT_APP_URL')||'').replace(/\/$/,'')
const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}})

type MercadoPagoOrderResponse={
  id?:string
  checkout_url?:string
  status?:string
  status_detail?:string
  message?:string
  error?:string
  details?:Array<{description?:string}>
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    if(!mercadoPagoAccessToken)return json({error:'Falta configurar MERCADOPAGO_ACCESS_TOKEN en Supabase.'},500)
    if(!clientAppUrl)return json({error:'Falta configurar CLIENT_APP_URL en Supabase.'},500)

    const authHeader=req.headers.get('Authorization')||''
    const token=authHeader.replace(/^Bearer\s+/i,'').trim()
    if(!token)return json({error:'Inicia sesión para comprar este tratamiento.'},401)
    const {data:userResult,error:userError}=await admin.auth.getUser(token)
    const user=userResult.user
    if(userError||!user?.email)return json({error:'Tu sesión ya no es válida.'},401)

    const body=await req.json().catch(()=>null) as null|{treatment_id?:string}
    const treatmentId=body?.treatment_id?.trim()||''
    if(!treatmentId)return json({error:'Tratamiento no válido.'},400)

    const {data:t,error:tError}=await admin.from('treatments')
      .select('id,name,image_url,base_price,is_active,is_sold_in_app,purchase_session_count,purchase_duration_minutes')
      .eq('id',treatmentId).maybeSingle()
    if(tError)throw tError
    if(!t?.is_active||!t.is_sold_in_app)return json({error:'Este tratamiento no está disponible para compra en la app.'},400)
    if(Number(t.base_price)<=0||!t.purchase_session_count||!t.purchase_duration_minutes){
      return json({error:'HAUT aún no ha terminado de configurar la venta de este tratamiento.'},400)
    }

    const {data:existing,error:existingError}=await admin.from('client_treatment_plans')
      .select('id').eq('client_id',user.id).eq('treatment_id',treatmentId).in('status',['active','paused']).limit(1)
    if(existingError)throw existingError
    if(existing?.length)return json({error:'Este tratamiento ya forma parte de tus tratamientos activos.'},409)

    const {data:pending,error:pendingError}=await admin.from('treatment_purchases')
      .select('id,provider_checkout_url').eq('user_id',user.id).eq('treatment_id',treatmentId).eq('status','pending')
      .order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(pendingError)throw pendingError
    if(pending?.provider_checkout_url)return json({ok:true,url:pending.provider_checkout_url,reused:true})
    if(pending?.id)return json({error:'Ya hay una compra de este tratamiento preparándose. Intenta de nuevo en unos segundos.'},409)

    const amount=Number(t.base_price)
    const amountText=amount.toFixed(2)
    const {data:purchase,error:purchaseError}=await admin.from('treatment_purchases').insert({
      user_id:user.id,
      treatment_id:treatmentId,
      amount,
      currency:'mxn',
      provider:'mercadopago',
      status:'pending',
    }).select('id').single()
    if(purchaseError||!purchase)throw purchaseError??new Error('No se pudo preparar la compra.')

    const detailUrl=`${clientAppUrl}/tratamientos/${encodeURIComponent(treatmentId)}`
    const item={
      external_code:t.id,
      title:t.name,
      description:`${t.purchase_session_count} ${t.purchase_session_count===1?'sesión':'sesiones'} · ${t.purchase_duration_minutes} min por sesión`,
      quantity:1,
      unit_price:amountText,
      total_amount:amountText,
      unit_measure:'unit',
      ...(t.image_url?.startsWith('https://')?{picture_url:t.image_url}:{}),
    }

    const mercadoPagoResponse=await fetch('https://api.mercadopago.com/v1/orders',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${mercadoPagoAccessToken}`,
        'Content-Type':'application/json',
        Accept:'application/json',
        'X-Idempotency-Key':purchase.id,
      },
      body:JSON.stringify({
        type:'online',
        processing_mode:'manual',
        total_amount:amountText,
        external_reference:purchase.id,
        description:`HAUT · ${t.name}`,
        payer:{email:user.email},
        config:{online:{
          success_url:`${detailUrl}?compra=exitosa`,
          failure_url:`${detailUrl}?compra=fallida`,
          pending_url:`${detailUrl}?compra=pendiente`,
          auto_return:'all',
        }},
        items:[item],
      }),
    })
    const mercadoPagoData=await mercadoPagoResponse.json() as MercadoPagoOrderResponse
    if(!mercadoPagoResponse.ok||!mercadoPagoData.id||!mercadoPagoData.checkout_url){
      await admin.from('treatment_purchases').update({
        status:'failed',
        provider_status:mercadoPagoData.status||'create_order_failed',
        provider_status_detail:mercadoPagoData.status_detail||mercadoPagoData.error||mercadoPagoData.message||null,
      }).eq('id',purchase.id)
      const detail=mercadoPagoData.details?.map(x=>x.description).filter(Boolean).join(' · ')
      return json({error:detail||mercadoPagoData.message||'Mercado Pago no pudo iniciar el pago.'},502)
    }

    const {error:updateError}=await admin.from('treatment_purchases').update({
      provider_order_id:mercadoPagoData.id,
      provider_checkout_url:mercadoPagoData.checkout_url,
      provider_status:mercadoPagoData.status||'created',
      provider_status_detail:mercadoPagoData.status_detail||'created',
    }).eq('id',purchase.id)
    if(updateError)throw updateError

    return json({ok:true,url:mercadoPagoData.checkout_url})
  }catch(error){
    console.error('create-treatment-checkout:',error)
    return json({error:error instanceof Error?error.message:'No se pudo iniciar la compra.'},500)
  }
})
