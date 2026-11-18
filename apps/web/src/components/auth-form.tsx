'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
export function AuthForm({mode,initialMessage=''}:{mode:'login'|'register';initialMessage?:string}){
 const router=useRouter(); const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState(initialMessage);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{
 const client=getSupabaseBrowser();
 if(mode==='register') {const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/auth/callback`}}); if(error)throw error;setMessage('Check your email for a confirmation link, then sign in.');}
 else {const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;router.push('/dashboard');router.refresh();}
 }catch(e){setMessage(e instanceof Error?e.message:'Authentication failed');}finally{setBusy(false)}}
 return <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50"><div className="card w-full max-w-md p-8"><Link href="/" className="text-blue-600 font-bold text-2xl">✦ ToolNest</Link><h1 className="text-2xl font-bold mt-7">{mode==='login'?'Welcome back':'Create your account'}</h1><p className="text-slate-500 mt-1 text-sm">{mode==='login'?'Sign in to access your tools.':'A free account is required to use ToolNest.'}</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium">Email<input className="field mt-1" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block text-sm font-medium">Password<input className="field mt-1" type="password" minLength={8} autoComplete={mode==='login'?'current-password':'new-password'} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="btn w-full">{busy?'Please wait...':mode==='login'?'Sign in':'Create account'}</button></form>{mode==='login'&&<Link href="/forgot-password" className="inline-block mt-4 text-sm text-blue-700 underline">Forgot password?</Link>}{message&&<p role="status" className="mt-4 text-sm text-slate-700 bg-blue-50 p-3 rounded-lg">{message}</p>}<p className="mt-6 text-sm text-slate-600">{mode==='login'?<>New here? <Link className="text-blue-600 font-semibold" href="/register">Register</Link></>:<>Already have an account? <Link className="text-blue-600 font-semibold" href="/login">Sign in</Link></>}</p></div></div>
}
