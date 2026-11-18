import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const code = search.get('code');
  const recovery = search.get('flow') === 'recovery';
  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(recovery ? '/reset-password' : '/dashboard', request.url));
  }
  return NextResponse.redirect(new URL(recovery ? '/forgot-password?error=expired' : '/login?error=confirmation', request.url));
}
