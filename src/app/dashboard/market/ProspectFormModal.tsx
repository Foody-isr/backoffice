'use client';

import { useState } from 'react';
import {
  createProspect,
  updateProspect,
  MarketProspect,
  MarketProspectInput,
  LeadSegmentWithCount,
} from '@/lib/api';
import { XMarkIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface Props {
  prospect: MarketProspect | null;
  defaultSegmentId?: number | null;
  segments: LeadSegmentWithCount[];
  onClose: () => void;
  onSaved: () => void;
}

const input =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none';

export default function ProspectFormModal({
  prospect,
  defaultSegmentId,
  segments,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(prospect?.name ?? '');
  const [segmentId, setSegmentId] = useState<number | null>(
    prospect?.segment_id ?? defaultSegmentId ?? null,
  );
  const [city, setCity] = useState(prospect?.city ?? '');
  const [website, setWebsite] = useState(prospect?.website ?? '');
  const [socials, setSocials] = useState(prospect?.socials ?? '');
  const [notes, setNotes] = useState(prospect?.notes ?? '');
  const [starred, setStarred] = useState(prospect?.starred ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }

    const payload: MarketProspectInput = {
      segment_id: segmentId,
      name: name.trim(),
      city: city.trim(),
      website: website.trim(),
      socials: socials.trim(),
      notes,
      starred,
    };

    setSaving(true);
    try {
      if (prospect) {
        await updateProspect(prospect.id, payload);
      } else {
        await createProspect(payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {prospect ? 'Edit prospect' : 'New prospect'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStarred((s) => !s)}
              className={`p-1.5 rounded-lg transition ${
                starred ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={starred ? 'Unstar' : 'Star (worth pitching)'}
            >
              {starred ? (
                <StarSolidIcon className="w-5 h-5" />
              ) : (
                <StarIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pizza Roma, Tel Aviv"
                className={input}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Segment</label>
              <select
                value={segmentId ?? ''}
                onChange={(e) => setSegmentId(e.target.value ? Number(e.target.value) : null)}
                className={input}
              >
                <option value="">Unsegmented</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Tel Aviv"
                className={input}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className={input}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Socials</label>
              <input
                type="text"
                value={socials}
                onChange={(e) => setSocials(e.target.value)}
                placeholder="Instagram URL, etc."
                className={input}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <p className="text-xs text-gray-400 mb-1">Free text. Markdown supported when viewing.</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                className={`${input} resize-none font-mono text-xs`}
                placeholder={'- 4 locations\n- Currently on Square\n- Owner is on Instagram @...'}
              />
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : prospect ? 'Update prospect' : 'Create prospect'}
          </button>
        </div>
      </div>
    </div>
  );
}
