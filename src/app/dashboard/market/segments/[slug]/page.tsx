'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  getSegment,
  listSegments,
  listProspects,
  deleteProspect,
  LeadSegment,
  LeadSegmentWithCount,
  MarketProspect,
} from '@/lib/api';
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon as StarOutline,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import SegmentFormModal from '../../SegmentFormModal';
import ProspectFormModal from '../../ProspectFormModal';

interface PageProps {
  params: { slug: string };
}

export default function SegmentDetailPage({ params }: PageProps) {
  const { slug } = params;

  const [segment, setSegment] = useState<LeadSegment | null>(null);
  const [segments, setSegments] = useState<LeadSegmentWithCount[]>([]);
  const [prospects, setProspects] = useState<MarketProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingSegment, setEditingSegment] = useState(false);
  const [editingProspect, setEditingProspect] = useState<MarketProspect | null>(null);
  const [creatingProspect, setCreatingProspect] = useState(false);

  const [starredOnly, setStarredOnly] = useState(false);
  const [search, setSearch] = useState('');

  const loadSegment = useCallback(async () => {
    setError('');
    try {
      const data = await getSegment(slug);
      setSegment(data.segment);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load segment');
    }
  }, [slug]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadSegment();
      const [segsRes, segData] = await Promise.all([
        listSegments(),
        getSegment(slug),
      ]);
      setSegments(segsRes.segments || []);
      const segId = segData.segment.id;
      const pr = await listProspects({ segment_id: segId });
      setProspects(pr.prospects || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [slug, loadSegment]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function reloadProspects() {
    if (!segment) return;
    const pr = await listProspects({ segment_id: segment.id });
    setProspects(pr.prospects || []);
  }

  async function handleDeleteProspect(p: MarketProspect) {
    if (!confirm(`Delete prospect "${p.name}"?`)) return;
    try {
      await deleteProspect(p.id);
      reloadProspects();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const filtered = prospects.filter((p) => {
    if (starredOnly && !p.starred) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.city.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div>
        <Link
          href="/dashboard/market"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to segments
        </Link>
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error || 'Segment not found.'}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <Link
        href="/dashboard/market"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" /> Back to segments
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{segment.name}</h1>
            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
              {segment.slug}
            </span>
          </div>
          {segment.description && (
            <p className="text-sm text-gray-500 max-w-3xl">{segment.description}</p>
          )}
        </div>
        <button
          onClick={() => setEditingSegment(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
        >
          <PencilSquareIcon className="w-4 h-4" />
          Edit playbook
        </button>
      </div>

      {/* Playbook sections */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 mb-8">
        <PlaybookList title="Pain points" items={segment.pain_points} />
        <PlaybookList title="Key Foody features to lead with" items={segment.key_features} accent="brand" />

        <PlaybookText title="Pitch angle" value={segment.pitch_angle} />

        <PlaybookObjections items={segment.objections} />

        <PlaybookMarkdown title="Demo notes" value={segment.demo_notes} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlaybookText title="Pricing notes" value={segment.pricing_notes} />
          <PlaybookText title="Typical deal size" value={segment.typical_deal_size} mono />
        </div>

        <PlaybookList title="Disqualifiers" items={segment.disqualifiers} accent="red" />
        <PlaybookCompetitors items={segment.competitors} />
      </div>

      {/* Prospects assigned to this segment */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">
          Prospects in this segment <span className="text-sm font-normal text-gray-400">({prospects.length})</span>
        </h2>
        <button
          onClick={() => setCreatingProspect(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" /> Add prospect
        </button>
      </div>

      <div className="flex gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
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

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 mb-3">
            {prospects.length === 0
              ? 'No prospects in this segment yet.'
              : 'No prospects match the current filter.'}
          </p>
          {prospects.length === 0 && (
            <button
              onClick={() => setCreatingProspect(true)}
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
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Website</th>
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
                      onClick={() => setEditingProspect(p)}
                      className="font-medium text-gray-900 hover:text-brand-600 text-left"
                    >
                      {p.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.city || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-xs">
                    {p.website ? (
                      <a
                        href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        {p.website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingProspect(p)}
                        className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProspect(p)}
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

      {editingSegment && (
        <SegmentFormModal
          segment={segment}
          onClose={() => setEditingSegment(false)}
          onSaved={() => {
            setEditingSegment(false);
            loadSegment();
          }}
        />
      )}

      {(creatingProspect || editingProspect) && (
        <ProspectFormModal
          prospect={editingProspect}
          defaultSegmentId={segment.id}
          segments={segments}
          onClose={() => {
            setCreatingProspect(false);
            setEditingProspect(null);
          }}
          onSaved={() => {
            setCreatingProspect(false);
            setEditingProspect(null);
            reloadProspects();
          }}
        />
      )}
    </div>
  );
}

// ─── Playbook section components ───────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
      {title}
    </h3>
  );
}

function EmptyHint() {
  return <p className="text-sm text-gray-300 italic">Not filled in yet.</p>;
}

function PlaybookList({
  title,
  items,
  accent = 'gray',
}: {
  title: string;
  items: string[];
  accent?: 'gray' | 'brand' | 'red';
}) {
  const chipClass =
    accent === 'brand'
      ? 'bg-brand-50 text-brand-700'
      : accent === 'red'
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-100 text-gray-700';
  return (
    <div>
      <SectionHeader title={title} />
      {items.length === 0 ? (
        <EmptyHint />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <li key={i} className={`text-sm px-3 py-1 rounded-full ${chipClass}`}>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaybookText({
  title,
  value,
  mono,
}: {
  title: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <SectionHeader title={title} />
      {value ? (
        <p className={`text-sm text-gray-700 whitespace-pre-wrap ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      ) : (
        <EmptyHint />
      )}
    </div>
  );
}

function PlaybookMarkdown({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <SectionHeader title={title} />
      {value ? (
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>
      ) : (
        <EmptyHint />
      )}
    </div>
  );
}

function PlaybookObjections({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div>
      <SectionHeader title="Objections & responses" />
      {items.length === 0 ? (
        <EmptyHint />
      ) : (
        <div className="space-y-3">
          {items.map((o, i) => (
            <div key={i} className="border-l-4 border-gray-200 pl-4">
              <p className="text-sm font-medium text-gray-800">{o.q || <span className="italic text-gray-400">No objection text</span>}</p>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                {o.a || <span className="italic text-gray-400">No response yet</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaybookCompetitors({ items }: { items: { name: string; notes: string }[] }) {
  return (
    <div>
      <SectionHeader title="Competitors" />
      {items.length === 0 ? (
        <EmptyHint />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((c, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
              <p className="text-sm font-semibold text-gray-800">{c.name || <span className="italic text-gray-400">Unnamed</span>}</p>
              {c.notes && (
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{c.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
