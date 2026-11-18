import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from './config';
export async function getSupabaseServer() {
 const cookieStore = await cookies(); const {url,key} = serverEnv();
 return createServerClient(url,key,{ cookies:{
  getAll(){return cookieStore.getAll()},
  setAll(items: Parameters<SetAllCookies>[0]){try{items.forEach(({name,value,options})=>cookieStore.set(name,value,options))}catch{/* Server components cannot set cookies; middleware refreshes tokens. */}}
 }});
}
