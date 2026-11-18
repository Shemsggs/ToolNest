import { AuthForm } from '@/components/auth-form';

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const { error, status } = await searchParams;
  const message = status === 'deletion-scheduled' ? 'Your account is scheduled for deletion.' :
    error === 'confirmation' ? 'The confirmation link could not be opened. Sign in if you already confirmed your email.' : '';
  return <AuthForm mode="login" initialMessage={message} />;
}
