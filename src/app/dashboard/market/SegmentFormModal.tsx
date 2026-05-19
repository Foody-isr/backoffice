'use client';

import { useState } from 'react';
import {
  createSegment,
  updateSegment,
  LeadSegment,
  LeadSegmentInput,
  Objection,
  Competitor,
} from '@/lib/api';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Props {
  segment: LeadSegment | null;
  onClose: () => void;
  onSaved: () => void;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function SegmentFormModal({ segment, onClose, onSaved }: Props) {
  const [name, setName] = useState(segment?.name ?? '');
  const [slug, setSlug] = useState(segment?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!segment);
  const [description, setDescription] = useState(segment?.description ?? '');
  const [pitchAngle, setPitchAngle] = useState(segment?.pitch_angle ?? '');
  const [demoNotes, setDemoNotes] = useState(segment?.demo_notes ?? '');
  const [pricingNotes, setPricingNotes] = useState(segment?.pricing_notes ?? '');
  const [typicalDealSize, setTypicalDealSize] = useState(segment?.typical_deal_size ?? '');
  const [sortOrder, setSortOrder] = useState(segment?.sort_order ?? 0);
  const [painPoints, setPainPoints] = useState<string[]>(segment?.pain_points ?? []);
  const [keyFeatures, setKeyFeatures] = useState<string[]>(segment?.key_features ?? []);
  const [disqualifiers, setDisqualifiers] = useState<string[]>(segment?.disqualifiers ?? []);
  const [objections, setObjections] = useState<Objection[]>(segment?.objections ?? []);
  const [competitors, setCompetitors] = useState<Competitor[]>(segment?.competitors ?? []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!slug.trim()) { setError('Slug is required.'); return; }

    const input: LeadSegmentInput = {
      slug: slug.trim(),
      name: name.trim(),
      description,
      pain_points: painPoints.filter((s) => s.trim()),
      key_features: keyFeatures.filter((s) => s.trim()),
      pitch_angle: pitchAngle,
      objections: objections.filter((o) => o.q.trim() || o.a.trim()),
      demo_notes: demoNotes,
      pricing_notes: pricingNotes,
      typical_deal_size: typicalDealSize.trim(),
      disqualifiers: disqualifiers.filter((s) => s.trim()),
      competitors: competitors.filter((c) => c.name.trim() || c.notes.trim()),
      sort_order: sortOrder,
    };

    setSaving(true);
    try {
      if (segment) {
        await updateSegment(segment.id, input);
      } else {
        await createSegment(input);
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {segment ? `Edit ${segment.name} playbook` : 'New segment'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

          {/* Identity */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Dark Kitchen"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                placeholder="dark-kitchen"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="One or two sentences: who they are and what they care about."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typical deal size</label>
              <input
                type="text"
                value={typicalDealSize}
                onChange={(e) => setTypicalDealSize(e.target.value)}
                placeholder="₪300/mo + 1% transaction"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
          </section>

          <StringListField
            label="Pain points"
            hint="What hurts for this segment today?"
            values={painPoints}
            onChange={setPainPoints}
            placeholder="e.g. Manual reconciliation between aggregator apps and POS"
          />

          <StringListField
            label="Key Foody features to lead with"
            hint="Which parts of the product matter most to this segment?"
            values={keyFeatures}
            onChange={setKeyFeatures}
            placeholder="e.g. Aggregator order ingestion, kitchen ticket routing"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pitch angle</label>
            <p className="text-xs text-gray-400 mb-2">The story you tell first when you sit down with them.</p>
            <textarea
              value={pitchAngle}
              onChange={(e) => setPitchAngle(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
            />
          </div>

          <ObjectionListField values={objections} onChange={setObjections} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Demo notes</label>
            <p className="text-xs text-gray-400 mb-2">Talking points and the screens to show, in order. Markdown supported.</p>
            <textarea
              value={demoNotes}
              onChange={(e) => setDemoNotes(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none font-mono"
              placeholder={'1. Start on POS: show ticket routing\n2. Switch to admin: show stock alerts\n3. Open analytics: show daily food cost report'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pricing notes</label>
            <textarea
              value={pricingNotes}
              onChange={(e) => setPricingNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              placeholder="Free text. Bundling ideas, discounts, what to anchor on."
            />
          </div>

          <StringListField
            label="Disqualifiers"
            hint="Red flags. Signals this prospect is NOT a fit."
            values={disqualifiers}
            onChange={setDisqualifiers}
            placeholder="e.g. Already locked into a 3-year POS contract"
          />

          <CompetitorListField values={competitors} onChange={setCompetitors} />
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
            {saving ? 'Saving…' : segment ? 'Save playbook' : 'Create segment'}
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

interface StringListFieldProps {
  label: string;
  hint?: string;
  values: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}

function StringListField({ label, hint, values, placeholder, onChange }: StringListFieldProps) {
  function update(idx: number, v: string) {
    onChange(values.map((s, i) => (i === idx ? v : s)));
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...values, '']);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={add}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {values.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 px-3 border border-dashed border-gray-200 rounded-lg text-center">
          Empty. Click <span className="font-medium">Add</span> to start.
        </p>
      ) : (
        <div className="space-y-2">
          {values.map((v, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={v}
                onChange={(e) => update(idx, e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                title="Remove"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ObjectionListFieldProps {
  values: Objection[];
  onChange: (v: Objection[]) => void;
}

function ObjectionListField({ values, onChange }: ObjectionListFieldProps) {
  function update(idx: number, patch: Partial<Objection>) {
    onChange(values.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...values, { q: '', a: '' }]);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">Objections & responses</label>
        <button
          type="button"
          onClick={add}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">What they push back on, and what you say.</p>
      {values.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 px-3 border border-dashed border-gray-200 rounded-lg text-center">
          Empty. Click <span className="font-medium">Add</span> to start.
        </p>
      ) : (
        <div className="space-y-3">
          {values.map((o, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={o.q}
                  onChange={(e) => update(idx, { q: e.target.value })}
                  placeholder="Objection (e.g. 'Your fees are higher than Square')"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                  title="Remove"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={o.a}
                onChange={(e) => update(idx, { a: e.target.value })}
                rows={2}
                placeholder="Response: the talking point you use."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CompetitorListFieldProps {
  values: Competitor[];
  onChange: (v: Competitor[]) => void;
}

function CompetitorListField({ values, onChange }: CompetitorListFieldProps) {
  function update(idx: number, patch: Partial<Competitor>) {
    onChange(values.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...values, { name: '', notes: '' }]);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">Competitors</label>
        <button
          type="button"
          onClick={add}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">Who dominates this segment, and how Foody differs.</p>
      {values.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 px-3 border border-dashed border-gray-200 rounded-lg text-center">
          Empty. Click <span className="font-medium">Add</span> to start.
        </p>
      ) : (
        <div className="space-y-3">
          {values.map((c, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => update(idx, { name: e.target.value })}
                  placeholder="Competitor (e.g. Square, Toast, Tabit)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                  title="Remove"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={c.notes}
                onChange={(e) => update(idx, { notes: e.target.value })}
                rows={2}
                placeholder="How Foody differentiates from them in this segment."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
