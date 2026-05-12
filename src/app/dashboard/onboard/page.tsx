'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  onboardRestaurant,
  getFeatureCatalog,
  sendInviteEmail,
  OnboardInput,
  PlanDefinition,
  PlanTier,
} from '@/lib/api';
import { planColor, capitalize } from '@/lib/utils';

type SetupMode = 'invite' | 'manual';

export default function OnboardPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    restaurant: any;
    tempPassword?: string;
    mode: SetupMode;
  } | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  const [setupMode, setSetupMode] = useState<SetupMode>('invite');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [planTier, setPlanTier] = useState<PlanTier>('starter');

  useEffect(() => {
    getFeatureCatalog().then((data) => setPlans(data.plans));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const input: OnboardInput = {
      restaurant_name: setupMode === 'manual' ? restaurantName.trim() : '',
      owner_email: ownerEmail,
      plan_tier: planTier,
    };
    if (setupMode === 'manual') {
      input.owner_password = ownerPassword;
    }

    try {
      const data = await onboardRestaurant(input);
      setSuccess({
        restaurant: data.restaurant,
        tempPassword: data.temporary_password,
        mode: setupMode,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = plans.find((p) => p.tier === planTier);
  const submitDisabled =
    loading ||
    !ownerEmail.trim() ||
    (setupMode === 'manual' && ownerPassword.length < 8);

  // ─── Success screen ────────────────────────────────────────────────
  if (success) {
    const isManual = success.mode === 'manual';
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isManual ? 'Restaurant Created' : 'Invitation Sent!'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isManual ? (
              <>
                The account for <strong>{ownerEmail}</strong> is ready. Share the
                credentials below with the owner so they can sign in.
              </>
            ) : (
              <>
                An onboarding email has been sent to <strong>{ownerEmail}</strong>.
                They will complete their restaurant setup from the link in the email.
              </>
            )}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-green-900">
                  {isManual ? 'Account ready' : 'Onboarding email sent'}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {isManual
                    ? 'The owner can sign in immediately with the credentials below.'
                    : 'The owner will set their password, fill in restaurant details, and choose their POS platform.'}
                </p>
              </div>
            </div>
          </div>

          {(success.tempPassword || isManual) && (
            <div className="pb-6 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                {isManual ? 'Owner Credentials' : 'Temporary Credentials (for demo setup)'}
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-white px-3 py-2 rounded border border-gray-200 font-mono">
                      {ownerEmail}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(ownerEmail)}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {isManual ? 'Password' : 'Temporary Password'}
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-white px-3 py-2 rounded border border-gray-200 font-mono">
                      {isManual ? ownerPassword : success.tempPassword}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          isManual ? ownerPassword : success.tempPassword || ''
                        )
                      }
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              {!isManual && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <strong>Note:</strong> This is a temporary password for demo access.
                    The owner will set their own password via the onboarding email.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resend invite (only meaningful for invite mode) */}
          {!isManual && (
            <div className="pb-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={inviteSending}
                  onClick={async () => {
                    const ownerId = success.restaurant?.owner_id;
                    if (!ownerId) return;
                    setInviteSending(true);
                    setInviteStatus('idle');
                    try {
                      await sendInviteEmail(ownerId);
                      setInviteStatus('sent');
                    } catch {
                      setInviteStatus('error');
                    } finally {
                      setInviteSending(false);
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {inviteSending ? 'Sending...' : 'Resend Invite Email'}
                </button>
                {inviteStatus === 'sent' && (
                  <span className="text-sm text-green-600 font-medium">Sent!</span>
                )}
                {inviteStatus === 'error' && (
                  <span className="text-sm text-red-600 font-medium">Failed to send</span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/restaurants/${success.restaurant.id}`)}
              className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm"
            >
              View Restaurant
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setOwnerEmail('');
                setRestaurantName('');
                setOwnerPassword('');
                setPlanTier('starter');
                setInviteStatus('idle');
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              Onboard Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Onboard New Restaurant</h1>
        <p className="text-sm text-gray-500 mt-1">
          {setupMode === 'invite'
            ? "Enter the owner's email and select a plan. They'll receive an onboarding email to set up their account, restaurant details, and POS."
            : "Set up the restaurant and account yourself. The owner can sign in immediately with the credentials you choose."}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Setup mode */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Setup Mode</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSetupMode('invite')}
              className={`p-4 rounded-xl border-2 text-left transition ${
                setupMode === 'invite'
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">Send invite email</div>
              <p className="text-xs text-gray-500 mt-1">
                Owner receives a link and finishes setup themselves.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSetupMode('manual')}
              className={`p-4 rounded-xl border-2 text-left transition ${
                setupMode === 'manual'
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">Manual setup</div>
              <p className="text-xs text-gray-500 mt-1">
                Pick the password yourself and hand the credentials over.
              </p>
            </button>
          </div>
        </div>

        {/* Owner & restaurant details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            {setupMode === 'manual' ? 'Owner & Restaurant' : 'Owner Email'}
          </h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Owner email
            </label>
            <input
              type="email"
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              placeholder="owner@restaurant.com"
              autoFocus
            />
            {setupMode === 'invite' && (
              <p className="mt-2 text-xs text-gray-500">
                An onboarding email will be sent to this address with a link to complete setup.
              </p>
            )}
          </div>

          {setupMode === 'manual' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Restaurant name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="Joe's Pizza"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Leave blank to let the owner name their restaurant later.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Password
                </label>
                <input
                  type="text"
                  required
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none font-mono"
                  placeholder="At least 8 characters"
                  minLength={8}
                />
                <p className="mt-2 text-xs text-gray-500">
                  The owner can change this later from their account settings. No invite email will be sent.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Plan Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Subscription Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p) => (
              <button
                key={p.tier}
                type="button"
                onClick={() => setPlanTier(p.tier)}
                className={`p-4 rounded-xl border-2 text-left transition ${
                  planTier === p.tier
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${planColor(p.tier)}`}>
                    {capitalize(p.tier)}
                  </span>
                  {planTier === p.tier && (
                    <span className="text-brand-500 text-xs font-bold">Selected</span>
                  )}
                </div>
                <div className="text-lg font-bold text-gray-900">{p.price} <span className="text-sm text-gray-500 font-normal">{p.period}</span></div>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
              </button>
            ))}
          </div>

          {selectedPlan && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Included features ({selectedPlan.features.length}):
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedPlan.features.map((f) => (
                  <span key={f} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
                    {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitDisabled}
            className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition"
          >
            {loading
              ? setupMode === 'manual'
                ? 'Creating...'
                : 'Sending...'
              : setupMode === 'manual'
                ? 'Create Restaurant'
                : 'Send Onboarding Email'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
