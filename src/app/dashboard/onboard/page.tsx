'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  onboardRestaurant,
  getFeatureCatalog,
  listUsers,
  sendInviteEmail,
  OnboardInput,
  PlanDefinition,
  PlanTier,
  User,
} from '@/lib/api';
import { planColor, capitalize } from '@/lib/utils';

type PosPlatform = 'ipad' | 'macos' | 'both';

const STEPS = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'owner', label: 'Owner' },
  { id: 'plan', label: 'Plan' },
  { id: 'pos', label: 'POS Setup' },
] as const;

export default function OnboardPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ restaurant: any; tempPassword?: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  // Restaurant info
  const [restaurantName, setRestaurantName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jerusalem');

  // Owner info
  const [ownerMode, setOwnerMode] = useState<'new' | 'existing'>('new');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | undefined>();

  // Plan
  const [planTier, setPlanTier] = useState<PlanTier>('starter');

  // POS platform
  const [posPlatform, setPosPlatform] = useState<PosPlatform>('ipad');

  useEffect(() => {
    Promise.all([
      getFeatureCatalog(),
      listUsers({ role: 'owner' }),
    ]).then(([catalogData, usersData]) => {
      setPlans(catalogData.plans);
      setExistingUsers(usersData.users || []);
    });
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    setSlug(
      restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
    );
  }, [restaurantName]);

  function canProceed(): boolean {
    switch (currentStep) {
      case 0: return restaurantName.trim().length > 0;
      case 1: return ownerMode === 'existing'
        ? !!selectedOwnerId
        : ownerName.trim().length > 0 && ownerEmail.trim().length > 0;
      case 2: return !!planTier;
      case 3: return !!posPlatform;
      default: return false;
    }
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);

    const input: OnboardInput = {
      restaurant_name: restaurantName,
      slug,
      address,
      phone,
      timezone,
      plan_tier: planTier,
      pos_platform: posPlatform,
    };

    if (ownerMode === 'existing' && selectedOwnerId) {
      input.owner_id = selectedOwnerId;
    } else {
      input.owner_name = ownerName;
      input.owner_email = ownerEmail;
      input.owner_phone = ownerPhone;
      if (ownerPassword.trim()) {
        input.owner_password = ownerPassword.trim();
      }
    }

    try {
      const data = await onboardRestaurant(input);
      setSuccess({ restaurant: data.restaurant, tempPassword: data.temporary_password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  const selectedPlan = plans.find((p) => p.tier === planTier);

  // ─── Success screen ────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Restaurant Onboarded Successfully!</h1>
          <p className="text-sm text-gray-500 mt-1">
            {success.restaurant.name} is now ready for setup.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {success.tempPassword && (
            <div className="pb-6 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Temporary Login Credentials
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Use these credentials to log into <strong>foodypos</strong> and set up the restaurant for the demo.
                An invite email has been sent to the owner for them to set their own password.
              </p>

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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Temporary Password</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-white px-3 py-2 rounded border border-gray-200 font-mono">
                      {success.tempPassword || ownerPassword}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(success.tempPassword || ownerPassword || '')}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Security Note:</strong> This password is temporary and for demo setup only.
                  The restaurant owner will receive an invite email to set their own password.
                </p>
              </div>
            </div>
          )}

          {/* POS Setup Instructions */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              POS Setup — {posPlatform === 'ipad' ? 'iPad' : posPlatform === 'macos' ? 'macOS' : 'iPad & macOS'}
            </h2>

            {(posPlatform === 'ipad' || posPlatform === 'both') && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">iPad POS</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Download FoodyPOS from the App Store on the restaurant&apos;s iPad and log in with the credentials above.
                    </p>
                    <a
                      href="https://apps.apple.com/app/foodypos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Open App Store listing
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {(posPlatform === 'macos' || posPlatform === 'both') && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-900">macOS POS</p>
                    <p className="text-xs text-purple-700 mt-1">
                      Download the FoodyPOS macOS app (.dmg) and install it on the restaurant&apos;s Mac.
                    </p>
                    <a
                      href="https://github.com/foody-pos/foodypos/releases/latest"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-purple-600 hover:text-purple-800"
                    >
                      Download latest DMG from GitHub
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Send Invite Email */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Invite Email</h2>
            <p className="text-sm text-gray-600 mb-3">
              Send (or resend) the setup invitation email to the restaurant owner.
            </p>
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
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {inviteSending ? 'Sending...' : 'Send Invite Email'}
              </button>
              {inviteStatus === 'sent' && (
                <span className="text-sm text-green-600 font-medium">Invite email sent!</span>
              )}
              {inviteStatus === 'error' && (
                <span className="text-sm text-red-600 font-medium">Failed to send. Check SES config.</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Next Steps</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              {(posPlatform === 'ipad' || posPlatform === 'both') && (
                <li>Install <strong>FoodyPOS</strong> from the App Store on the iPad</li>
              )}
              {(posPlatform === 'macos' || posPlatform === 'both') && (
                <li>Download and install the <strong>FoodyPOS DMG</strong> on the Mac</li>
              )}
              <li>Log in with the credentials above</li>
              <li>Import the menu and configure settings</li>
              <li>Test the demo workflow</li>
            </ol>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/restaurants/${success.restaurant.id}`)}
              className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm"
            >
              View Restaurant Details
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setCurrentStep(0);
                setRestaurantName('');
                setSlug('');
                setAddress('');
                setPhone('');
                setOwnerName('');
                setOwnerEmail('');
                setOwnerPhone('');
                setOwnerPassword('');
                setSelectedOwnerId(undefined);
                setPlanTier('starter');
                setPosPlatform('ipad');
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

  // ─── Wizard ────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Onboard New Restaurant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Set up a new restaurant with owner account, plan, and POS configuration
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => idx < currentStep && setCurrentStep(idx)}
                disabled={idx > currentStep}
                className={`flex items-center gap-2 ${idx <= currentStep ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition ${
                    idx < currentStep
                      ? 'bg-brand-500 text-white'
                      : idx === currentStep
                      ? 'bg-brand-500 text-white ring-4 ring-brand-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {idx < currentStep ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:block ${
                    idx <= currentStep ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 ${
                    idx < currentStep ? 'bg-brand-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Step 1: Restaurant Info */}
        {currentStep === 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Restaurant Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="Joe's Pizza"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="joes-pizza"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="123 Main St, Tel Aviv"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="+972-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  <option value="Asia/Jerusalem">Asia/Jerusalem (Israel)</option>
                  <option value="Europe/Paris">Europe/Paris (France)</option>
                  <option value="America/New_York">America/New York</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Owner Info */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Restaurant Owner</h2>

            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={() => setOwnerMode('new')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  ownerMode === 'new' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Create New Owner
              </button>
              <button
                type="button"
                onClick={() => setOwnerMode('existing')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  ownerMode === 'existing' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Link Existing User
              </button>
            </div>

            {ownerMode === 'new' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="owner@restaurant.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="+972-..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password (optional)</label>
                  <input
                    type="text"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="Leave empty to auto-generate"
                  />
                  <p className="mt-1 text-xs text-gray-500">If empty, a random temporary password is generated and shown after onboarding.</p>
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-blue-700">
                      An invitation email will be sent to the owner with a link to set up their password and complete their profile.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select existing owner</label>
                <select
                  value={selectedOwnerId || ''}
                  onChange={(e) => setSelectedOwnerId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  <option value="">Choose an owner...</option>
                  {existingUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
                {existingUsers.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No owners found. Create a new one instead.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Plan Selection */}
        {currentStep === 2 && (
          <div>
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
                  <p className="text-xs text-gray-400 mt-2">
                    {p.order_limit === 0 ? 'Unlimited orders' : `Up to ${p.order_limit} orders/mo`}
                    {' · '}
                    {p.features.length} features
                  </p>
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
        )}

        {/* Step 4: POS Platform */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Choose POS Platform</h2>
            <p className="text-sm text-gray-500 mb-6">
              Select which FoodyPOS application the restaurant will use.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* iPad option */}
              <button
                type="button"
                onClick={() => setPosPlatform('ipad')}
                className={`p-5 rounded-xl border-2 text-left transition ${
                  posPlatform === 'ipad'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {posPlatform === 'ipad' && (
                    <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">iPad</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Native iOS app from the App Store. Best for restaurants using iPads.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" />
                  </svg>
                  App Store
                </div>
              </button>

              {/* macOS option */}
              <button
                type="button"
                onClick={() => setPosPlatform('macos')}
                className={`p-5 rounded-xl border-2 text-left transition ${
                  posPlatform === 'macos'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {posPlatform === 'macos' && (
                    <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">macOS</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Desktop app downloaded as DMG. Best for Mac-based setups.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-purple-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Direct Download
                </div>
              </button>

              {/* Both option */}
              <button
                type="button"
                onClick={() => setPosPlatform('both')}
                className={`p-5 rounded-xl border-2 text-left transition ${
                  posPlatform === 'both'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </div>
                  {posPlatform === 'both' && (
                    <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Both</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Use iPad and macOS together. Ideal for multi-station restaurants.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-green-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" />
                  </svg>
                  +
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  App Store + Download
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={currentStep === 0 ? () => router.back() : handleBack}
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition"
        >
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed() || loading}
          className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition"
        >
          {loading
            ? 'Creating...'
            : currentStep === STEPS.length - 1
            ? 'Create Restaurant'
            : 'Continue'}
        </button>
      </div>
    </div>
  );
}
