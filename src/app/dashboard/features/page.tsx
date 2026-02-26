'use client';

import { useState, useEffect } from 'react';
import { getFeatureCatalog, FeatureMeta, PlanDefinition } from '@/lib/api';
import { categoryInfo, capitalize, planColor } from '@/lib/utils';
import { CheckCircleIcon, XCircleIcon, LinkIcon } from '@heroicons/react/24/solid';

export default function FeatureCatalogPage() {
  const [features, setFeatures] = useState<FeatureMeta[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeatureCatalog()
      .then((data) => {
        setFeatures(data.features);
        setPlans(data.plans);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500"></div>
      </div>
    );
  }

  // Group features by category
  const grouped = features.reduce<Record<string, FeatureMeta[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const planOrder = ['starter', 'premium', 'enterprise'] as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feature Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">
          All available features, their dependencies, and plan inclusion matrix
        </p>
      </div>

      {/* Plan overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {planOrder.map((tier) => {
          const plan = plans.find((p) => p.tier === tier);
          if (!plan) return null;
          return (
            <div key={tier} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${planColor(tier)}`}>
                  {capitalize(tier)}
                </span>
                <span className="text-lg font-bold text-gray-900">{plan.price}</span>
                <span className="text-xs text-gray-500">{plan.period}</span>
              </div>
              <p className="text-sm text-gray-600">{plan.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                {plan.order_limit === 0 ? 'Unlimited orders' : `Up to ${plan.order_limit} orders/mo`}
                {' · '}
                {plan.features.length} / {features.length} features
              </p>
            </div>
          );
        })}
      </div>

      {/* Feature matrix per category */}
      {Object.entries(grouped).map(([cat, catFeatures]) => {
        const info = categoryInfo(cat);
        return (
          <div key={cat} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{info.icon}</span>
              <h2 className="text-base font-semibold text-gray-900">{info.label}</h2>
              <span className="text-xs text-gray-400">({catFeatures.length})</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Feature</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Dependencies</th>
                    {planOrder.map((tier) => (
                      <th key={tier} className="text-center px-3 py-3 font-medium text-gray-600 w-24">
                        {capitalize(tier)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {catFeatures.map((f) => (
                    <tr key={f.key} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {f.always_on && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" title="Always on"></span>
                          )}
                          <span className="font-medium text-gray-900">
                            {f.key.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {f.always_on && (
                          <span className="text-[10px] text-green-600 font-medium uppercase tracking-wide">
                            Always on
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                        {f.description}
                      </td>
                      <td className="px-4 py-3">
                        {f.requires_all && f.requires_all.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {f.requires_all.map((dep: string) => (
                              <span
                                key={dep}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium"
                              >
                                <LinkIcon className="h-2.5 w-2.5" />
                                {dep.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      {planOrder.map((tier) => {
                        const plan = plans.find((p) => p.tier === tier);
                        const included = plan?.features.includes(f.key) ?? false;
                        return (
                          <td key={tier} className="text-center px-3 py-3">
                            {included ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircleIcon className="h-5 w-5 text-gray-200 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Legend</p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <CheckCircleIcon className="h-4 w-4 text-green-500" /> Included in plan
          </span>
          <span className="flex items-center gap-1">
            <XCircleIcon className="h-4 w-4 text-gray-200" /> Not included
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Always on (cannot be disabled)
          </span>
          <span className="flex items-center gap-1">
            <LinkIcon className="h-3 w-3 text-blue-500" /> Requires dependency
          </span>
        </div>
      </div>
    </div>
  );
}
