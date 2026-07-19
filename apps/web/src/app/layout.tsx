import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tacit: Knowledge transfer for trusted AI agents',
  description: 'Tacit is a knowledge transfer session with AI. Hand over how work is done, prepare a cited workflow, and compile a supervised agent your team can inspect and approve.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
