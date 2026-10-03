import {supabase} from './supabase';

export type BookingClient = {id:string;full_name:string;phone:string|null;email:string|null;birth_date:string|null};

type BookingClientRow = Omit<BookingClient,'birth_date'>;

/**
 * Fuente de verdad para agenda y directorio.
 * Cuando se recibe branchId, Supabase devuelve únicamente clientes vinculados
 * a esa sucursal (sucursal elegida en registro, plan o cita previa).
 */
export async function fetchBookingClients(branchId?:string|null): Promise<BookingClient[]> {
  if (!supabase) throw new Error('Falta configurar Supabase en Vercel.');
  const useBranch=Boolean(branchId);
  const {data,error} = useBranch
    ? await supabase.rpc('admin_booking_clients_for_branch',{p_branch_id:branchId})
    : await supabase.rpc('admin_booking_clients');
  if (error) {
    const detail = [error.message,error.details,error.hint].filter(Boolean).join(' · ');
    if (error.code === 'PGRST202' || /admin_booking_clients/.test(error.message) && /not find|not found/i.test(error.message)) {
      throw new Error('No está instalada la función actualizada de clientes. Ejecuta la migración más reciente de HAUT en Supabase y recarga.');
    }
    throw new Error(`No se pudo consultar el directorio (${error.code ?? 'Supabase'}): ${detail}`);
  }
  const rows=(data??[]) as BookingClientRow[];
  if(!rows.length)return [];
  const profiles=await supabase.from('profiles').select('id,birth_date').in('id',rows.map(row=>row.id));
  if(profiles.error)throw new Error(`No se pudo consultar la fecha de nacimiento de los clientes: ${profiles.error.message}`);
  const birthDates=new Map((profiles.data??[]).map(row=>[row.id,row.birth_date as string|null]));
  return rows.map(row=>({...row,birth_date:birthDates.get(row.id)??null}));
}
