import {createClient} from 'npm:@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const supabaseUrl=Deno.env.get('SUPABASE_URL')!
const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}})
const REVIEW_EMAIL='apple-review@haut.com.mx'

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const reviewCode=Deno.env.get('APPLE_REVIEW_CODE')||''
    if(!reviewCode)return json({error:'La cuenta de revisión no está configurada.'},503)
    const body=await req.json().catch(()=>null) as null|{email?:string;code?:string}
    const email=(body?.email||'').trim().toLowerCase()
    const code=(body?.code||'').trim()
    if(email!==REVIEW_EMAIL||code!==reviewCode)return json({error:'Código de revisión incorrecto.'},401)

    const preferredBranchId=(Deno.env.get('APPLE_REVIEW_BRANCH_ID')||'').trim()
    let branchId:string|null=null
    if(preferredBranchId){
      const {data:preferred}=await admin.from('branches').select('id').eq('id',preferredBranchId).eq('is_active',true).maybeSingle()
      branchId=preferred?.id??null
    }
    if(!branchId){
      const {data:firstBranch,error:branchError}=await admin.from('branches').select('id').eq('is_active',true).order('name').limit(1).maybeSingle()
      if(branchError)throw branchError
      branchId=firstBranch?.id??null
    }
    if(!branchId)return json({error:'No hay una sucursal activa para preparar la cuenta de revisión.'},503)

    const {data:linkData,error:linkError}=await admin.auth.admin.generateLink({type:'magiclink',email:REVIEW_EMAIL})
    if(linkError)throw linkError
    const user=linkData.user
    const tokenHash=linkData.properties?.hashed_token
    if(!user||!tokenHash)return json({error:'No pudimos preparar la sesión de revisión.'},500)

    const {error:profileError}=await admin.from('profiles').upsert({
      id:user.id,
      full_name:'Apple Review',
      phone:'4420000000',
      birth_date:'1990-01-01',
      preferred_branch_id:branchId,
    },{onConflict:'id'})
    if(profileError)throw profileError

    return json({ok:true,token_hash:tokenHash})
  }catch(error){
    console.error('apple-review-login:',error)
    return json({error:error instanceof Error?error.message:'No se pudo iniciar la cuenta de revisión.'},500)
  }
})
