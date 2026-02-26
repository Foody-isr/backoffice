'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  HomeIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  CubeIcon,
  ArrowRightOnRectangleIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/dashboard/restaurants', label: 'Restaurants', icon: BuildingStorefrontIcon },
  { href: '/dashboard/users', label: 'Users', icon: UsersIcon },
  { href: '/dashboard/onboard', label: 'Onboard New', icon: PlusCircleIcon },
  { href: '/dashboard/features', label: 'Feature Catalog', icon: CubeIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-[#1a1a2e] text-gray-300 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center">
            <span className="text-lg font-black text-white">F</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Foody</h1>
            <p className="text-xs text-gray-400">Backoffice</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User & logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-xs text-gray-400 mb-2 truncate">
          {user?.email}
        </div>
        <button
          onClick={logout}
          className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
