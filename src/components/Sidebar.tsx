'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BuildingStorefrontIcon,
  CircleStackIcon,
  CreditCardIcon,
  CubeIcon,
  DevicePhoneMobileIcon,
  HomeIcon,
  PresentationChartLineIcon,
  ReceiptPercentIcon,
  ServerStackIcon,
  SignalIcon,
  SparklesIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getApiEnvironment } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const home = { href: '/dashboard', label: 'Dashboard', icon: HomeIcon };
const sections = [
  {
    label: 'Management',
    links: [
      { href: '/dashboard/restaurants', label: 'Restaurants', icon: BuildingStorefrontIcon },
      { href: '/dashboard/users', label: 'Users', icon: UsersIcon },
    ],
  },
  {
    label: 'Payments & devices',
    links: [
      { href: '/dashboard/features', label: 'Plans & modules', icon: CubeIcon },
      { href: '/dashboard/foody-billing', label: 'Foody billing (sandbox)', icon: ReceiptPercentIcon },
      { href: '/dashboard/terminals', label: 'Terminal fleet', icon: DevicePhoneMobileIcon },
      { href: '/dashboard/payments', label: 'Cibus (Pluxee)', icon: CreditCardIcon },
    ],
  },
  {
    label: 'POS content',
    links: [
      { href: '/dashboard/ingredient-icons', label: 'Ingredient icons', icon: SparklesIcon },
      { href: '/dashboard/pos-login-screen', label: 'POS login screen', icon: DevicePhoneMobileIcon },
    ],
  },
  {
    label: 'Platform',
    links: [
      { href: '/dashboard/api-usage', label: 'Usage and quotas', icon: PresentationChartLineIcon },
      { href: '/dashboard/operations', label: 'Operations', icon: SignalIcon },
      { href: '/dashboard/security', label: 'Account security', icon: SignalIcon },
      { href: '/dashboard/servers', label: 'Servers', icon: ServerStackIcon },
      { href: '/dashboard/clone', label: 'Clone data', icon: CircleStackIcon },
    ],
  },
];

/** Groups the links operators use across the platform. */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const environment = getApiEnvironment();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  function renderLink({ href, label, icon: Icon }: typeof home) {
    const exactMatch = pathname === href;
    const inSection = href !== home.href && (
      pathname.startsWith(`${href}/`) || (href === '/dashboard/restaurants' && pathname === '/dashboard/onboard')
    );

    return (
      <Link
        href={href}
        className="sidebar-link"
        aria-current={exactMatch ? 'page' : inSection ? 'location' : undefined}
        onClick={() => setMobileOpen(false)}
      >
        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <aside
      className="sticky top-0 z-30 flex flex-col border-b border-[var(--line)] bg-[var(--surface)] lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && mobileOpen) {
          setMobileOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="flex min-h-16 items-center gap-3 px-4 lg:px-5">
        <Link
          href={home.href}
          className="flex min-h-11 items-center gap-3 rounded-md text-base font-semibold"
          onClick={() => setMobileOpen(false)}
        >
          <Image src="/brand/foody-symbol.svg" alt="" width={22} height={22} unoptimized />
          <span>
            <span className="block">Foody Backoffice</span>
            <span className={`block text-xs font-medium ${environment === 'production' ? 'text-[var(--warning-500)]' : 'text-[var(--fg-muted)]'}`}>
              {environment === 'production' ? 'Production API' : environment === 'development' ? 'Development API' : 'Custom API'}
            </span>
          </span>
        </Link>
        <button
          ref={menuButton}
          type="button"
          className="ml-auto grid size-11 shrink-0 place-items-center rounded-md hover:bg-[var(--sidebar-hover)] lg:hidden"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-controls="backoffice-navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(value => !value)}
        >
          {mobileOpen ? <XMarkIcon aria-hidden="true" className="size-5" /> : <Bars3Icon aria-hidden="true" className="size-5" />}
        </button>
      </div>

      <div id="backoffice-navigation" className={`${mobileOpen ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:flex`}>
        <nav aria-label="Backoffice" className="max-h-[calc(100dvh-10rem)] flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-2 lg:max-h-none">
          {renderLink(home)}
          {sections.map(({ label, links }, index) => (
            <section key={label} aria-labelledby={`nav-section-${index}`}>
              <h2 id={`nav-section-${index}`} className="px-3 pb-1 text-xs font-medium text-[var(--fg-muted)]">{label}</h2>
              <ul className="space-y-0.5">
                {links.map(link => <li key={link.href}>{renderLink(link)}</li>)}
              </ul>
            </section>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[var(--line)] px-3 py-3">
          <p className="truncate px-3 pb-1.5 text-xs text-[var(--fg-muted)]" title={user?.email}>{user?.email}</p>
          <button type="button" onClick={logout} className="sidebar-link w-full text-start">
            <ArrowRightOnRectangleIcon aria-hidden="true" className="size-[18px] shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
