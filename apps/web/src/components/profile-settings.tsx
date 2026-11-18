'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';

export function ProfileSettings({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const result = await apiRequest<{ displayName: string }>('/api/v1/settings', 'PATCH', { displayName });
      setDisplayName(result.displayName);
      setStatus('Profile saved.');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="card mt-5 max-w-xl space-y-4" onSubmit={save}>
    <h2 className="text-lg font-semibold">Profile</h2>
    <label className="block text-sm font-medium">Display name
      <input className="field mt-1" autoComplete="nickname" maxLength={100} value={displayName} disabled={busy}
        onChange={event => setDisplayName(event.target.value)} />
    </label>
    <button className="btn" disabled={busy}>Save profile</button>
    {status && <p role="status" className="text-sm">{status}</p>}
  </form>;
}
