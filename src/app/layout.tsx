import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Foody Backoffice',
  description: 'Foody Admin — Restaurant management, onboarding, and feature control',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
