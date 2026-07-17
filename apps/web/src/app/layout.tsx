import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tacit — Turn expert work into working software',
  description: 'Tacit turns expert evidence and judgment into confirmed workflows and tested, reviewable AI agents.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
