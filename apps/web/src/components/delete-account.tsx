'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';

export function DeleteAccount() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/v1/settings/account', 'DELETE', { password, confirmation });
      router.replace('/login?status=deletion-scheduled');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not schedule account deletion.');
    } finally {
      setBusy(false);
    }
  }

  return <details className="card mt-5 max-w-xl">
    <summary className="font-semibold cursor-pointer">Delete account</summary>
    <p className="mt-3 text-sm text-slate-600">This signs you out and schedules permanent deletion of your account, saved settings, and server jobs. Temporary files are removed before the account is deleted.</p>
    <form className="mt-4 space-y-4" onSubmit={remove}>
      <label className="block text-sm font-medium">Current password
        <input className="field mt-1" type="password" autoComplete="current-password" required disabled={busy}
          value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">Type DELETE to confirm
        <input className="field mt-1" autoComplete="off" required disabled={busy} value={confirmation}
          onChange={event => setConfirmation(event.target.value)} />
      </label>
      <button className="btn bg-red-700 hover:bg-red-800" disabled={busy || confirmation !== 'DELETE'}>Delete my account</button>
      {error && <p role="alert" className="text-sm">{error}</p>}
    </form>
  </details>;
}
