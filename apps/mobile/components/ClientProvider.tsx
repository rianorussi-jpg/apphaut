'use client';
import {createContext,useContext,useEffect,useState,useCallback,useRef} from 'react';
import type {Session as AuthSession} from '@supabase/supabase-js';
import {usePathname,useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {loadClientData} from '@/lib/client-data';
import type {ClientData} from '@/lib/types';
import {AuthScreen} from './auth-screen';

type Context = {session:AuthSession; data:ClientData|null; loading:boolean; error:string; refresh:()=>Promise<void>; signOut:()=>Promise<void>};
const ClientContext=createContext<Context|null>(null);
export function useClient(){const ctx=useContext(ClientContext);if(!ctx)throw new Error('ClientProvider missing');return ctx;}
export function ClientProvider({children}:{children:React.ReactNode}){
  const [session,setSession]=useState<AuthSession|null>(null);
  const currentUserId=useRef<string|null>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [data,setData]=useState<ClientData|null>(null);
  const [dataLoading,setDataLoading]=useState(false);
  const [error,setError]=useState('');
  const pathname=usePathname();const router=useRouter();
  useEffect(()=>{
    if(!supabase){setError('Configura las variables NEXT_PUBLIC_SUPABASE_* en Vercel.');setAuthLoading(false);return;}
    let alive=true;
    supabase.auth.getSession().then(({data:result,error:e})=>{if(alive){currentUserId.current=result.session?.user.id??null;setSession(result.session);setError(e?.message??'');setAuthLoading(false);}}).catch((e:unknown)=>{if(alive){setError(e instanceof Error?e.message:'No pudimos comprobar tu sesión.');setAuthLoading(false);}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,newSession)=>{if(alive){const id=newSession?.user.id??null;if(currentUserId.current!==id){setData(null);currentUserId.current=id;}setSession(newSession);setAuthLoading(false);if(!newSession)setData(null);}});
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);
  const refresh=useCallback(async()=>{
    if(!session?.user.id)return;
    const requestedUserId=session.user.id;
    setDataLoading(true);setError('');
    try {const fresh=await loadClientData(requestedUserId);if(currentUserId.current===requestedUserId)setData(fresh);}catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar los datos.');}
    finally{setDataLoading(false);}
  },[session?.user.id]);
  useEffect(()=>{if(session?.user.id){void refresh();}},[session?.user.id,refresh]);
  useEffect(()=>{
    if(!session?.user.id)return;
    const onFocus=()=>{void refresh();};
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible);};
  },[session?.user.id,refresh]);
  useEffect(()=>{if(session && (pathname==='/acceso'||pathname==='/registro'))router.replace('/');},[session,pathname,router]);
  async function signOut(){if(supabase)await supabase.auth.signOut();setData(null);router.replace('/acceso');}
  if(authLoading)return <div className="auth-wrap"><div className="auth-card"><p className="brand-kicker">HAUT CLINICAL</p><p>Comprobando tu sesión…</p></div></div>;
  if(!session)return <AuthScreen key={pathname} defaultMode={pathname==='/registro'?'register':'login'} error={error}/>;
  if(dataLoading && !data)return <div className="auth-wrap"><div className="auth-card"><p className="brand-kicker">HAUT CLINICAL</p><p>Cargando tu información…</p></div></div>;
  if(error&&!data)return <div className="auth-wrap"><div className="auth-card"><h2>No pudimos cargar tu cuenta</h2><p role="alert">{error}</p><button className="primary-button" onClick={()=>void refresh()}>Reintentar</button><button className="secondary-button" onClick={()=>void signOut()}>Cerrar sesión</button></div></div>;
  return <ClientContext.Provider value={{session,data,loading:dataLoading,error,refresh,signOut}}>{children}</ClientContext.Provider>;
}
