import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Tacit: Knowledge Transfer for AI Agents',
    template: '%s | Tacit',
  },
  description:
    'Turn expert knowledge transfer into evidence-backed workflows and supervised AI agents. Inspect, test, and approve automation your team can trust.',
  openGraph: {
    title: 'Tacit: Knowledge Transfer for AI Agents',
    description:
      'Turn expert knowledge transfer into evidence-backed workflows and supervised AI agents. Inspect, test, and approve automation your team can trust.',
    type: 'website',
    images: [
      {
        url: '/images/landing/tacit-hero.png',
        width: 1200,
        height: 630,
        alt: 'Tacit: Knowledge Transfer for AI Agents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tacit: Knowledge Transfer for AI Agents',
    description:
      'Turn expert knowledge transfer into evidence-backed workflows and supervised AI agents. Inspect, test, and approve automation your team can trust.',
    images: ['/images/landing/tacit-hero.png'],
  },
  icons: {
    icon: '/images/brand/tacit-1024x1024.png',
    shortcut: '/images/brand/tacit-1024x1024.png',
    apple: '/images/brand/tacit-1024x1024.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
