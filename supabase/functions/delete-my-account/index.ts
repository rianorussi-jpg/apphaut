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

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const authHeader=req.headers.get('Authorization')||''
    const token=authHeader.replace(/^Bearer\s+/i,'').trim()
    if(!token)return json({error:'Sesión no encontrada.'},401)
    const {data:userResult,error:userError}=await admin.auth.getUser(token)
    const user=userResult.user
    if(userError||!user)return json({error:'Tu sesión ya no es válida.'},401)

    const body=await req.json().catch(()=>null) as null|{confirm?:boolean}
    if(body?.confirm!==true)return json({error:'Debes confirmar la eliminación.'},400)

    const userId=user.id
    const {error:purchaseError}=await admin.from('treatment_purchase_requests').delete().eq('user_id',userId)
    if(purchaseError)throw purchaseError
    const {error:notesError}=await admin.from('client_notes').delete().eq('client_id',userId)
    if(notesError)throw notesError

    const {data:plans,error:plansError}=await admin.from('client_treatment_plans').select('id').eq('client_id',userId)
    if(plansError)throw plansError
    const planIds=(plans??[]).map(row=>row.id)
    if(planIds.length){
      const {data:sessions,error:sessionsReadError}=await admin.from('treatment_plan_sessions').select('id').in('plan_id',planIds)
      if(sessionsReadError)throw sessionsReadError
      const sessionIds=(sessions??[]).map(row=>row.id)
      if(sessionIds.length){
        const {error:appointmentsError}=await admin.from('appointments').delete().in('plan_session_id',sessionIds)
        if(appointmentsError)throw appointmentsError
      }
      const {error:sessionsError}=await admin.from('treatment_plan_sessions').delete().in('plan_id',planIds)
      if(sessionsError)throw sessionsError
      const {error:planDeleteError}=await admin.from('client_treatment_plans').delete().in('id',planIds)
      if(planDeleteError)throw planDeleteError
    }

    const {error:deleteError}=await admin.auth.admin.deleteUser(userId)
    if(deleteError)throw deleteError
    return json({ok:true})
  }catch(error){
    console.error('delete-my-account:',error)
    return json({error:error instanceof Error?error.message:'No se pudo eliminar la cuenta.'},500)
  }
})
