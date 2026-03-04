'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  listRestaurants,
  listCombos,
  deleteCombo,
  Restaurant,
  ComboMenu,
} from '@/lib/api';
import { formatShortDate } from '@/lib/utils';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import ComboFormModal from './ComboFormModal';

export default function CombosPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [combos, setCombos] = useState<ComboMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [combosLoading, setCombosLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboMenu | null>(null);

  // Load restaurants on mount
  useEffect(() => {
    listRestaurants()
      .then((d) => {
        setRestaurants(d.restaurants || []);
        if (d.restaurants?.length) {
          setSelectedRestaurantId(d.restaurants[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load combos when restaurant changes
  const loadCombos = useCallback(async () => {
    if (!selectedRestaurantId) return;
    setCombosLoading(true);
    try {
      const data = await listCombos(selectedRestaurantId);
      setCombos(data.combos || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load combos');
    } finally {
      setCombosLoading(false);
    }
  }, [selectedRestaurantId]);

  useEffect(() => {
    loadCombos();
  }, [loadCombos]);

  async function handleDelete(combo: ComboMenu) {
    if (!selectedRestaurantId) return;
    if (!confirm(`Delete "${combo.name}"? This cannot be undone.`)) return;
    try {
      await deleteCombo(selectedRestaurantId, combo.id);
      loadCombos();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function openCreate() {
    setEditingCombo(null);
    setModalOpen(true);
  }

  function openEdit(combo: ComboMenu) {
    setEditingCombo(combo);
    setModalOpen(true);
  }

  function handleSaved() {
    setModalOpen(false);
    setEditingCombo(null);
    loadCombos();
  }

  const filtered = search
    ? combos.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : combos;

  if (error) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combo Menus</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage fixed-price combo deals for restaurants
          </p>
        </div>
      </div>

      {/* Restaurant picker */}
      <div className="mb-6 flex gap-4 items-end">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Restaurant
          </label>
          {loading ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedRestaurantId ?? ''}
              onChange={(e) => setSelectedRestaurantId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (#{r.id})
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedRestaurantId && (
          <>
            <div className="relative max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter combos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
            >
              <PlusIcon className="w-4 h-4" />
              New Combo
            </button>
          </>
        )}
      </div>

      {/* Combos table */}
      {combosLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : !selectedRestaurantId ? (
        <p className="text-gray-500 text-center py-12">Select a restaurant to manage combos</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No combos yet for this restaurant</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition"
          >
            <PlusIcon className="w-4 h-4" />
            Create First Combo
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">ID</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Price</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Steps</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Created</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((combo) => (
                <tr key={combo.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{combo.id}</td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{combo.name}</span>
                      {combo.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                          {combo.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    ₪{combo.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(combo.steps || []).map((step, i) => (
                        <span
                          key={i}
                          className="inline-block text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full"
                        >
                          {step.name} ({step.min_picks}–{step.max_picks})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        combo.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {combo.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {combo.created_at ? formatShortDate(combo.created_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(combo)}
                        className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(combo)}
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

      {/* Create / Edit Modal */}
      {modalOpen && selectedRestaurantId && (
        <ComboFormModal
          restaurantId={selectedRestaurantId}
          combo={editingCombo}
          onClose={() => { setModalOpen(false); setEditingCombo(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
