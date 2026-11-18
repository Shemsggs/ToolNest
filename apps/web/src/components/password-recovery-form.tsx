'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export function PasswordRecoveryForm({ mode, initialMessage = '' }: { mode: 'request' | 'reset'; initialMessage?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const requesting = mode === 'request';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requesting && password !== confirmation) {
      setMessage('The passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (requesting) {
        await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?flow=recovery`,
        });
        setMessage('If the address has an account, check your inbox. Open the link in this browser.');
      } else {
        await apiRequest('/api/v1/settings/password', 'PATCH', { password });
        router.replace('/dashboard');
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen grid place-items-center p-4 bg-slate-50">
    <div className="card w-full max-w-md p-8">
      <Link href="/" className="text-blue-600 font-bold text-2xl">✦ ToolNest</Link>
      <h1 className="text-2xl font-bold mt-7">{requesting ? 'Reset your password' : 'Choose a new password'}</h1>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {requesting ? <label className="block text-sm font-medium">Email
          <input className="field mt-1" type="email" autoComplete="email" required disabled={busy}
            value={email} onChange={event => setEmail(event.target.value)} />
        </label> : <>
          <label className="block text-sm font-medium">New password
            <input className="field mt-1" type="password" autoComplete="new-password" minLength={8} maxLength={72}
              required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">Confirm new password
            <input className="field mt-1" type="password" autoComplete="new-password" minLength={8} maxLength={72}
              required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          </label>
        </>}
        <button className="btn w-full" disabled={busy}>{requesting ? 'Send reset link' : 'Save password'}</button>
      </form>
      {message && <p className="mt-4 text-sm" role="status">{message}</p>}
      {!requesting && <Link href="/settings" className="block mt-4 text-sm text-blue-700 underline">Open account settings</Link>}
      <Link href={requesting ? '/login' : '/dashboard'} className="inline-block text-blue-700 underline mt-6 text-sm">
        {requesting ? 'Back to sign in' : 'Back to dashboard'}
      </Link>
    </div>
  </main>;
}
