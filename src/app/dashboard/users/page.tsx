'use client';

import { useEffect, useState } from 'react';
import { listUsers, sendResetPassword, deleteUser, User } from '@/lib/api';
import { roleColor, capitalize, formatShortDate } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const ROLES = ['', 'superadmin', 'owner', 'manager', 'cashier', 'waiter', 'chef'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetSuccess, setResetSuccess] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers(role?: string, q?: string) {
    setLoading(true);
    try {
      const data = await listUsers({ role: role || undefined, search: q || undefined });
      setUsers(data.users || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function handleFilter() {
    loadUsers(roleFilter, search);
  }

  async function handleResetPassword(userId: number) {
    setResettingId(userId);
    setResetSuccess(null);
    try {
      await sendResetPassword(userId);
      setResetSuccess(userId);
      setTimeout(() => setResetSuccess(null), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to send reset email');
    } finally {
      setResettingId(null);
    }
  }

  async function handleDeleteUser(u: User) {
    const confirmed = window.confirm(
      `\u26A0\uFE0F PERMANENT DELETE\n\nAre you sure you want to permanently delete user "${u.full_name}" (#${u.id})?\n\nThis will also delete ALL restaurants owned by this user and ALL their data (orders, menu, stock, etc).\n\nThis action CANNOT be undone.`
    );
    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      `Last chance! Confirm deletion of user "${u.full_name}" and ALL associated data.`
    );
    if (!doubleConfirm) return;

    setDeletingId(u.id);
    try {
      await deleteUser(u.id);
      setUsers((prev) => prev.filter((user) => user.id !== u.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  }

  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500 mt-1">
          {users.length} user{users.length !== 1 ? 's' : ''} registered
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            loadUsers(e.target.value, search);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        >
          <option value="">All roles</option>
          {ROLES.filter(Boolean).map((r) => (
            <option key={r} value={r}>{capitalize(r)}</option>
          ))}
        </select>
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg transition"
        >
          Search
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">ID</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Restaurants</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Created</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">#{u.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleColor(u.role)}`}>
                      {capitalize(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.restaurant_roles && u.restaurant_roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.restaurant_roles.map((rr, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                          >
                            {rr.restaurant_name}
                            <span className="text-gray-400">({rr.role})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatShortDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    {u.role !== 'superadmin' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          disabled={resettingId === u.id}
                          className="px-3 py-1 text-xs font-medium rounded-lg transition disabled:opacity-50
                            bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                        >
                          {resettingId === u.id
                            ? 'Sending\u2026'
                            : resetSuccess === u.id
                              ? '\u2713 Sent'
                              : 'Reset Password'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={deletingId === u.id}
                          className="px-3 py-1 text-xs font-medium rounded-lg transition disabled:opacity-50
                            bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        >
                          {deletingId === u.id ? 'Deleting\u2026' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
