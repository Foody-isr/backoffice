'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  listSegments,
  listProspects,
  deleteProspect,
  LeadSegmentWithCount,
  MarketProspect,
  ProspectStatus,
  PROSPECT_STATUSES,
} from '@/lib/api';
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  StarIcon as StarOutline,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { formatShortDate } from '@/lib/utils';
import ProspectFormModal from '../ProspectFormModal';
import ProspectStatusChip, { statusLabel } from '@/components/ProspectStatusChip';

export default function ProspectsPage() {
  const [segments, setSegments] = useState<LeadSegmentWithCount[]>([]);
  const [prospects, setProspects] = useState<MarketProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<number | 'all' | 'none'>('all');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [starredOnly, setStarredOnly] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MarketProspect | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [segs, pros] = await Promise.all([listSegments(), listProspects()]);
      setSegments(segs.segments || []);
      setProspects(pros.prospects || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(p: MarketProspect) {
    if (!confirm(`Delete prospect "${p.name}"?`)) return;
    try {
      await deleteProspect(p.id);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const filtered = prospects.filter((p) => {
    if (starredOnly && !p.starred) return false;
    if (segmentFilter === 'none' && p.segment_id !== null) return false;
    if (typeof segmentFilter === 'number' && p.segment_id !== segmentFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.city.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div>
      <Link
        href="/dashboard/market"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" /> Back to segments
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All prospects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every restaurant you&apos;ve researched, across segments.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          New prospect
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg mb-4">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <select
          value={segmentFilter}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'all' || v === 'none') setSegmentFilter(v);
            else setSegmentFilter(Number(v));
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        >
          <option value="all">All segments</option>
          <option value="none">Unsegmented</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProspectStatus | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        >
          <option value="all">All statuses</option>
          {PROSPECT_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={starredOnly}
            onChange={(e) => setStarredOnly(e.target.checked)}
            className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          Starred only
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 mb-4">
            {prospects.length === 0
              ? 'No prospects yet.'
              : 'No prospects match the current filter.'}
          </p>
          {prospects.length === 0 && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
            >
              <PlusIcon className="w-4 h-4" /> Add first prospect
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600 w-8"></th>
                <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Segment</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Updated</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {p.starred ? (
                      <StarSolid className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <StarOutline className="w-4 h-4 text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditing(p)}
                      className="font-medium text-gray-900 hover:text-brand-600 text-left"
                    >
                      {p.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <ProspectStatusChip status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    {p.segment ? (
                      <Link
                        href={`/dashboard/market/segments/${encodeURIComponent(p.segment.slug)}`}
                        className="inline-block text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100"
                      >
                        {p.segment.name}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Unsegmented</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.city || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.updated_at ? formatShortDate(p.updated_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ProspectFormModal
          prospect={editing}
          segments={segments}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
