import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProfileSettings } from '@/components/profile-settings';
import { DeleteAccount } from '@/components/delete-account';
import { MfaSettings } from '@/components/mfa-settings';
import { requireUser } from '@/lib/auth';

export default async function Page() {
  const auth = await requireUser();
  if (!auth) redirect('/login');
  const [{ data, error }, { data: session }, { data: role }] = await Promise.all([
    auth.client.from('profiles').select('display_name').eq('id', auth.user.id).single(),
    auth.client.auth.getClaims(),
    auth.client.from('admin_roles').select('role').eq('user_id', auth.user.id).maybeSingle(),
  ]);
  const factor = auth.user.factors?.find(entry => entry.factor_type === 'totp' && entry.status === 'verified');

  return <main>
    <h1 className="text-3xl font-bold">Settings</h1>
    {error ? <p className="mt-5">Could not load your profile.</p> : <ProfileSettings initialName={data.display_name ?? ''} />}
    <div className="card mt-5 max-w-xl">
      <h2 className="font-semibold">Account</h2>
      <p className="text-sm text-slate-600 mt-2 break-words">{auth.user.email}</p>
      <Link href="/forgot-password" className="text-blue-700 text-sm underline mt-3 inline-block">Request a password reset</Link>
      {role && <Link href="/admin" className="text-blue-700 text-sm underline mt-3 block">Administration</Link>}
    </div>
    <MfaSettings factorId={factor?.id ?? null} elevated={Boolean(factor && session?.claims.aal === 'aal2')} />
    <DeleteAccount />
  </main>;
}
