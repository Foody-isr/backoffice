import type { FeatureCatalog, FeatureKey, FeatureMeta, RestaurantFeature } from '@/lib/api';
import { categoryInfo } from '@/lib/utils';

function groupFeatures(catalog: FeatureCatalog, modular: boolean) {
  if (modular) {
    if (!catalog.software_catalog) return [];
    const products = catalog.software_catalog.products;
    const memberships = (feature: FeatureMeta) => products.filter(product => product.features.includes(feature.key));
    return [
      ...products.map(product => ({
        label: product.name.en,
        items: catalog.features.filter(feature => memberships(feature).length === 1 && product.features.includes(feature.key)),
      })),
      { label: 'Shared by modules', items: catalog.features.filter(feature => memberships(feature).length > 1) },
      { label: 'Other feature flags', items: catalog.features.filter(feature => memberships(feature).length === 0) },
    ];
  }
  const groups: Record<string, FeatureMeta[]> = {};
  for (const feature of catalog.features) (groups[feature.category] ??= []).push(feature);
  return Object.entries(groups).map(([category, items]) => ({ label: categoryInfo(category).label, items }));
}

/** Show effective module flags or edit settings for an existing legacy contract. */
export default function RestaurantFeatureAccess({ catalog, features, modular, saving, onToggle }: {
  catalog: FeatureCatalog;
  features: RestaurantFeature[];
  modular: boolean;
  saving: string | null;
  onToggle: (feature: FeatureKey, enabled: boolean) => void;
}) {
  const groups = groupFeatures(catalog, modular);
  const names = new Map(catalog.features.map(feature => [feature.key, feature.label]));
  const enabledKeys = new Set(features.filter(feature => feature.enabled).map(feature => feature.feature_key));

  return (
    <section className="space-y-4" aria-labelledby="feature-access-heading">
      <div>
        <h2 id="feature-access-heading" className="text-lg font-semibold text-gray-900">Feature access</h2>
        <p className="mt-1 text-sm text-gray-600">
          {modular
            ? 'The current trial or paid subscription controls these flags. Staff permissions and restaurant settings still apply.'
            : 'These flags apply to the restaurant’s existing contract. Saving a flag also applies its dependencies.'}
        </p>
      </div>

      {modular && !catalog.software_catalog && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Module assignments could not be loaded.</p>
      )}
      {groups.filter(group => group.items.length > 0).map(group => (
        <div key={group.label} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <h3 className="border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-900">{group.label}</h3>
          <ul className="divide-y divide-gray-100">
            {group.items.map(feature => {
              const enabled = enabledKeys.has(feature.key);
              const dependencies = !modular && feature.requires_all?.map(key => names.get(key) ?? key).join(', ');
              const modules = modular && catalog.software_catalog?.products.filter(product => product.features.includes(feature.key));

              return (
                <li key={feature.key} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{feature.label}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{feature.description}</p>
                    {modules && modules.length > 1 && (
                      <p className="mt-1 text-xs text-gray-600">{modules.map(product => product.name.en).join(' · ')}</p>
                    )}
                    {dependencies && <p className="mt-1 text-xs text-amber-800">Requires {dependencies}</p>}
                  </div>
                  {modular || feature.always_on ? (
                    <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${enabled || !modular ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                      {modular ? (enabled ? 'Active' : 'Locked') : 'Always on'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={feature.label}
                      disabled={saving !== null}
                      onClick={() => onToggle(feature.key, !enabled)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${enabled ? 'bg-brand-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
