import {supabase} from './supabase';

export type BookingClient = {id:string;full_name:string;phone:string|null;email:string|null};

/** Fuente de verdad única para agenda y directorio; el servidor aplica alcance por rol. */
export async function fetchBookingClients(): Promise<BookingClient[]> {
  if (!supabase) throw new Error('Falta configurar Supabase en Vercel.');
  const {data,error} = await supabase.rpc('admin_booking_clients');
  if (error) {
    const detail = [error.message,error.details,error.hint].filter(Boolean).join(' · ');
    if (error.code === 'PGRST202' || /admin_booking_clients/.test(error.message) && /not find|not found/i.test(error.message)) {
      throw new Error('No está instalada la función de clientes. Ejecuta la migración 20260920150000_client_directory_and_catalog_editor.sql en Supabase y recarga.');
    }
    throw new Error(`No se pudo consultar el directorio (${error.code ?? 'Supabase'}): ${detail}`);
  }
  return (data ?? []) as BookingClient[];
}
