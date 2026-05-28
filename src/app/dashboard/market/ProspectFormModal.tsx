'use client';

import { useState } from 'react';
import {
  createProspect,
  updateProspect,
  MarketProspect,
  MarketProspectInput,
  LeadSegmentWithCount,
  ProspectStatus,
  ProspectCloseReason,
  PROSPECT_STATUSES,
  isClosedStatus,
} from '@/lib/api';
import { XMarkIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import StringListField from '@/components/StringListField';
import { statusLabel, closeReasonLabel } from '@/components/ProspectStatusChip';

interface Props {
  prospect: MarketProspect | null;
  defaultSegmentId?: number | null;
  segments: LeadSegmentWithCount[];
  onClose: () => void;
  onSaved: () => void;
}

const input =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none';

const closeReasonOptions: ProspectCloseReason[] = [
  'price',
  'competitor_won',
  'feature_gap',
  'timing',
  'no_decision_maker',
  'ghosted',
  'other',
];

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

  const [status, setStatus] = useState<ProspectStatus>(prospect?.status ?? 'researching');
  const [whatOffered, setWhatOffered] = useState<string[]>(prospect?.what_offered ?? []);
  const [loved, setLoved] = useState<string[]>(prospect?.loved ?? []);
  const [didNotLove, setDidNotLove] = useState<string[]>(prospect?.did_not_love ?? []);
  const [closeReason, setCloseReason] = useState<ProspectCloseReason>(prospect?.close_reason ?? '');
  const [closeReasonDetail, setCloseReasonDetail] = useState(prospect?.close_reason_detail ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const closed = isClosedStatus(status);

  // Framing question for the close-reason section, since the same enum
  // covers won (positive) and lost/on_hold (negative).
  const closeReasonHeading =
    status === 'won'
      ? 'Why they signed'
      : status === 'lost'
        ? 'Why we lost'
        : 'Why on hold';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (closed && !closeReason) {
      setError(`Pick a reason for "${statusLabel(status)}" before saving.`);
      return;
    }

    const payload: MarketProspectInput = {
      segment_id: segmentId,
      name: name.trim(),
      city: city.trim(),
      website: website.trim(),
      socials: socials.trim(),
      notes,
      starred,
      status,
      what_offered: whatOffered.filter((s) => s.trim()),
      loved: loved.filter((s) => s.trim()),
      did_not_love: didNotLove.filter((s) => s.trim()),
      close_reason: closed ? closeReason : '',
      close_reason_detail: closed ? closeReasonDetail : '',
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 relative">
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
              {starred ? <StarSolidIcon className="w-5 h-5" /> : <StarIcon className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

          {/* Identity */}
          <section className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProspectStatus)}
                className={input}
              >
                {PROSPECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
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
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
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
            <div>
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
                rows={5}
                className={`${input} resize-none font-mono text-xs`}
                placeholder={'- 4 locations\n- Currently on Square\n- Owner is on Instagram @...'}
              />
            </div>
          </section>

          {/* Deal history */}
          <section className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Deal history
            </h3>
            <StringListField
              label="What we offered"
              hint="The deal you put on the table."
              values={whatOffered}
              onChange={setWhatOffered}
              placeholder="e.g. 30-day free trial, bundle with stock module"
            />
            <StringListField
              label="What they loved"
              hint="What landed. Use it again on the next pitch."
              values={loved}
              onChange={setLoved}
              placeholder="e.g. Hebrew menu rendering, kitchen ticket routing"
            />
            <StringListField
              label="What they didn't love"
              hint="What pushed back. Surface this on similar prospects."
              values={didNotLove}
              onChange={setDidNotLove}
              placeholder="e.g. Lack of native Wolt integration"
            />
          </section>

          {/* Close reason (conditional) */}
          {closed && (
            <section className="space-y-3 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {closeReasonHeading}
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <select
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value as ProspectCloseReason)}
                  className={input}
                >
                  <option value="">Pick one…</option>
                  {closeReasonOptions.map((r) => (
                    <option key={r} value={r}>
                      {closeReasonLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                <textarea
                  value={closeReasonDetail}
                  onChange={(e) => setCloseReasonDetail(e.target.value)}
                  rows={3}
                  className={`${input} resize-none`}
                  placeholder={
                    status === 'won'
                      ? 'What sealed it? Specifics.'
                      : status === 'lost'
                        ? 'What happened? Specifics.'
                        : 'Why paused, and when to revisit.'
                  }
                />
              </div>
            </section>
          )}
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
