'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { listSegments, deleteSegment, LeadSegmentWithCount } from '@/lib/api';
import {
  PlusIcon,
  UsersIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import SegmentFormModal from './SegmentFormModal';

export default function MarketPage() {
  const [segments, setSegments] = useState<LeadSegmentWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listSegments();
      setSegments(data.segments || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(seg: LeadSegmentWithCount) {
    if (seg.prospect_count > 0) {
      alert(`Cannot delete "${seg.name}". ${seg.prospect_count} prospects are still assigned to it; reassign or delete them first.`);
      return;
    }
    if (!confirm(`Delete segment "${seg.name}"? This cannot be undone.`)) return;
    try {
      await deleteSegment(seg.id);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market & Playbook</h1>
          <p className="text-sm text-gray-500 mt-1">
            Per-segment sales playbook and market research notes. Internal tool, superadmin only.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/market/prospects"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg transition"
          >
            All prospects
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
          >
            <PlusIcon className="w-4 h-4" />
            New segment
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No segments yet.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
          >
            <PlusIcon className="w-4 h-4" />
            Create first segment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {segments.map((seg) => (
            <div
              key={seg.id}
              className="group bg-white rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-sm transition flex flex-col"
            >
              <Link
                href={`/dashboard/market/segments/${encodeURIComponent(seg.slug)}`}
                className="flex-1 p-5"
              >
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-brand-600 transition">
                    {seg.name}
                  </h2>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                    <UsersIcon className="w-3.5 h-3.5" />
                    {seg.prospect_count}
                  </span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-3 min-h-[3.75rem]">
                  {seg.description || <span className="italic text-gray-300">No description yet</span>}
                </p>
                {seg.typical_deal_size && (
                  <p className="text-xs text-gray-400 mt-3 font-mono">
                    {seg.typical_deal_size}
                  </p>
                )}
              </Link>
              <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-1">
                <Link
                  href={`/dashboard/market/segments/${encodeURIComponent(seg.slug)}`}
                  className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition"
                  title="View playbook"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => handleDelete(seg)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <SegmentFormModal
          segment={null}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
