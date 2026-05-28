'use client';

import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface StringListFieldProps {
  label: string;
  hint?: string;
  values: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}

/**
 * Add/remove-row editor for a list of free-text strings.
 * Used by SegmentFormModal (pain points, key features, disqualifiers)
 * and ProspectFormModal (what we offered, loved, did not love).
 */
export default function StringListField({
  label,
  hint,
  values,
  placeholder,
  onChange,
}: StringListFieldProps) {
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
