'use client';

import { useEffect, useState } from 'react';
import {
  listPOSLoginSlides,
  createPOSLoginSlide,
  updatePOSLoginSlide,
  deletePOSLoginSlide,
  reorderPOSLoginSlides,
  getPOSLoginConfig,
  updatePOSLoginConfig,
  uploadPOSLoginSlideImage,
  emptyLocalizedText,
  POSLoginSlide,
  POSLoginSlideInput,
  LocalizedText,
} from '@/lib/api';
import {
  DevicePhoneMobileIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

const LANGS: { code: keyof LocalizedText; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'he', label: 'HE' },
];

export default function POSLoginScreenPage() {
  const [slides, setSlides] = useState<POSLoginSlide[]>([]);
  const [eyebrow, setEyebrow] = useState<LocalizedText>(emptyLocalizedText());
  const [eyebrowSaving, setEyebrowSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<POSLoginSlide | 'new' | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [slideRes, cfg] = await Promise.all([
        listPOSLoginSlides(),
        getPOSLoginConfig(),
      ]);
      setSlides(slideRes.slides || []);
      setEyebrow(cfg.eyebrow || emptyLocalizedText());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEyebrow() {
    setEyebrowSaving(true);
    setError('');
    try {
      const cfg = await updatePOSLoginConfig(eyebrow);
      setEyebrow(cfg.eyebrow);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setEyebrowSaving(false);
    }
  }

  async function handleDelete(slide: POSLoginSlide) {
    if (!window.confirm('Delete this slide? The image stays in S3.')) return;
    try {
      await deletePOSLoginSlide(slide.id);
      setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= slides.length) return;
    const reordered = [...slides];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setSlides(reordered);
    try {
      await reorderPOSLoginSlides(reordered.map((s) => s.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reorder failed');
      load();
    }
  }

  async function toggleActive(slide: POSLoginSlide) {
    try {
      const updated = await updatePOSLoginSlide(slide.id, {
        image_url: slide.image_url,
        headline: slide.headline,
        caption_title: slide.caption_title,
        caption_subtitle: slide.caption_subtitle,
        sort_order: slide.sort_order,
        is_active: !slide.is_active,
      });
      setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function onSaved(slide: POSLoginSlide) {
    setSlides((prev) => {
      const exists = prev.some((s) => s.id === slide.id);
      return exists ? prev.map((s) => (s.id === slide.id ? slide : s)) : [...prev, slide];
    });
    setEditing(null);
  }

  const previewSlide = slides.find((s) => s.is_active) || slides[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DevicePhoneMobileIcon className="w-7 h-7 text-brand-500" />
          POS Login Screen
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Curate the rotating photos and headlines shown on the foodypos login
          page. Managed globally by Foody — restaurants cannot change these.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Live preview */}
      <Preview eyebrow={eyebrow} slide={previewSlide} />

      {/* Eyebrow setting */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Eyebrow line</h2>
        <p className="text-xs text-gray-500 mb-4">
          Small label above the headline (e.g. &ldquo;Foody for restaurants&rdquo;).
        </p>
        <LocaleFields value={eyebrow} onChange={setEyebrow} placeholder="Foody for restaurants" />
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveEyebrow}
            disabled={eyebrowSaving}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg"
          >
            {eyebrowSaving ? 'Saving…' : 'Save eyebrow'}
          </button>
        </div>
      </section>

      {/* Slides */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Slides <span className="text-gray-400 font-normal">· {slides.length}</span>
        </h2>
        <button
          onClick={() => setEditing('new')}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add slide
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : slides.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <PhotoIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            No slides yet. The POS will show its built-in default slides until you add some.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-4"
            >
              {/* Reorder */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === slides.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDownIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Thumbnail */}
              <div className="w-28 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                {slide.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PhotoIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {slide.headline.en || <span className="text-gray-400">No headline</span>}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {slide.caption_title.en}
                  {slide.caption_subtitle.en ? ` — ${slide.caption_subtitle.en}` : ''}
                </div>
              </div>

              {/* Active toggle */}
              <button
                onClick={() => toggleActive(slide)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  slide.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {slide.is_active ? 'Active' : 'Hidden'}
              </button>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(slide)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                  title="Edit"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(slide)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SlideModal
          slide={editing === 'new' ? null : editing}
          nextSortOrder={slides.length}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

/** Three side-by-side inputs for editing a LocalizedText value. */
function LocaleFields({
  value,
  onChange,
  placeholder,
  textarea,
}: {
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {LANGS.map(({ code, label }) => (
        <div key={code}>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          {textarea ? (
            <textarea
              value={value[code]}
              dir={code === 'he' ? 'rtl' : 'ltr'}
              onChange={(e) => onChange({ ...value, [code]: e.target.value })}
              placeholder={code === 'en' ? placeholder : undefined}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          ) : (
            <input
              value={value[code]}
              dir={code === 'he' ? 'rtl' : 'ltr'}
              onChange={(e) => onChange({ ...value, [code]: e.target.value })}
              placeholder={code === 'en' ? placeholder : undefined}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Square-style split preview using the EN copy of one slide. */
function Preview({ eyebrow, slide }: { eyebrow: LocalizedText; slide?: POSLoginSlide }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Preview (English)</h2>
      <div className="flex rounded-xl overflow-hidden border border-gray-200 h-64">
        {/* Left photo */}
        <div className="relative w-1/2 bg-gray-200">
          {slide?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400">
              <PhotoIcon className="w-10 h-10 text-white/70" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-4 text-white">
            <div className="text-lg font-bold leading-tight">{slide?.caption_title.en}</div>
            <div className="text-xs text-white/80">{slide?.caption_subtitle.en}</div>
          </div>
        </div>
        {/* Right panel */}
        <div className="w-1/2 bg-black text-white p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 bg-brand-500 rounded-sm" />
            <span className="text-sm font-semibold">{eyebrow.en || 'Foody for restaurants'}</span>
          </div>
          <div className="text-2xl font-bold leading-snug">
            {slide?.headline.en || 'Add a slide to see the headline here'}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideModal({
  slide,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  slide: POSLoginSlide | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (slide: POSLoginSlide) => void;
}) {
  const [imageUrl, setImageUrl] = useState(slide?.image_url || '');
  const [headline, setHeadline] = useState<LocalizedText>(slide?.headline || emptyLocalizedText());
  const [captionTitle, setCaptionTitle] = useState<LocalizedText>(
    slide?.caption_title || emptyLocalizedText(),
  );
  const [captionSubtitle, setCaptionSubtitle] = useState<LocalizedText>(
    slide?.caption_subtitle || emptyLocalizedText(),
  );
  const [isActive, setIsActive] = useState(slide?.is_active ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadPOSLoginSlideImage(file);
      setImageUrl(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload: POSLoginSlideInput = {
      image_url: imageUrl,
      headline,
      caption_title: captionTitle,
      caption_subtitle: captionSubtitle,
      sort_order: slide?.sort_order ?? nextSortOrder,
      is_active: isActive,
    };
    try {
      const saved = slide
        ? await updatePOSLoginSlide(slide.id, payload)
        : await createPOSLoginSlide(payload);
      onSaved(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {slide ? 'Edit slide' : 'New slide'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Image */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Background photo</label>
            <div className="flex items-center gap-4">
              <div className="w-40 h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PhotoIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div>
                <label className="inline-block cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg">
                  {uploading ? 'Uploading…' : imageUrl ? 'Replace photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP. Max 5MB.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Headline</label>
            <LocaleFields
              value={headline}
              onChange={setHeadline}
              placeholder="A POS built for restaurants that run as a team"
              textarea
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Caption title <span className="text-gray-400 font-normal">(e.g. restaurant name)</span>
            </label>
            <LocaleFields value={captionTitle} onChange={setCaptionTitle} placeholder="junzi" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Caption subtitle <span className="text-gray-400 font-normal">(e.g. tagline)</span>
            </label>
            <LocaleFields
              value={captionSubtitle}
              onChange={setCaptionSubtitle}
              placeholder="A homestyle Chinese kitchen in New York City."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Active (shown on the POS)
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg"
            >
              {saving ? 'Saving…' : 'Save slide'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
