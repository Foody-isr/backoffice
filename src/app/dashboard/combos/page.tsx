'use client';

import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { getApiEnvironment } from '@/lib/api';

const adminByEnvironment = {
  production: 'https://admin.foody-pos.co.il',
  development: 'https://dev-admin.foody-pos.co.il',
};

/** Points old catalog bookmarks to the item editor in Foody Admin. */
export default function CombosPage() {
  const environment = getApiEnvironment();

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="page-title">Manage menus and combos in Foody Admin</h1>
      <p className="text-sm leading-6 text-[var(--fg-muted)]">
        Sign in to Foody Admin with access to the restaurant. Under <strong>Items &amp; menus</strong>, use <strong>Item library</strong> to edit items and combos, or <strong>Menus</strong> to manage the restaurant’s menus.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        {environment && (
          <a className="btn-primary" href={`${adminByEnvironment[environment]}/select-restaurant`}>
            Open Foody Admin
            <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
          </a>
        )}
        <Link href="/dashboard/restaurants" className="btn-secondary">Back to restaurants</Link>
      </div>
    </section>
  );
}
