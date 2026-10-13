import {createClient} from 'npm:@supabase/supabase-js@2'

const supabaseUrl=Deno.env.get('SUPABASE_URL')!
const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const mercadoPagoAccessToken=Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')||''
const webhookSecret=Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')||''
const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}})

const encoder=new TextEncoder()

function parseSignature(header:string){
  const result:{ts?:string;v1?:string}={}
  for(const part of header.split(',')){
    const [key,...rest]=part.split('=')
    const value=rest.join('=').trim()
    if(key?.trim()==='ts')result.ts=value
    if(key?.trim()==='v1')result.v1=value
  }
  return result
}

async function hmacHex(secret:string,message:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(message))
  return Array.from(new Uint8Array(signature)).map(byte=>byte.toString(16).padStart(2,'0')).join('')
}

function timingSafeEqualHex(a:string,b:string){
  if(a.length!==b.length)return false
  let diff=0
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i)
  return diff===0
}

async function validMercadoPagoSignature(req:Request,dataId:string){
  const xSignature=req.headers.get('x-signature')||''
  const xRequestId=req.headers.get('x-request-id')||''
  if(!xSignature||!xRequestId||!dataId||!webhookSecret)return false
  const {ts,v1}=parseSignature(xSignature)
  if(!ts||!v1)return false
  const manifest=`id:${dataId};request-id:${xRequestId};ts:${ts};`
  const calculated=await hmacHex(webhookSecret,manifest)
  return timingSafeEqualHex(calculated,v1)
}

type MercadoPagoOrder={
  id?:string
  external_reference?:string
  total_amount?:string|number
  status?:string
  status_detail?:string
  transactions?:{payments?:Array<{id?:string|number;status?:string;status_detail?:string}>}
}

Deno.serve(async req=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  try{
    if(!mercadoPagoAccessToken||!webhookSecret){
      console.error('Faltan MERCADOPAGO_ACCESS_TOKEN o MERCADOPAGO_WEBHOOK_SECRET')
      return new Response('Server configuration error',{status:500})
    }

    const url=new URL(req.url)
    const body=await req.json().catch(()=>null) as null|{type?:string;data?:{id?:string}}
    const type=url.searchParams.get('type')||body?.type||''
    if(type!=='order')return new Response('ok',{status:200})

    const dataId=url.searchParams.get('data.id')||body?.data?.id||''
    if(!dataId)return new Response('Missing order id',{status:400})
    if(!(await validMercadoPagoSignature(req,dataId)))return new Response('Invalid signature',{status:401})

    const orderResponse=await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`,{
      headers:{Authorization:`Bearer ${mercadoPagoAccessToken}`,Accept:'application/json'},
    })
    if(!orderResponse.ok){
      console.error('Mercado Pago order lookup failed',orderResponse.status,await orderResponse.text())
      return new Response('Could not verify order',{status:502})
    }
    const order=await orderResponse.json() as MercadoPagoOrder
    const purchaseId=order.external_reference||''
    if(!purchaseId)return new Response('Order without external_reference',{status:400})

    const {data:purchase,error:purchaseError}=await admin.from('treatment_purchases')
      .select('id,amount,status,provider,provider_order_id')
      .eq('id',purchaseId).maybeSingle()
    if(purchaseError)throw purchaseError
    if(!purchase||purchase.provider!=='mercadopago')return new Response('Purchase not found',{status:404})
    if(purchase.provider_order_id&&purchase.provider_order_id!==order.id)return new Response('Order mismatch',{status:409})

    const orderAmount=Number(order.total_amount)
    const purchaseAmount=Number(purchase.amount)
    if(!Number.isFinite(orderAmount)||Math.abs(orderAmount-purchaseAmount)>0.009){
      console.error('Mercado Pago amount mismatch',{purchaseId,orderAmount,purchaseAmount})
      return new Response('Amount mismatch',{status:409})
    }

    const payment=order.transactions?.payments?.[0]
    const providerPaymentId=payment?.id!=null?String(payment.id):null
    const providerStatus=order.status||null
    const providerStatusDetail=order.status_detail||null

    if(order.status==='processed'&&order.status_detail==='accredited'){
      const {error}=await admin.rpc('complete_treatment_purchase',{
        p_purchase_id:purchaseId,
        p_provider_order_id:order.id||dataId,
        p_provider_payment_id:providerPaymentId,
        p_provider_status:providerStatus,
        p_provider_status_detail:providerStatusDetail,
      })
      if(error)throw error
    }else if(order.status==='failed'){
      const {error}=await admin.from('treatment_purchases').update({
        status:'failed',provider_order_id:order.id||dataId,provider_payment_id:providerPaymentId,
        provider_status:providerStatus,provider_status_detail:providerStatusDetail,
      }).eq('id',purchaseId).neq('status','paid')
      if(error)throw error
    }else if(order.status==='canceled'){
      const {error}=await admin.from('treatment_purchases').update({
        status:'cancelled',provider_order_id:order.id||dataId,provider_payment_id:providerPaymentId,
        provider_status:providerStatus,provider_status_detail:providerStatusDetail,
      }).eq('id',purchaseId).neq('status','paid')
      if(error)throw error
    }else if(order.status==='refunded'||order.status_detail==='refunded'){
      const {error}=await admin.from('treatment_purchases').update({
        status:'refunded',provider_order_id:order.id||dataId,provider_payment_id:providerPaymentId,
        provider_status:providerStatus,provider_status_detail:providerStatusDetail,
      }).eq('id',purchaseId)
      if(error)throw error
    }else{
      const {error}=await admin.from('treatment_purchases').update({
        provider_order_id:order.id||dataId,provider_payment_id:providerPaymentId,
        provider_status:providerStatus,provider_status_detail:providerStatusDetail,
      }).eq('id',purchaseId)
      if(error)throw error
    }

    return new Response('ok',{status:200})
  }catch(error){
    console.error('mercadopago-treatment-webhook:',error)
    return new Response('Webhook processing failed',{status:500})
  }
})
