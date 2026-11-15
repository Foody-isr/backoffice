'use client';

import { useEffect, useState } from 'react';
import { listUsers, sendResetPassword, deleteUser, User } from '@/lib/api';
import { roleColor, capitalize, formatShortDate } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SetPasswordModal from './SetPasswordModal';

const ROLES = ['', 'superadmin', 'owner', 'manager', 'cashier', 'waiter', 'chef'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ role: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetSuccess, setResetSuccess] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers(role = '', query = '') {
    setAppliedFilters({ role, search: query });
    setError('');
    setLoading(true);
    try {
      const data = await listUsers({ role: role || undefined, search: query || undefined });
      setUsers(data.users || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
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

  const filtered = Boolean(appliedFilters.role || appliedFilters.search);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Users</h1>
        {!error && !loading && (
          <p role="status" className="mt-1 text-sm text-[var(--fg-muted)]">
            {users.length} user{users.length !== 1 ? 's' : ''}{filtered ? ' found' : ' registered'}
          </p>
        )}
      </header>

      <form
        role="search"
        aria-label="Search users"
        className="flex flex-wrap gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (!loading) void loadUsers(roleFilter, search.trim());
        }}
      >
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            aria-label="Name, email or phone"
            type="search"
            placeholder="Search name, email or phone"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="field w-full pl-9"
          />
        </div>
        <select
          aria-label="Role"
          value={roleFilter}
          disabled={loading}
          onChange={event => {
            setRoleFilter(event.target.value);
            void loadUsers(event.target.value, search.trim());
          }}
          className="field"
        >
          <option value="">All roles</option>
          {ROLES.filter(Boolean).map((r) => (
            <option key={r} value={r}>{capitalize(r)}</option>
          ))}
        </select>
        <button type="submit" disabled={loading} className="btn-secondary">Search</button>
        {(search || filtered) && (
          <button type="button" disabled={loading} className="min-h-11 rounded-md px-3 text-sm underline disabled:opacity-50" onClick={() => {
            setSearch('');
            setRoleFilter('');
            void loadUsers();
          }}>
            Clear filters
          </button>
        )}
      </form>

      {loading ? (
        <p role="status" className="py-12 text-center text-sm text-[var(--fg-muted)]">Loading users…</p>
      ) : error ? (
        <div className="error-notice flex flex-wrap items-center justify-between gap-3">
          <p role="alert">{error}</p>
          <button type="button" className="btn-secondary" onClick={() => void loadUsers(appliedFilters.role, appliedFilters.search)}>Retry</button>
        </div>
      ) : (
        <div className="table-scroll" role="region" aria-label="Users table" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col">Role</th>
                <th scope="col">Restaurants</th>
                <th scope="col">Created</th>
                <th scope="col" className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="tabular-nums text-gray-600">#{u.id}</td>
                  <th scope="row" className="min-w-32 font-semibold">{u.full_name}</th>
                  <td className="text-xs text-gray-600">{u.email}</td>
                  <td className="whitespace-nowrap text-xs tabular-nums text-gray-600">{u.phone || '—'}</td>
                  <td>
                    <span className={`table-badge ${roleColor(u.role)}`}>
                      {capitalize(u.role)}
                    </span>
                  </td>
                  <td className="min-w-32">
                    {u.restaurant_roles && u.restaurant_roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.restaurant_roles.map((rr, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs"
                          >
                            {rr.restaurant_name}
                            <span className="text-gray-600"> ({rr.role})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs tabular-nums text-gray-600">{formatShortDate(u.created_at)}</td>
                  <td>
                    {u.role !== 'superadmin' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPasswordUser(u)}
                          className="btn-secondary min-h-8 px-3 text-xs"
                        >
                          Set Password
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u.id)}
                          disabled={resettingId === u.id}
                          className="btn-secondary min-h-8 px-3 text-xs"
                        >
                          {resettingId === u.id
                            ? 'Sending\u2026'
                            : resetSuccess === u.id
                              ? '\u2713 Sent'
                              : 'Email Reset Link'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          disabled={deletingId === u.id}
                          className="min-h-8 whitespace-nowrap rounded-full px-3 text-xs font-medium text-[var(--danger-500)] hover:bg-[var(--danger-50)] disabled:opacity-50"
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
                  <td colSpan={8} className="py-12 text-center text-[var(--fg-muted)]">
                    {filtered ? 'No users match these filters.' : 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {passwordUser && (
        <SetPasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      )}
    </div>
  );
}
