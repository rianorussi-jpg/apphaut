import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@7'

type NotificationJob = {
  id: string
  user_id: string
  appointment_id: string | null
  plan_id: string | null
  template_key: 'treatment_assigned' | 'appointment_created' | 'appointment_reminder_24h' | string
  attempts: number
}

type EmailMessage = {
  subject: string
  html: string
  text: string
}

const env = (name: string, fallback?: string) => {
  const value = Deno.env.get(name) ?? fallback
  if (!value) throw new Error(`Falta el secret ${name}`)
  return value
}

const supabaseUrl = env('SUPABASE_URL')
const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
const workerSecret = env('EMAIL_WORKER_SECRET')
const clientAppUrl = (Deno.env.get('CLIENT_APP_URL') || '').replace(/\/$/, '')

const smtpHost = env('SMTP_HOSTNAME')
const smtpPort = Number(env('SMTP_PORT', '465'))
const smtpSecure = env('SMTP_SECURE', 'true').toLowerCase() !== 'false'
const smtpUsername = env('SMTP_USERNAME')
const smtpPassword = env('SMTP_PASSWORD')
const smtpFrom = env('SMTP_FROM')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUsername,
    pass: smtpPassword,
  },
})

const esc = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const formatDate = (iso: string, timezone: string) => new Intl.DateTimeFormat('es-MX', {
  timeZone: timezone,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(iso))

const formatTime = (iso: string, timezone: string) => new Intl.DateTimeFormat('es-MX', {
  timeZone: timezone,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}).format(new Date(iso))

const button = (label: string, href: string) => href
  ? `<a href="${esc(href)}" style="display:inline-block;background:#86602A;color:#fff;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:700;margin-top:18px">${esc(label)}</a>`
  : ''

const frame = (preheader: string, body: string) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FDFBF7;font-family:Arial,Helvetica,sans-serif;color:#25211B">
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FDFBF7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #EADFC9;border-radius:22px;overflow:hidden">
<tr><td style="padding:30px 32px 12px"><div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#86602A;font-weight:700">HAUT Clinical Center</div></td></tr>
<tr><td style="padding:8px 32px 34px">${body}</td></tr>
</table>
<div style="max-width:600px;padding:16px 24px;color:#756C5E;font-size:12px;line-height:1.5">Este es un mensaje automático de HAUT Clinical Center. Si necesitas ayuda, comunícate directamente con tu sucursal.</div>
</td></tr></table></body></html>`

async function getRecipient(userId: string) {
  const [{ data: authData, error: authError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
  ])

  if (authError) throw authError
  if (profileError) throw profileError
  const email = authData.user?.email
  if (!email) throw new Error('El cliente no tiene correo electrónico en Supabase Auth.')

  return {
    email,
    name: profile?.full_name?.trim() || 'Hola',
  }
}

async function treatmentAssigned(job: NotificationJob): Promise<EmailMessage | null> {
  if (!job.plan_id) throw new Error('El job no tiene plan_id.')

  const { data: plan, error: planError } = await supabase
    .from('client_treatment_plans')
    .select('id, client_id, treatment_id, default_branch_id, total_sessions, status')
    .eq('id', job.plan_id)
    .maybeSingle()

  if (planError) throw planError
  if (!plan || plan.status === 'cancelled') return null

  const [{ data: treatment, error: treatmentError }, { data: branch, error: branchError }] = await Promise.all([
    supabase.from('treatments').select('name').eq('id', plan.treatment_id).maybeSingle(),
    plan.default_branch_id
      ? supabase.from('branches').select('name').eq('id', plan.default_branch_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (treatmentError) throw treatmentError
  if (branchError) throw branchError

  const recipient = await getRecipient(plan.client_id)
  const treatmentName = treatment?.name || 'Tu tratamiento'
  const planUrl = clientAppUrl ? `${clientAppUrl}/mis-tratamientos/${plan.id}` : ''
  const branchLine = branch?.name ? `<p style="margin:8px 0;color:#756C5E"><strong style="color:#25211B">Sucursal:</strong> ${esc(branch.name)}</p>` : ''

  const body = `
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.12;margin:8px 0 18px;font-weight:500">Tu tratamiento ya está en HAUT.</h1>
    <p style="font-size:16px;line-height:1.7;margin:0 0 20px">Hola ${esc(recipient.name)}, agregamos <strong>${esc(treatmentName)}</strong> a tu cuenta.</p>
    <div style="background:#FBF5E8;border:1px solid #EADFC9;border-radius:16px;padding:18px 20px;margin:18px 0">
      <p style="margin:0 0 8px"><strong>${esc(treatmentName)}</strong></p>
      <p style="margin:8px 0;color:#756C5E"><strong style="color:#25211B">Sesiones:</strong> ${esc(plan.total_sessions)}</p>
      ${branchLine}
    </div>
    <p style="font-size:14px;line-height:1.6;color:#756C5E">Puedes consultar tu progreso y próximas sesiones desde tu cuenta HAUT.</p>
    ${button('Ver mi tratamiento', planUrl)}
  `

  return {
    subject: `Tu tratamiento en HAUT: ${treatmentName}`,
    html: frame(`Tu tratamiento ${treatmentName} ya está disponible.`, body),
    text: `Hola ${recipient.name}. Agregamos ${treatmentName} a tu cuenta HAUT. Sesiones: ${plan.total_sessions}${branch?.name ? `. Sucursal: ${branch.name}` : ''}.${planUrl ? ` Ver tratamiento: ${planUrl}` : ''}`,
  }
}

async function appointmentEmail(job: NotificationJob, reminder: boolean): Promise<EmailMessage | null> {
  if (!job.appointment_id) throw new Error('El job no tiene appointment_id.')

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, plan_session_id, branch_id, starts_at, status')
    .eq('id', job.appointment_id)
    .maybeSingle()

  if (appointmentError) throw appointmentError
  if (!appointment || ['cancelled', 'completed', 'no_show'].includes(appointment.status)) return null

  const { data: session, error: sessionError } = await supabase
    .from('treatment_plan_sessions')
    .select('session_number, plan_id')
    .eq('id', appointment.plan_session_id)
    .maybeSingle()
  if (sessionError) throw sessionError
  if (!session) return null

  const { data: plan, error: planError } = await supabase
    .from('client_treatment_plans')
    .select('client_id, treatment_id, total_sessions')
    .eq('id', session.plan_id)
    .maybeSingle()
  if (planError) throw planError
  if (!plan) return null

  const [{ data: treatment, error: treatmentError }, { data: branch, error: branchError }, recipient] = await Promise.all([
    supabase.from('treatments').select('name').eq('id', plan.treatment_id).maybeSingle(),
    supabase.from('branches').select('name, timezone').eq('id', appointment.branch_id).maybeSingle(),
    getRecipient(plan.client_id),
  ])
  if (treatmentError) throw treatmentError
  if (branchError) throw branchError

  const timezone = branch?.timezone || 'America/Mexico_City'
  const treatmentName = treatment?.name || 'Tratamiento HAUT'
  const date = formatDate(appointment.starts_at, timezone)
  const time = formatTime(appointment.starts_at, timezone)
  const appointmentUrl = clientAppUrl ? `${clientAppUrl}/mis-citas/${appointment.id}` : ''
  const title = reminder ? 'Te esperamos mañana en HAUT.' : 'Tu cita en HAUT está confirmada.'
  const intro = reminder
    ? `Hola ${esc(recipient.name)}, te recordamos que mañana tienes una cita con nosotros.`
    : `Hola ${esc(recipient.name)}, tu próxima cita ha sido programada.`

  const body = `
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.12;margin:8px 0 18px;font-weight:500">${title}</h1>
    <p style="font-size:16px;line-height:1.7;margin:0 0 20px">${intro}</p>
    <div style="background:#FBF5E8;border:1px solid #EADFC9;border-radius:16px;padding:18px 20px;margin:18px 0">
      <p style="margin:0 0 10px"><strong>${esc(treatmentName)}</strong></p>
      <p style="margin:8px 0;color:#756C5E"><strong style="color:#25211B">Sesión:</strong> ${esc(session.session_number)} de ${esc(plan.total_sessions)}</p>
      <p style="margin:8px 0;color:#756C5E"><strong style="color:#25211B">Fecha:</strong> ${esc(date)}</p>
      <p style="margin:8px 0;color:#756C5E"><strong style="color:#25211B">Hora:</strong> ${esc(time)}</p>
      <p style="margin:8px 0;color:#756C5E"><strong style="color:#25211B">Sucursal:</strong> ${esc(branch?.name || 'HAUT')}</p>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#756C5E">La cabina se asigna internamente y no necesitas realizar ninguna acción adicional.</p>
    ${button('Ver mi cita', appointmentUrl)}
  `

  return {
    subject: reminder ? 'Te esperamos mañana en HAUT' : 'Tu cita en HAUT está confirmada',
    html: frame(reminder ? `Recordatorio de tu cita de mañana a las ${time}.` : `Tu cita quedó programada para ${date} a las ${time}.`, body),
    text: `${reminder ? 'Recordatorio' : 'Cita confirmada'}: ${treatmentName}, sesión ${session.session_number} de ${plan.total_sessions}, ${date}, ${time}, ${branch?.name || 'HAUT'}.${appointmentUrl ? ` Ver cita: ${appointmentUrl}` : ''}`,
  }
}

async function renderJob(job: NotificationJob): Promise<EmailMessage | null> {
  switch (job.template_key) {
    case 'treatment_assigned':
      return treatmentAssigned(job)
    case 'appointment_created':
      return appointmentEmail(job, false)
    case 'appointment_reminder_24h':
      return appointmentEmail(job, true)
    default:
      throw new Error(`Template no soportado: ${job.template_key}`)
  }
}

async function markCancelled(job: NotificationJob, reason: string) {
  await supabase.from('notification_jobs').update({
    status: 'cancelled',
    last_error: reason,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id)
}

async function markSent(job: NotificationJob) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('notification_jobs').update({
    status: 'sent',
    sent_at: now,
    last_error: null,
    updated_at: now,
  }).eq('id', job.id)
  if (error) throw error
}

async function markFailed(job: NotificationJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const finalFailure = (job.attempts || 1) >= 5
  const delayMinutes = Math.min(60, Math.max(5, (job.attempts || 1) * 5))
  const retryAt = new Date(Date.now() + delayMinutes * 60_000).toISOString()

  await supabase.from('notification_jobs').update({
    status: finalFailure ? 'failed' : 'queued',
    scheduled_at: finalFailure ? undefined : retryAt,
    last_error: message.slice(0, 1000),
    updated_at: new Date().toISOString(),
  }).eq('id', job.id)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const providedSecret = req.headers.get('x-haut-worker-secret')
  if (!providedSecret || providedSecret !== workerSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: jobs, error: claimError } = await supabase.rpc('claim_due_email_jobs', { p_limit: 25 })
  if (claimError) {
    console.error('claim_due_email_jobs:', claimError)
    return Response.json({ error: claimError.message }, { status: 500 })
  }

  let sent = 0
  let cancelled = 0
  let failed = 0

  for (const rawJob of (jobs || []) as NotificationJob[]) {
    try {
      const message = await renderJob(rawJob)
      if (!message) {
        await markCancelled(rawJob, 'El evento ya no requiere correo.')
        cancelled += 1
        continue
      }

      const recipient = await getRecipient(rawJob.user_id)
      await transporter.sendMail({
        from: smtpFrom,
        to: recipient.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })
      await markSent(rawJob)
      sent += 1
    } catch (error) {
      console.error(`Job ${rawJob.id}:`, error)
      await markFailed(rawJob, error)
      failed += 1
    }
  }

  return Response.json({
    ok: true,
    processed: (jobs || []).length,
    sent,
    cancelled,
    failed,
  })
})
