'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listIngredientIcons,
  generateIngredientIcon,
  deleteIngredientIcon,
  updateIngredientIcon,
  getIngredientIconPrompt,
  IngredientIcon,
} from '@/lib/api';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function IngredientIconsPage() {
  const [icons, setIcons] = useState<IngredientIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Generate form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [aliases, setAliases] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('');

  // Edit modal state
  const [editing, setEditing] = useState<IngredientIcon | null>(null);

  useEffect(() => {
    load();
  }, []);

  // Live prompt preview — purely informational, so the operator sees what
  // OpenAI will receive before paying for a generation.
  useEffect(() => {
    if (!name.trim()) {
      setPreviewPrompt('');
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      getIngredientIconPrompt(name.trim())
        .then((d) => {
          if (!cancelled) setPreviewPrompt(d.prompt);
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name]);

  async function load(q?: string) {
    setLoading(true);
    try {
      const data = await listIngredientIcons({ q });
      setIcons(data.icons || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const aliasList = aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      const icon = await generateIngredientIcon({
        name: name.trim(),
        category: category.trim() || undefined,
        aliases: aliasList.length ? aliasList : undefined,
      });
      setIcons((prev) => [icon, ...prev]);
      setName('');
      setCategory('');
      setAliases('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(icon: IngredientIcon) {
    if (!window.confirm(`Delete "${icon.name}"? Restaurants still using this image won't break — the file stays in S3.`)) return;
    try {
      await deleteIngredientIcon(icon.id);
      setIcons((prev) => prev.filter((i) => i.id !== icon.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    icons.forEach((i) => {
      const k = i.category || 'Uncategorized';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [icons]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SparklesIcon className="w-7 h-7 text-brand-500" />
          Ingredient Icons
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Global, AI-generated illustrations every restaurant can pick when assigning an image to a stock item.
        </p>
      </div>

      {/* Generate form */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Generate new icon</h2>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Name (English)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tomato"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Vegetable"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Aliases <span className="text-gray-400 font-normal">(comma-separated, fr/he/…)</span>
            </label>
            <input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="Tomate, עגבנייה"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              ~$0.04 per icon (gpt-image-1, high quality, transparent background)
            </p>
            <button
              type="submit"
              disabled={generating || !name.trim()}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg flex items-center gap-2"
            >
              {generating ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Generating…
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </form>
        {previewPrompt && (
          <details className="mt-4">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Preview prompt sent to OpenAI
            </summary>
            <p className="text-xs text-gray-600 mt-2 p-3 bg-gray-50 rounded-lg font-mono leading-relaxed">
              {previewPrompt}
            </p>
          </details>
        )}
      </section>

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load(search);
            }}
            placeholder="Search by name or category…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => load(search)}
          className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2"
        >
          Search
        </button>
        <span className="text-sm text-gray-500 ml-auto">{icons.length} icons</span>
      </div>

      {/* Category quick filters */}
      {categoryCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryCounts.map(([cat, count]) => (
            <span
              key={cat}
              className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1"
            >
              {cat} <span className="text-gray-400">· {count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : icons.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <SparklesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No icons yet. Generate your first one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {icons.map((icon) => (
            <div
              key={icon.id}
              className="group relative bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                {/* Using plain <img> since icon URLs come from S3 and aren't in next.config.images */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={icon.image_url}
                  alt={icon.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-sm font-medium text-gray-900 truncate">{icon.name}</div>
              {icon.category && (
                <div className="text-xs text-gray-500 truncate">{icon.category}</div>
              )}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => setEditing(icon)}
                  className="bg-white/90 backdrop-blur p-1.5 rounded-md hover:bg-white shadow-sm"
                  title="Edit metadata"
                >
                  <PencilSquareIcon className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={() => handleDelete(icon)}
                  className="bg-white/90 backdrop-blur p-1.5 rounded-md hover:bg-white shadow-sm"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditIconModal
          icon={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setIcons((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditIconModal({
  icon,
  onClose,
  onSaved,
}: {
  icon: IngredientIcon;
  onClose: () => void;
  onSaved: (icon: IngredientIcon) => void;
}) {
  const [name, setName] = useState(icon.name);
  const [category, setCategory] = useState(icon.category);
  const [aliases, setAliases] = useState((icon.aliases || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await updateIngredientIcon(icon.id, {
        name: name.trim(),
        category: category.trim(),
        aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
      });
      onSaved(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit icon</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-square w-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden mb-4 mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon.image_url} alt={icon.name} className="w-full h-full object-contain" />
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Aliases (comma-separated)</label>
            <input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
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
              disabled={saving}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

