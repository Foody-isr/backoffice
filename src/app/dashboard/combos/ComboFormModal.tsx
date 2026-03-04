'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  createCombo,
  updateCombo,
  fetchMenuItems,
  ComboMenu,
  ComboInput,
  MenuCategory,
} from '@/lib/api';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

// ─── Internal types for form state ─────────────────────────────────

interface StepItemDraft {
  menu_item_id: number;
  menu_item_name: string;
  price_delta: number;
}

interface StepDraft {
  name: string;
  min_picks: number;
  max_picks: number;
  items: StepItemDraft[];
}

// ─── Props ──────────────────────────────────────────────────────────

interface Props {
  restaurantId: number;
  combo: ComboMenu | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

export default function ComboFormModal({ restaurantId, combo, onClose, onSaved }: Props) {
  // Form fields
  const [name, setName] = useState(combo?.name ?? '');
  const [description, setDescription] = useState(combo?.description ?? '');
  const [price, setPrice] = useState(combo?.price ?? 0);
  const [imageUrl, setImageUrl] = useState(combo?.image_url ?? '');
  const [isActive, setIsActive] = useState(combo?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(combo?.sort_order ?? 0);
  const [steps, setSteps] = useState<StepDraft[]>(() => {
    if (!combo?.steps?.length) return [];
    return combo.steps.map((s) => ({
      name: s.name,
      min_picks: s.min_picks,
      max_picks: s.max_picks,
      items: (s.items || []).map((item) => ({
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item?.name ?? `Item #${item.menu_item_id}`,
        price_delta: item.price_delta,
      })),
    }));
  });

  // Menu items for picker
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  // Submission
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load menu items on mount
  useEffect(() => {
    fetchMenuItems(restaurantId)
      .then(setMenuCategories)
      .catch(() => setMenuCategories([]))
      .finally(() => setMenuLoading(false));
  }, [restaurantId]);

  // ─── Step helpers ──────────────────────────────────────────────────

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      { name: '', min_picks: 1, max_picks: 1, items: [] },
    ]);
  }, []);

  const removeStep = useCallback((idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const moveStep = useCallback((idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }, []);

  const updateStep = useCallback(
    (idx: number, patch: Partial<StepDraft>) => {
      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    },
    []
  );

  // ─── Item helpers ─────────────────────────────────────────────────

  const addItemToStep = useCallback(
    (stepIdx: number, menuItemId: number, menuItemName: string) => {
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i !== stepIdx) return s;
          if (s.items.some((it) => it.menu_item_id === menuItemId)) return s;
          return {
            ...s,
            items: [...s.items, { menu_item_id: menuItemId, menu_item_name: menuItemName, price_delta: 0 }],
          };
        })
      );
    },
    []
  );

  const removeItemFromStep = useCallback((stepIdx: number, itemIdx: number) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== stepIdx) return s;
        return { ...s, items: s.items.filter((_, j) => j !== itemIdx) };
      })
    );
  }, []);

  const updateItemDelta = useCallback((stepIdx: number, itemIdx: number, delta: number) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== stepIdx) return s;
        return {
          ...s,
          items: s.items.map((it, j) => (j === itemIdx ? { ...it, price_delta: delta } : it)),
        };
      })
    );
  }, []);

  // ─── Submit ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    if (price <= 0) { setError('Price must be greater than 0.'); return; }
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].name.trim()) { setError(`Step ${i + 1} needs a name.`); return; }
      if (steps[i].items.length === 0) { setError(`Step "${steps[i].name}" has no items.`); return; }
      if (steps[i].max_picks < steps[i].min_picks) {
        setError(`Step "${steps[i].name}": max picks must be >= min picks.`);
        return;
      }
    }

    const input: ComboInput = {
      name: name.trim(),
      description: description.trim(),
      price,
      image_url: imageUrl.trim() || undefined,
      is_active: isActive,
      sort_order: sortOrder,
      steps: steps.map((s, i) => ({
        name: s.name.trim(),
        min_picks: s.min_picks,
        max_picks: s.max_picks,
        sort_order: i,
        items: s.items.map((it) => ({
          menu_item_id: it.menu_item_id,
          price_delta: it.price_delta,
        })),
      })),
    };

    setSaving(true);
    try {
      if (combo) {
        await updateCombo(restaurantId, combo.id, input);
      } else {
        await createCombo(restaurantId, input);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {combo ? 'Edit Combo' : 'New Combo'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Business Lunch"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="3 salads + 1 main + 1 side"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₪) *</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Steps</h3>
              <button
                type="button"
                onClick={addStep}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>

            {steps.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
                No steps yet. Add a step to define what guests pick.
              </p>
            )}

            <div className="space-y-4">
              {steps.map((step, stepIdx) => (
                <StepEditor
                  key={stepIdx}
                  step={step}
                  stepIdx={stepIdx}
                  stepsCount={steps.length}
                  menuCategories={menuCategories}
                  menuLoading={menuLoading}
                  onUpdate={(patch) => updateStep(stepIdx, patch)}
                  onRemove={() => removeStep(stepIdx)}
                  onMove={(dir) => moveStep(stepIdx, dir)}
                  onAddItem={(id, name) => addItemToStep(stepIdx, id, name)}
                  onRemoveItem={(idx) => removeItemFromStep(stepIdx, idx)}
                  onUpdateDelta={(idx, d) => updateItemDelta(stepIdx, idx, d)}
                />
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
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
            {saving ? 'Saving…' : combo ? 'Update Combo' : 'Create Combo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step Editor Sub-component ──────────────────────────────────────

interface StepEditorProps {
  step: StepDraft;
  stepIdx: number;
  stepsCount: number;
  menuCategories: MenuCategory[];
  menuLoading: boolean;
  onUpdate: (patch: Partial<StepDraft>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddItem: (id: number, name: string) => void;
  onRemoveItem: (idx: number) => void;
  onUpdateDelta: (idx: number, delta: number) => void;
}

function StepEditor({
  step,
  stepIdx,
  stepsCount,
  menuCategories,
  menuLoading,
  onUpdate,
  onRemove,
  onMove,
  onAddItem,
  onRemoveItem,
  onUpdateDelta,
}: StepEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      {/* Step header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-400 font-mono w-6">#{stepIdx + 1}</span>
        <input
          type="text"
          value={step.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g. Choose Salads"
          className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-brand-500 outline-none bg-white"
        />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={stepIdx === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move up"
          >
            <ChevronUpIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={stepIdx === stepsCount - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move down"
          >
            <ChevronDownIcon className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 rounded transition"
          title="Remove step"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Min / Max picks */}
      <div className="flex gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500">Min picks</label>
          <input
            type="number"
            min={0}
            value={step.min_picks}
            onChange={(e) => onUpdate({ min_picks: parseInt(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border border-gray-200 rounded text-sm bg-white focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Max picks</label>
          <input
            type="number"
            min={0}
            value={step.max_picks}
            onChange={(e) => onUpdate({ max_picks: parseInt(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border border-gray-200 rounded text-sm bg-white focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-1.5 mb-3">
        {step.items.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 text-center">No items added yet.</p>
        ) : (
          step.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-1.5">
              <span className="flex-1 text-sm text-gray-800">{item.menu_item_name}</span>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-400">+₪</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.price_delta}
                  onChange={(e) => onUpdateDelta(idx, parseFloat(e.target.value) || 0)}
                  className="w-16 px-1.5 py-0.5 border border-gray-200 rounded text-xs text-right bg-white focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem(idx)}
                className="p-0.5 text-gray-400 hover:text-red-500"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add items button + dropdown picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((p) => !p)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add menu items
        </button>

        {pickerOpen && (
          <MenuItemPicker
            categories={menuCategories}
            loading={menuLoading}
            selectedIds={step.items.map((i) => i.menu_item_id)}
            onSelect={(id, itemName) => onAddItem(id, itemName)}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Menu Item Picker Dropdown ──────────────────────────────────────

interface MenuItemPickerProps {
  categories: MenuCategory[];
  loading: boolean;
  selectedIds: number[];
  onSelect: (id: number, name: string) => void;
  onClose: () => void;
}

function MenuItemPicker({ categories, loading, selectedIds, onSelect, onClose }: MenuItemPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) =>
          it.name.toLowerCase().includes(search.toLowerCase()) && !selectedIds.includes(it.id)
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-80 max-h-64 overflow-hidden flex flex-col">
      <div className="p-2 border-b border-gray-100 flex gap-2">
        <input
          type="text"
          autoFocus
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-brand-500 outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          Done
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Loading menu…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {search ? 'No matching items' : 'No items available'}
          </p>
        ) : (
          filtered.map((cat) => (
            <div key={cat.id}>
              <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 sticky top-0">
                {cat.name}
              </div>
              {cat.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id, item.name)}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-brand-50 flex justify-between"
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-gray-400">₪{item.price}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
