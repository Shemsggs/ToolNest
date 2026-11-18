import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ToolNest',
  description: 'Browser tools for PDFs, images, and text.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
