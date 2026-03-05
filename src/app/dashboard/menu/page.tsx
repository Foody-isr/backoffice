'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  listRestaurants,
  fetchMenuFull,
  bulkCreateModifiers,
  deleteModifier,
  type Restaurant,
  type MenuCategoryFull,
  type MenuItemFull,
  type MenuItemModifier,
} from '@/lib/api';

// ─── Size Variants Modal ─────────────────────────────────────────

function SizeVariantsModal({
  item,
  restaurantId,
  onClose,
  onCreated,
}: {
  item: MenuItemFull;
  restaurantId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [unitLabel, setUnitLabel] = useState('pieces');
  const [baseQty, setBaseQty] = useState(6);
  const [pricePerUnit, setPricePerUnit] = useState(
    baseQty > 0 ? +(item.price / baseQty).toFixed(2) : 0
  );
  const [newQty, setNewQty] = useState('');
  const [quantities, setQuantities] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Recalculate price per unit when base qty changes
  useEffect(() => {
    if (baseQty > 0) {
      setPricePerUnit(+(item.price / baseQty).toFixed(2));
    }
  }, [baseQty, item.price]);

  const addQty = () => {
    const q = parseInt(newQty, 10);
    if (!q || q <= 0) return;
    if (q === baseQty) {
      setError('Must differ from base quantity');
      return;
    }
    if (quantities.includes(q)) {
      setError('Already added');
      return;
    }
    setQuantities((prev) => [...prev, q].sort((a, b) => a - b));
    setNewQty('');
    setError('');
  };

  const previews = quantities.map((qty) => {
    const total = pricePerUnit * qty;
    const delta = total - item.price;
    return { qty, name: `${qty} ${unitLabel}`, delta, total };
  });

  const generate = async () => {
    if (quantities.length === 0) {
      setError('Add at least one quantity');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const mods = previews.map((p, i) => ({
        menu_item_id: item.id,
        name: p.name,
        action: 'add',
        category: 'Size',
        price_delta: +p.delta.toFixed(2),
        is_active: true,
        sort_order: i + 1,
      }));
      await bulkCreateModifiers(restaurantId, mods);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed';
      setError(message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1e1e2e] rounded-xl w-full max-w-lg p-6 text-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <div>
            <h2 className="text-lg font-bold">Size Variants Generator</h2>
            <p className="text-xs text-gray-400">
              Auto-generate modifiers for different portion sizes
            </p>
          </div>
        </div>

        {/* Unit label */}
        <div>
          <label className="text-sm text-gray-400">Unit label</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-lg bg-[#2a2a3e] border border-white/10 text-sm"
            value={unitLabel}
            onChange={(e) => setUnitLabel(e.target.value)}
            placeholder="e.g., pieces, slices"
          />
        </div>

        {/* Base qty + price per unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400">Base quantity</label>
            <input
              type="number"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[#2a2a3e] border border-white/10 text-sm"
              value={baseQty}
              onChange={(e) => setBaseQty(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Price per unit</label>
            <input
              type="number"
              step="0.01"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[#2a2a3e] border border-white/10 text-sm"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Current price: ₪{item.price.toFixed(2)} ({baseQty} ×
          ₪{pricePerUnit.toFixed(2)})
        </p>

        {/* Add quantities */}
        <div>
          <label className="text-sm text-gray-400">Additional quantities</label>
          <div className="flex gap-2 mt-1">
            <input
              type="number"
              className="flex-1 px-3 py-2 rounded-lg bg-[#2a2a3e] border border-white/10 text-sm"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="e.g., 8"
              onKeyDown={(e) => e.key === 'Enter' && addQty()}
            />
            <button
              onClick={addQty}
              className="px-4 py-2 bg-brand-600 rounded-lg text-sm font-medium hover:bg-brand-500"
            >
              Add
            </button>
          </div>
        </div>

        {/* Chips */}
        {quantities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quantities.map((q) => (
              <span
                key={q}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-600/20 text-brand-300 text-sm"
              >
                {q}
                <button
                  onClick={() =>
                    setQuantities(quantities.filter((x) => x !== q))
                  }
                  className="hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Preview */}
        {previews.length > 0 && (
          <div>
            <label className="text-sm text-gray-400">Preview</label>
            <div className="mt-1 rounded-lg bg-[#2a2a3e] divide-y divide-white/5">
              {previews.map((p) => (
                <div
                  key={p.qty}
                  className="flex justify-between px-4 py-2 text-sm"
                >
                  <span className="text-green-400">+ {p.name}</span>
                  <span>
                    +₪{p.delta.toFixed(2)}{' '}
                    <span className="text-gray-500">
                      (total: ₪{p.total.toFixed(2)})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={saving || quantities.length === 0}
            className="px-4 py-2 bg-brand-600 rounded-lg text-sm font-medium hover:bg-brand-500 disabled:opacity-40"
          >
            {saving ? 'Creating...' : `Generate ${previews.length} modifiers`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function MenuManagerPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | null>(
    null
  );
  const [categories, setCategories] = useState<MenuCategoryFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [variantsItem, setVariantsItem] = useState<MenuItemFull | null>(null);

  useEffect(() => {
    listRestaurants().then((d) => {
      setRestaurants(d.restaurants || []);
    });
  }, []);

  const loadMenu = useCallback(async (rid: number) => {
    setLoading(true);
    try {
      const cats = await fetchMenuFull(rid);
      setCategories(cats);
    } catch {
      setCategories([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedRestaurant) loadMenu(selectedRestaurant);
  }, [selectedRestaurant, loadMenu]);

  const handleDeleteModifier = async (modId: number) => {
    if (!selectedRestaurant) return;
    if (!confirm('Delete this modifier?')) return;
    try {
      await deleteModifier(selectedRestaurant, modId);
      loadMenu(selectedRestaurant);
    } catch {
      // Error handled silently
    }
  };

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);
  const totalModifiers = categories.reduce(
    (s, c) =>
      s + c.items.reduce((si, item) => si + (item.modifiers?.length || 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Menu Manager</h1>
        <p className="text-gray-400">
          View menu items, manage modifiers, and generate size variants
        </p>
      </div>

      {/* Restaurant picker */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-400">Restaurant:</label>
        <select
          className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/10 text-sm min-w-[240px]"
          value={selectedRestaurant || ''}
          onChange={(e) =>
            setSelectedRestaurant(parseInt(e.target.value, 10) || null)
          }
        >
          <option value="">Select a restaurant...</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} (ID: {r.id})
            </option>
          ))}
        </select>
      </div>

      {!selectedRestaurant && (
        <div className="text-center py-20 text-gray-500">
          Select a restaurant to view its menu
        </div>
      )}

      {selectedRestaurant && loading && (
        <div className="text-center py-20 text-gray-500">Loading menu...</div>
      )}

      {selectedRestaurant && !loading && (
        <>
          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="px-4 py-2 rounded-lg bg-[#1a1a2e] border border-white/10">
              <span className="text-gray-400">Categories:</span>{' '}
              <span className="font-bold">{categories.length}</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a2e] border border-white/10">
              <span className="text-gray-400">Items:</span>{' '}
              <span className="font-bold">{totalItems}</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-[#1a1a2e] border border-white/10">
              <span className="text-gray-400">Modifiers:</span>{' '}
              <span className="font-bold">{totalModifiers}</span>
            </div>
          </div>

          {/* Category list */}
          {categories.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              This restaurant has no menu items yet.
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-xl bg-[#1a1a2e] border border-white/10 overflow-hidden"
                >
                  <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-semibold">{cat.name}</h3>
                    <span className="text-xs text-gray-500">
                      {cat.items.length} items
                    </span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {cat.items.map((item) => {
                      const mods = item.modifiers || [];
                      const isExpanded = expandedItem === item.id;
                      return (
                        <div key={item.id}>
                          <button
                            onClick={() =>
                              setExpandedItem(isExpanded ? null : item.id)
                            }
                            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <span className="font-medium">{item.name}</span>
                                {item.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              {!item.is_active && (
                                <span className="text-xs px-2 py-0.5 rounded bg-yellow-600/20 text-yellow-400">
                                  Hidden
                                </span>
                              )}
                              {mods.length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded bg-brand-600/20 text-brand-300">
                                  {mods.length} mod{mods.length > 1 ? 's' : ''}
                                </span>
                              )}
                              <span className="font-semibold tabular-nums">
                                ₪{item.price.toFixed(2)}
                              </span>
                              <svg
                                className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-5 py-3 bg-[#16162a] border-t border-white/5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-400">
                                  Modifiers
                                </span>
                                <button
                                  onClick={() => setVariantsItem(item)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-600/20 text-brand-300 rounded-lg text-xs hover:bg-brand-600/30 transition"
                                >
                                  ✨ Generate Size Variants
                                </button>
                              </div>

                              {mods.length === 0 ? (
                                <p className="text-sm text-gray-600 py-2">
                                  No modifiers.{' '}
                                  <button
                                    onClick={() => setVariantsItem(item)}
                                    className="text-brand-400 hover:underline"
                                  >
                                    Generate size variants
                                  </button>
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {mods.map((mod) => (
                                    <div
                                      key={mod.id}
                                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1a1a2e] text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={
                                            mod.action === 'add'
                                              ? 'text-green-400'
                                              : 'text-red-400'
                                          }
                                        >
                                          {mod.action === 'add' ? '+' : '−'}
                                        </span>
                                        <span>{mod.name}</span>
                                        {mod.category && (
                                          <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                                            {mod.category}
                                          </span>
                                        )}
                                        {!mod.is_active && (
                                          <span className="text-xs text-yellow-500">
                                            (hidden)
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="tabular-nums">
                                          {mod.price_delta > 0 ? '+' : ''}₪
                                          {mod.price_delta.toFixed(2)}
                                        </span>
                                        <button
                                          onClick={() =>
                                            handleDeleteModifier(mod.id)
                                          }
                                          className="text-red-400 hover:text-red-300 text-xs"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Size Variants Modal */}
      {variantsItem && selectedRestaurant && (
        <SizeVariantsModal
          item={variantsItem}
          restaurantId={selectedRestaurant}
          onClose={() => setVariantsItem(null)}
          onCreated={() => loadMenu(selectedRestaurant)}
        />
      )}
    </div>
  );
}
