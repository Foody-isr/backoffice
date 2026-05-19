'use client';

import { ProspectStatus, ProspectCloseReason } from '@/lib/api';

const statusStyles: Record<ProspectStatus, { label: string; chip: string }> = {
  researching: { label: 'Researching', chip: 'bg-gray-100 text-gray-700' },
  pitched:     { label: 'Pitched',     chip: 'bg-blue-100 text-blue-700' },
  won:         { label: 'Won',         chip: 'bg-green-100 text-green-700' },
  lost:        { label: 'Lost',        chip: 'bg-red-100 text-red-700' },
  on_hold:     { label: 'On hold',     chip: 'bg-yellow-100 text-yellow-800' },
};

const closeReasonLabels: Record<Exclude<ProspectCloseReason, ''>, string> = {
  price:             'Price',
  competitor_won:    'Competitor won',
  feature_gap:       'Feature gap',
  timing:            'Timing',
  no_decision_maker: 'No decision-maker reached',
  ghosted:           'Ghosted',
  other:             'Other',
};

export function statusLabel(s: ProspectStatus): string {
  return statusStyles[s].label;
}

export function closeReasonLabel(r: ProspectCloseReason): string {
  if (!r) return '';
  return closeReasonLabels[r];
}

export default function ProspectStatusChip({ status }: { status: ProspectStatus }) {
  const { label, chip } = statusStyles[status];
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${chip}`}>
      {label}
    </span>
  );
}
