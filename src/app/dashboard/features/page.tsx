'use client';

import { useEffect, useState } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { getFeatureCatalog, type FeatureCatalog, type FoodyModule } from '@/lib/api';
import { foodyLicenceLabels, formatFoodyAmount } from '@/lib/foody-modules';

const moduleScope: Record<FoodyModule, string> = {
  restaurant: 'Point of sale, floor plan, table service and QR ordering at the table.',
  ordering: 'Online ordering site, pickup, delivery, order tracking and customer profiles.',
  kitchen: 'Recipes, stock, food cost, supplier deliveries, forecasting and kitchen display.',
};

export default function PlansAndModulesPage() {
  const [catalog, setCatalog] = useState<FeatureCatalog | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    getFeatureCatalog(request.signal).then(setCatalog, () => {
      if (!request.signal.aborted) setLoadFailed(true);
    });
    return () => request.abort();
  }, [attempt]);

  const software = catalog?.software_catalog;
  const moduleFeatures = catalog?.features.filter(feature =>
    software?.products.some(product => product.features.includes(feature.key)),
  ) ?? [];

  function retry() {
    setLoadFailed(false);
    setCatalog(null);
    setAttempt(attempt + 1);
  }

  return (
    <div className="max-w-screen-xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Plans &amp; modules</h1>
          <p className="mt-1 text-sm text-gray-600">Public software prices per location, excluding VAT.</p>
        </div>
        <a href="https://foody-pos.co.il/en/pricing" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
          View public pricing
        </a>
      </header>

      {loadFailed || (catalog && !software) ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          <p>The current software catalogue could not be loaded.</p>
          <button type="button" className="btn-secondary" onClick={retry}>Retry</button>
        </div>
      ) : !software ? (
        <p role="status" className="text-sm text-gray-600">Loading the software catalogue…</p>
      ) : (
        <>
          <section aria-label="Public software modules" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="grid divide-y divide-gray-200 md:grid-cols-3 md:divide-x md:divide-y-0">
              {software.products.map(product => {
                const licences = foodyLicenceLabels(product.included);
                return (
                  <div key={product.id} className="p-5">
                    <h2 className="font-semibold text-gray-900">{product.name.en}</h2>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
                      {formatFoodyAmount(product.monthly_minor)} <span className="text-sm font-normal text-gray-600">/ month</span>
                    </p>
                    <p className="mt-2 max-w-xs text-sm text-gray-600">{moduleScope[product.id]}</p>
                    {licences.length > 0 && <p className="mt-3 text-sm font-medium text-gray-900">{licences.join(' and ')} included</p>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 text-sm">
              <span>Additional named POS licence</span>
              <strong className="tabular-nums">{formatFoodyAmount(software.extra_pos_minor)} / month</strong>
            </div>
          </section>

          <section aria-labelledby="module-flags-heading">
            <h2 id="module-flags-heading" className="text-lg font-semibold text-gray-900">Feature flags by module</h2>
            <p className="mt-1 text-sm text-gray-600">Staff access also depends on their role and the restaurant’s settings.</p>
            <div className="table-scroll mt-3" role="region" aria-label="Feature flags comparison" tabIndex={0}>
              <table className="data-table min-w-[40rem]">
                <thead>
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Feature</th>
                    {software.products.map(product => (
                      <th scope="col" key={product.id} className="w-36 px-3 py-3 text-center font-semibold">{product.name.en}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {moduleFeatures.map(feature => (
                    <tr key={feature.key}>
                      <th scope="row" className="px-5 py-3 text-left font-medium text-gray-900">
                        {feature.label}
                        <span className="mt-0.5 block text-xs font-normal text-gray-600">{feature.description}</span>
                      </th>
                      {software.products.map(product => (
                        <td key={product.id} className="px-3 py-3 text-center">
                          {product.features.includes(feature.key) ? (
                            <span className="inline-flex items-center gap-1 text-green-800">
                              <CheckIcon className="size-4" aria-hidden="true" /> Included
                            </span>
                          ) : <span className="text-gray-500" aria-label="Not included">–</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
