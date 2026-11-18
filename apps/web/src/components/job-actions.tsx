'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';

export function JobActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = ['created', 'uploading', 'queued', 'processing'].includes(status);

  async function act() {
    setError('');
    setBusy(true);
    try {
      if (active) {
        await apiRequest(`/api/v1/jobs/${id}`, 'DELETE');
        router.refresh();
      } else {
        const { url } = await apiRequest<{ url: string }>(`/api/v1/jobs/${id}/download`);
        window.location.assign(url);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update job.');
    } finally {
      setBusy(false);
    }
  }

  if (!active && status !== 'completed') return null;
  return <div>
    <div className="flex gap-2">
      {active && <button className="btn-secondary" type="button" onClick={() => router.refresh()}>Refresh status</button>}
      <button className="btn-secondary" type="button" disabled={busy} onClick={act}>{active ? 'Cancel job' : 'Download PDF'}</button>
    </div>
    {error && <p role="alert" className="text-sm mt-2">{error}</p>}
  </div>;
}
