export function serverEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase public environment variables');
  return { url, key };
}
export const LIMITS = { pdfBytes:25*1024*1024, maxPdfFiles:10, maxPages:200, outputTtlMinutes:60, maxJobsDaily:20 } as const;

export function serverProcessingEnabled() {
  return process.env.TOOLNEST_SERVER_PROCESSING_ENABLED === 'true';
}
