import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Foody Backoffice',
  description: 'Foody Backoffice — Restaurant management and platform operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
