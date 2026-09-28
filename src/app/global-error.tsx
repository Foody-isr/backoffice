'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#1a1a2e] text-white flex items-center justify-center p-6">
        <main className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm font-semibold text-orange-400">Foody Backoffice</p>
          <h1 className="mt-3 text-2xl font-bold">The backoffice could not continue.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-300">
            The incident was recorded. Retry once; if the error returns, open Operations and use the
            event timestamp to investigate it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
