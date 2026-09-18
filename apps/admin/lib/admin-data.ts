import { supabase } from './supabase';

export type AppointmentView = {
  id: string;
  planSessionId: string;
  branchId: string;
  cabinId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  paymentStatus: string;
  amountExpected: number;
  amountPaid: number;
  sessionNumber: number | null;
  totalSessions: number | null;
  clientName: string;
  treatmentName: string;
  branchName: string;
  cabinName: string;
};

type AppointmentRow = {
  id: string;
  plan_session_id: string;
  branch_id: string;
  cabin_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  amount_expected: number | string;
  amount_paid: number | string;
};

type SessionRow = { id: string; session_number: number; plan_id: string };
type PlanRow = { id: string; total_sessions: number; client_id: string; treatment_id: string };
type ProfileRow = { id: string; full_name: string | null };
type TreatmentRow = { id: string; name: string };
type BranchRow = { id: string; name: string };
type CabinRow = { id: string; name: string };

export async function getAppointmentViews(options: {
  branchId?: string;
  from?: string;
  to?: string;
  limit?: number;
  appointmentId?: string;
} = {}): Promise<AppointmentView[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  let query = supabase
    .from('appointments')
    .select('id, plan_session_id, branch_id, cabin_id, starts_at, ends_at, status, payment_status, amount_expected, amount_paid')
    .order('starts_at', { ascending: true });

  if (options.branchId) query = query.eq('branch_id', options.branchId);
  if (options.from) query = query.gte('starts_at', options.from);
  if (options.to) query = query.lt('starts_at', options.to);
  if (options.appointmentId) query = query.eq('id', options.appointmentId);
  query = query.limit(options.limit ?? 250);

  const { data: appointmentData, error: appointmentError } = await query;
  if (appointmentError) throw appointmentError;

  const appointments = (appointmentData ?? []) as AppointmentRow[];
  if (!appointments.length) return [];

  const unique = (items: string[]) => [...new Set(items)];
  const sessionIds = unique(appointments.map((a) => a.plan_session_id));
  const branchIds = unique(appointments.map((a) => a.branch_id));
  const cabinIds = unique(appointments.map((a) => a.cabin_id));

  const [{ data: sessionData, error: sessionError }, { data: branchData }, { data: cabinData }] = await Promise.all([
    supabase.from('treatment_plan_sessions').select('id, session_number, plan_id').in('id', sessionIds),
    supabase.from('branches').select('id, name').in('id', branchIds),
    supabase.from('cabins').select('id, name').in('id', cabinIds),
  ]);
  if (sessionError) throw sessionError;

  const sessions = (sessionData ?? []) as SessionRow[];
  const planIds = unique(sessions.map((s) => s.plan_id));
  const { data: planData, error: planError } = await supabase
    .from('client_treatment_plans')
    .select('id, total_sessions, client_id, treatment_id')
    .in('id', planIds);
  if (planError) throw planError;

  const plans = (planData ?? []) as PlanRow[];
  const clientIds = unique(plans.map((p) => p.client_id));
  const treatmentIds = unique(plans.map((p) => p.treatment_id));

  const [profilesResult, treatmentsResult] = await Promise.all([
    clientIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', clientIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    treatmentIds.length
      ? supabase.from('treatments').select('id, name').in('id', treatmentIds)
      : Promise.resolve({ data: [] as TreatmentRow[], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (treatmentsResult.error) throw treatmentsResult.error;

  const byId = <T extends { id: string }>(rows: T[] | null) =>
    new Map((rows ?? []).map((row) => [row.id, row]));

  const sessionMap = byId(sessions);
  const planMap = byId(plans);
  const profileMap = byId((profilesResult.data ?? []) as ProfileRow[]);
  const treatmentMap = byId((treatmentsResult.data ?? []) as TreatmentRow[]);
  const branchMap = byId((branchData ?? []) as BranchRow[]);
  const cabinMap = byId((cabinData ?? []) as CabinRow[]);

  return appointments.map((appointment) => {
    const session = sessionMap.get(appointment.plan_session_id);
    const plan = session ? planMap.get(session.plan_id) : undefined;
    const profile = plan ? profileMap.get(plan.client_id) : undefined;
    const treatment = plan ? treatmentMap.get(plan.treatment_id) : undefined;
    return {
      id: appointment.id,
      planSessionId: appointment.plan_session_id,
      branchId: appointment.branch_id,
      cabinId: appointment.cabin_id,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      status: appointment.status,
      paymentStatus: appointment.payment_status,
      amountExpected: Number(appointment.amount_expected ?? 0),
      amountPaid: Number(appointment.amount_paid ?? 0),
      sessionNumber: session?.session_number ?? null,
      totalSessions: plan?.total_sessions ?? null,
      clientName: profile?.full_name || 'Cliente sin nombre',
      treatmentName: treatment?.name || 'Tratamiento',
      branchName: branchMap.get(appointment.branch_id)?.name || 'Sucursal',
      cabinName: cabinMap.get(appointment.cabin_id)?.name || 'Cabina',
    };
  });
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    arrived: 'Llegó',
    completed: 'Finalizada',
    cancelled: 'Cancelada',
    no_show: 'No asistió',
  };
  return labels[status] ?? status;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}
