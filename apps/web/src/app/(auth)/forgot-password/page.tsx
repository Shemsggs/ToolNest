import { PasswordRecoveryForm } from '@/components/password-recovery-form';

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <PasswordRecoveryForm mode="request" initialMessage={error === 'expired' ? 'That reset link could not be opened. Request a new link and open it in this browser.' : ''} />;
}
