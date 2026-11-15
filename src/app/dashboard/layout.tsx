'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push('/login');
    }
  }, [loading, isLoggedIn, router]);

  if (loading) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center gap-3 text-sm text-[var(--fg-muted)]">
        <div aria-hidden="true" className="size-5 rounded-full border-2 border-brand-500 border-t-transparent motion-safe:animate-spin" />
        Loading Backoffice…
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#workspace" className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-white focus:p-3">
        Skip to content
      </a>
      <Sidebar />
      <main id="workspace" tabIndex={-1} className="min-w-0 flex-1 scroll-mt-16 lg:scroll-mt-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
