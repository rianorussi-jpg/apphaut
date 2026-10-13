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

const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)

  try{
    const authHeader=req.headers.get('Authorization')||''
    const token=authHeader.replace(/^Bearer\s+/i,'').trim()
    if(!token)return json({error:'Sesión administrativa no encontrada.'},401)

    const {data:userResult,error:userError}=await admin.auth.getUser(token)
    const actor=userResult.user
    if(userError||!actor)return json({error:'Tu sesión administrativa ya no es válida.'},401)

    const {data:roleRow,error:roleError}=await admin.from('user_roles').select('role').eq('user_id',actor.id).maybeSingle()
    if(roleError)throw roleError
    if(!roleRow||!['superadmin','branch_admin','reception'].includes(roleRow.role))return json({error:'No tienes permiso para crear clientes.'},403)

    const body=await req.json().catch(()=>null) as null|{email?:string;full_name?:string;phone?:string;birth_date?:string;branch_id?:string}
    const email=body?.email?.trim().toLowerCase()||''
    const fullName=body?.full_name?.trim()||''
    const phone=body?.phone?.trim()||''
    const birthDate=body?.birth_date?.trim()||''
    const branchId=body?.branch_id?.trim()||''

    if(!EMAIL_RE.test(email))return json({error:'Escribe un correo válido.'},400)
    if(fullName.length<2)return json({error:'Escribe el nombre completo.'},400)
    if(phone.replace(/\D/g,'').length<10)return json({error:'Escribe un número de teléfono válido.'},400)
    if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))return json({error:'La fecha de nacimiento no es válida.'},400)
    const birth=new Date(`${birthDate}T12:00:00Z`)
    if(Number.isNaN(birth.getTime())||birth.getTime()>Date.now())return json({error:'La fecha de nacimiento no es válida.'},400)
    if(!UUID_RE.test(branchId))return json({error:'Selecciona una sucursal válida.'},400)

    const {data:branch,error:branchError}=await admin.from('branches').select('id,name,is_active').eq('id',branchId).maybeSingle()
    if(branchError)throw branchError
    if(!branch?.is_active)return json({error:'La sucursal seleccionada no está disponible.'},400)

    if(roleRow.role!=='superadmin'){
      const {data:access,error:accessError}=await admin.from('user_branch_access').select('branch_id').eq('user_id',actor.id).eq('branch_id',branchId).maybeSingle()
      if(accessError)throw accessError
      if(!access)return json({error:'No tienes acceso a la sucursal seleccionada.'},403)
    }

    const {data:created,error:createError}=await admin.auth.admin.createUser({
      email,
      email_confirm:true,
      user_metadata:{full_name:fullName,phone,preferred_branch_id:branchId,birth_date:birthDate},
    })
    if(createError){
      const message=/already|registered|exists/i.test(createError.message)
        ?'Ya existe una cuenta con ese correo. Búscala en el directorio antes de crear otra.'
        :createError.message
      return json({error:message},409)
    }
    const client=created.user
    if(!client)return json({error:'Supabase no devolvió el usuario creado.'},500)

    let rollback=true
    try{
      const {error:profileError}=await admin.from('profiles').upsert({
        id:client.id,
        full_name:fullName,
        phone,
        birth_date:birthDate,
        preferred_branch_id:branchId,
      },{onConflict:'id'})
      if(profileError)throw profileError

      const {error:jobError}=await admin.from('notification_jobs').insert({
        user_id:client.id,
        channel:'email',
        template_key:'client_registered',
        payload:{source:'admin',branch_id:branchId},
        scheduled_at:new Date().toISOString(),
        status:'queued',
      })
      if(jobError)throw jobError

      rollback=false
      const {error:auditError}=await admin.from('audit_logs').insert({
        actor_user_id:actor.id,
        action:'client_created',
        entity_type:'profile',
        entity_id:client.id,
        new_data:{email,full_name:fullName,phone,birth_date:birthDate,preferred_branch_id:branchId,source:'admin'},
      })
      if(auditError)console.error('audit_logs:',auditError)

      return json({ok:true,client:{id:client.id,full_name:fullName,email,phone,branch_id:branchId}})
    }catch(error){
      if(rollback)await admin.auth.admin.deleteUser(client.id).catch(()=>undefined)
      throw error
    }
  }catch(error){
    console.error('admin-create-client:',error)
    return json({error:error instanceof Error?error.message:'No se pudo crear el cliente.'},500)
  }
})
