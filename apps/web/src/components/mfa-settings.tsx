'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

const authenticatorName = 'ToolNest authenticator';

export function MfaSettings({ factorId, elevated }: { factorId: string | null; elevated: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ id: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pendingFactor = setup?.id ?? factorId;

  async function enroll() {
    setBusy(true);
    setError('');
    try {
      const { mfa } = getSupabaseBrowser().auth;
      const factors = await mfa.listFactors();
      if (factors.error) throw factors.error;
      for (const factor of factors.data.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified' && factor.friendly_name === authenticatorName) {
          const { error } = await mfa.unenroll({ factorId: factor.id });
          if (error) throw error;
        }
      }
      const { data, error } = await mfa.enroll({ factorType: 'totp', friendlyName: authenticatorName });
      if (error) throw error;
      setSetup({ id: data.id, secret: data.totp.secret });
    } catch {
      setError('Could not set up your authenticator.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingFactor) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await getSupabaseBrowser().auth.mfa.challengeAndVerify({ factorId: pendingFactor, code });
      if (error) throw error;
      setSetup(null);
      setCode('');
      router.refresh();
    } catch {
      setError('Could not verify the code. Enter the current code from your authenticator.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="card mt-5 max-w-xl space-y-3">
    <h2 className="font-semibold">Authenticator</h2>
    {elevated ? <p className="text-sm">This session is verified with an authenticator.</p> : pendingFactor
      ? <form className="space-y-3" onSubmit={verify}>
        {setup && <p className="text-sm">Add this setup key to your authenticator app, then enter its current code. <code className="block break-all mt-1">{setup.secret}</code></p>}
        <label className="block text-sm font-medium">Six-digit code
          <input className="field mt-1" disabled={busy} type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} />
        </label>
        <button className="btn" disabled={busy}>Verify code</button>
      </form>
      : <button className="btn-secondary" type="button" disabled={busy} onClick={enroll}>Set up authenticator</button>}
    {error && <p className="text-sm" role="alert">{error}</p>}
  </section>;
}
