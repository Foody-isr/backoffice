import type { FoodyModule, FoodyPrivateBilling } from '@/lib/api';
import { foodyLicenceLabels, formatFoodyAmount } from '@/lib/foody-modules';

const statusClass = {
  pending: 'bg-amber-50 text-amber-900',
  trial: 'bg-blue-50 text-blue-800',
  active: 'bg-green-50 text-green-800',
  expired: 'bg-gray-100 text-gray-700',
};

const billingDate = new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium', timeZone: 'Asia/Jerusalem' });

/** Show the accepted terms, trial scope and access returned by the API. */
export default function FoodySubscriptionSummary({ billing, onboarding }: {
  billing: FoodyPrivateBilling;
  onboarding: NonNullable<FoodyPrivateBilling['onboarding']>;
}) {
  const { access, catalog, selection, licences, trial_days, trial_allowed } = onboarding;
  const statusTitle = {
    pending: trial_days ? 'Awaiting trial activation' : 'Awaiting payment',
    trial: 'Trial active',
    active: 'Subscription active',
    expired: 'Access expired',
  }[access.status];
  const offer = billing.accepted_offer ?? billing.offer;
  const cycle = billing.agreement?.cycle;
  const periods = !offer ? [] : (['monthly', 'annual'] as const).filter(period =>
    offer[period].total_minor > 0 && (!cycle || cycle === period),
  );
  const seats = foodyLicenceLabels(licences);
  const trialSeats = foodyLicenceLabels(access.seats);
  const names = (modules: FoodyModule[]) => catalog.products
    .filter(product => modules.includes(product.id))
    .map(product => product.name.en)
    .join(', ');

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Subscription &amp; modules</h2>
          <p className="mt-1 text-sm text-gray-600">
            {onboarding.mode === 'public' ? 'Public catalogue' : 'Custom offer'} <span className="text-gray-400">/</span> Sandbox
          </p>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass[access.status]}`}>{statusTitle}</span>
      </div>

      <div className="grid gap-5 border-y border-gray-200 py-4 md:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-gray-600">{billing.accepted_offer ? 'Accepted offer' : 'Offer'}</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{offer?.title ?? 'Awaiting the owner’s module selection'}</dd>
          </div>
          {offer && (
            <div>
              <dt className="text-gray-600">{billing.accepted_offer ? 'Agreed price' : 'Offered price'}</dt>
              <dd className="mt-0.5 space-y-1 font-medium tabular-nums text-gray-900">
                {periods.map(period => (
                  <div key={period}>
                    {formatFoodyAmount(offer.tax_mode === 'ht' ? offer[period].net_minor : offer[period].total_minor)}
                    {' '}{offer.tax_mode === 'ht' ? 'excl. VAT' : 'incl. VAT'} / {period === 'monthly' ? 'month' : 'year'}
                  </div>
                ))}
              </dd>
            </div>
          )}
          {billing.agreement && (
            <div>
              <dt className="text-gray-600">Paid through</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {billingDate.format(new Date(billing.agreement.period_end))}
                {billing.agreement.renews ? ' · Automatic renewal' : ' · Manual renewal'}
              </dd>
            </div>
          )}
          {trial_days > 0 && access.status !== 'active' && (
            <div>
              <dt className="text-gray-600">Trial</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {trial_days} days{access.trial_ends_at && ` · Ends ${billingDate.format(new Date(access.trial_ends_at))}`}
              </dd>
            </div>
          )}
        </dl>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-gray-600">Modules in the offer</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{selection.length ? names(selection) : 'Awaiting selection'}</dd>
            {seats.length > 0 && <dd className="mt-0.5 text-gray-600">{seats.join(', ')}</dd>}
          </div>
          <div>
            <dt className="text-gray-600">Active modules</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{access.modules.length ? names(access.modules) : 'No active modules'}</dd>
            {access.status === 'trial' && trialSeats.length > 0 && <dd className="mt-0.5 text-gray-600">{trialSeats.join(', ')}</dd>}
          </div>
          {trial_allowed.length > 0 && access.status !== 'active' && (
            <div>
              <dt className="text-gray-600">Modules allowed in the trial</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{names(trial_allowed)}</dd>
            </div>
          )}
        </dl>
      </div>
    </>
  );
}
