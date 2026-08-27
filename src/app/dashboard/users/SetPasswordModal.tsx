'use client';

import { useState } from 'react';
import { setUserPassword, revokeUserSessions, User } from '@/lib/api';
import {
  XMarkIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Props {
  user: User;
  onClose: () => void;
}

// Mirrors the binding on the server's SetUserPasswordInput.
const MIN_LENGTH = 8;

// Ambiguous glyphs (0/O, 1/l/I) are left out on purpose: this password gets
// read aloud on the phone or retyped from a note before the owner changes it.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePassword(length = 14): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join('');
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none';

export default function SetPasswordModal({ user, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revoke, setRevoke] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [revokeWarning, setRevokeWarning] = useState('');
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    const next = generatePassword();
    setPassword(next);
    setConfirm(next);
    setError('');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the password and copy it manually.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await setUserPassword(user.id, password);
      // The password is set at this point. A failing revoke is reported as a
      // warning rather than an error so the operator does not retry a change
      // that already landed.
      if (revoke) {
        try {
          await revokeUserSessions(user.id);
        } catch (e: unknown) {
          setRevokeWarning(
            e instanceof Error ? e.message : 'Could not log the user out of their devices.'
          );
        }
      }
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not set the password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Set password</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.full_name} · {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {saved ? (
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                Password updated. Share it with {user.full_name}, then ask them to change it from
                their account.
                {revoke && !revokeWarning && ' All their devices have been logged out.'}
              </div>
            </div>

            {revokeWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                The password was changed, but their devices could not be logged out: {revokeWarning}
              </div>
            )}

            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-900 break-all">
                {password}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                title="Copy password"
              >
                {copied ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <ClipboardDocumentIcon className="w-5 h-5" />
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  placeholder={`At least ${MIN_LENGTH} characters`}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition shrink-0"
                  title="Generate a password"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Shown in clear text so you can read it out or copy it.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm</label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={revoke}
                onChange={(e) => setRevoke(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <span>
                Log them out of all devices
                <span className="block text-xs text-gray-500">
                  Their POS tablets will have to sign in again with the new password.
                </span>
              </span>
            </label>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {saving ? 'Saving…' : 'Set password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
