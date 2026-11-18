import { redirect } from 'next/navigation';
import { PasswordRecoveryForm } from '@/components/password-recovery-form';
import { requireUser } from '@/lib/auth';

export default async function Page() {
  if (!await requireUser()) redirect('/forgot-password');
  return <PasswordRecoveryForm mode="reset" />;
}
