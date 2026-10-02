import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/playfair-display/latin-500.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './global.css';
export const metadata: Metadata = {
  title: 'VisitsPakistan',
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
