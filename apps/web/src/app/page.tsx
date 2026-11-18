import Link from 'next/link';

export default function Home() {
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8 md:px-10">
    <header className="flex items-center justify-between gap-4">
      <span className="text-2xl font-bold text-blue-700">✦ ToolNest</span>
      <Link href="/login" className="btn-secondary">Sign in</Link>
    </header>
    <section className="my-auto py-20">
      <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Everyday PDF, image, and text tools</h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
        Use twelve utilities in your browser. Merge PDFs, resize images, generate QR codes, and format text on your device.
      </p>
      <Link href="/register" className="btn mt-8">Create an account</Link>
    </section>
  </main>;
}
