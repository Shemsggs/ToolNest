'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { LIMITS } from '@/lib/config';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export function ServerMerge() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (files.length < 2 || files.length > LIMITS.maxPdfFiles || files.some(file =>
      !/\.pdf$/i.test(file.name) || file.name.length > 200 || file.size < 1 || file.size > LIMITS.pdfBytes)) {
      setStatus('Select 2 to 10 PDFs of up to 25 MiB each.');
      return;
    }

    setBusy(true);
    setStatus('Creating job…');
    try {
      const { jobId } = await apiRequest<{ jobId: string }>('/api/v1/jobs', 'POST', {
        tool: 'merge-pdf',
        files: files.map(file => ({ name: file.name, sizeBytes: file.size, contentType: 'application/pdf' })),
      });
      const store = getSupabaseBrowser().storage.from('temporary-files');
      for (const [position, file] of files.entries()) {
        setStatus(`Uploading ${position + 1} of ${files.length}…`);
        const { path, token } = await apiRequest<{ path: string; token: string }>(`/api/v1/jobs/${jobId}/uploads`, 'POST', {
          position, filename: file.name, sizeBytes: file.size, contentType: 'application/pdf',
        });
        const { error } = await store.uploadToSignedUrl(path, token, file, { contentType: 'application/pdf' });
        if (error) throw new Error('Could not upload the PDF.');
      }
      await apiRequest(`/api/v1/jobs/${jobId}/submit`, 'POST');
      setStatus('Job queued. Track its progress in History.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not submit job.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="card max-w-2xl mt-6">
    <h2 className="text-xl font-bold">Server PDF merge <span className="text-sm font-normal">(experimental)</span></h2>
    <p className="text-sm text-slate-600 mt-1 mb-4">Upload up to ten PDFs to temporary private storage for processing.</p>
    <label className="block text-sm font-medium">PDF files
      <input className="field mt-1" type="file" accept=".pdf,application/pdf" multiple disabled={busy}
        onChange={event => setFiles(Array.from(event.target.files ?? []))} />
    </label>
    <div className="flex flex-wrap gap-3 items-center mt-4">
      <button className="btn" disabled={busy} onClick={submit}>Process on server</button>
      <Link className="text-blue-700 text-sm font-medium" href="/history">Open job history</Link>
    </div>
    {status && <p role="status" className="text-sm mt-4">{status}</p>}
  </section>;
}
