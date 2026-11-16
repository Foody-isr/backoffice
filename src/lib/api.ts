// Foody Backoffice API client
// All calls go through the Go API at /api/v1/admin/* (superadmin only)

import * as Sentry from '@sentry/nextjs';

const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : '';
const API_URL = runtimeHost === 'backoffice.foody-pos.co.il' ? 'https://api.foody-pos.co.il'
  : runtimeHost === 'dev-backoffice.foody-pos.co.il' ? 'https://dev-api.foody-pos.co.il'
  : process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production'
  ? 'https://api.foody-pos.co.il'
  : 'http://localhost:8080');

// ─── Types ──────────────────────────────────────────────────────────

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
  restaurant_roles?: RestaurantRoleInfo[];
}

export interface RestaurantRoleInfo {
  restaurant_id: number;
  restaurant_name: string;
  role: string;
}

export interface Restaurant {
  id: number;
  owner_id: number;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  logo_url: string;
  cover_url: string;
  phone: string;
  description: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  created_at: string;
  plan?: RestaurantPlan;
  owner?: User;
  features?: RestaurantFeature[];
  module_access?: FoodyModuleAccess;
  settings?: RestaurantSettings;
}

export interface RestaurantPlan {
  id: number;
  restaurant_id: number;
  plan_tier: PlanTier;
  order_limit: number;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantFeature {
  id: number;
  restaurant_id: number;
  feature_key: FeatureKey;
  enabled: boolean;
  overridden_by?: number;
  created_at: string;
  updated_at: string;
}

export interface RestaurantSettings {
  id: number;
  restaurant_id: number;
  require_order_approval: boolean;
  service_mode: string;
  scheduling_enabled: boolean;
  tips_enabled: boolean;
}

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  description: string;
  category: string;
  requires_all: FeatureKey[] | null;
  always_on: boolean;
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  price: string;
  period: string;
  description: string;
  features: FeatureKey[];
  order_limit: number;
}

export type FeatureCatalog = {
  features: FeatureMeta[];
  plans: PlanDefinition[];
  software_catalog?: FoodyModuleCatalog;
};

export interface DashboardStats {
  total_restaurants: number;
  active_restaurants: number;
  total_users: number;
  total_orders: number;
  orders_this_week: number;
  plan_breakdown: PlanBreakdown[];
}

export interface PlanBreakdown {
  plan_tier: string;
  count: number;
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'deactivated' | 'cancelled';

export interface Subscription {
  id: number;
  restaurant_id: number;
  status: SubscriptionStatus;
  plan_tier: PlanTier;
  card_last_four?: string;
  card_brand?: string;
  current_period_start?: string;
  current_period_end?: string;
  trial_ends_at?: string;
  grace_period_until?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionEvent {
  id: number;
  subscription_id: number;
  event_type: string;
  amount?: number;
  currency?: string;
  created_at: string;
}

export interface SubscriptionDetail extends Subscription {
  events: SubscriptionEvent[];
}

export interface SubscriptionWithRestaurant extends Subscription {
  restaurant_name: string;
  restaurant_slug: string;
}

export type FeatureKey =
  | 'pos'
  | 'menu_management'
  | 'receipt_printing'
  | 'pickup_flow'
  | 'delivery_flow'
  | 'qr_dine_in'
  | 'online_payments'
  | 'scheduled_orders'
  | 'stock_management'
  | 'grocery_recon'
  | 'ai_menu_import'
  | 'advanced_analytics'
  | 'suggestions'
  | 'multi_restaurant'
  | 'custom_api'
  | 'whatsapp_notif'
  | 'push_notif'
  | 'catering';

export type PlanTier = 'starter' | 'premium' | 'enterprise';

export interface OnboardInput {
  restaurant_name: string;
  slug?: string;
  address?: string;
  phone?: string;
  timezone?: string;
  /**
   * The language the restaurant writes its menu in. It becomes the base-column
   * language of the whole catalog, so leaving it to default means an Israeli
   * restaurant gets flagged English and its Hebrew menu is later filed away as
   * a "translation". Defaults to 'en' server-side when omitted.
   */
  default_locale?: 'en' | 'he' | 'fr';
  /**
   * ISO 4217 code the restaurant prices in. Set it here: amounts are never
   * converted, so changing it later re-labels a catalog that was priced in
   * something else. A restaurant on Stancer must be EUR. Defaults to ILS
   * server-side when omitted.
   */
  currency?: 'ILS' | 'EUR' | 'USD' | 'GBP';
  owner_id?: number;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  owner_password?: string;
  plan_tier?: PlanTier;
  billing?: ModularOnboardingInput;
  pos_platform?: 'ipad' | 'macos' | 'both';
}

// ─── HTTP helpers ───────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('foody_admin_token');
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options?.signal ?? AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag('foody.area', 'backoffice_api');
      scope.setTag('http.method', options?.method || 'GET');
      scope.setContext('request', { path });
      Sentry.captureException(error);
    });
    throw error;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `API error ${res.status}`);
    if (res.status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag('foody.area', 'backoffice_api');
        scope.setTag('http.method', options?.method || 'GET');
        scope.setTag('http.status_code', String(res.status));
        scope.setContext('request', {
          path,
          request_id: res.headers.get('x-request-id') || undefined,
        });
        Sentry.captureException(error);
      });
    }
    throw error;
  }
  return res.status === 204 ? undefined as T : res.json();
}

// ─── Auth ───────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; user: User }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // Only allow superadmin
  if (data.user.role !== 'superadmin') {
    throw new Error('Access denied. Superadmin role required.');
  }

  localStorage.setItem('foody_admin_token', data.token);
  localStorage.setItem('foody_admin_user', JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem('foody_admin_token');
  localStorage.removeItem('foody_admin_user');
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('foody_admin_user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── Dashboard ──────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/api/v1/admin/dashboard');
}

// ─── Users ──────────────────────────────────────────────────────────

export async function listUsers(params?: { role?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', params.role);
  if (params?.search) qs.set('search', params.search);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<{ users: User[] }>(`/api/v1/admin/users${query}`);
}

export async function getUser(id: number) {
  return apiFetch<{ user: User }>(`/api/v1/admin/users/${id}`);
}

export async function updateUserEmail(userId: number, email: string) {
  return apiFetch<{ user: User }>(`/api/v1/admin/users/${userId}/email`, {
    method: 'PUT',
    body: JSON.stringify({ email }),
  });
}

export async function sendResetPassword(userId: number) {
  return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}/send-reset-password`, {
    method: 'POST',
  });
}

export async function setUserPassword(userId: number, password: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/admin/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}

export async function revokeUserSessions(userId: number) {
  return apiFetch<{ ok: boolean }>(`/api/v1/admin/users/${userId}/revoke-sessions`, {
    method: 'POST',
  });
}

export async function sendInviteEmail(userId: number) {
  return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}/send-invite`, {
    method: 'POST',
  });
}

export async function deleteUser(userId: number) {
  return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

// ─── Restaurants ────────────────────────────────────────────────────

export async function listRestaurants(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<{ restaurants: Restaurant[] }>(`/api/v1/admin/restaurants${query}`);
}

export async function getRestaurant(id: number) {
  return apiFetch<{ restaurant: Restaurant }>(`/api/v1/admin/restaurants/${id}`);
}

export async function deleteRestaurant(id: number) {
  return apiFetch<{ message: string }>(`/api/v1/admin/restaurants/${id}`, {
    method: 'DELETE',
  });
}

export async function onboardRestaurant(input: OnboardInput) {
  return apiFetch<{ restaurant: Restaurant; temporary_password?: string; invite_sent?: boolean }>('/api/v1/admin/restaurants/onboard', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ─── Features ───────────────────────────────────────────────────────

/** Read the current software catalogue and existing contract defaults. */
export async function getFeatureCatalog(signal?: AbortSignal) {
  return apiFetch<FeatureCatalog>('/api/v1/admin/features/catalog', { signal, cache: 'no-store' });
}

export async function getRestaurantFeatures(restaurantId: number) {
  return apiFetch<{ features: RestaurantFeature[] }>(`/api/v1/admin/restaurants/${restaurantId}/features`);
}

export async function toggleFeature(restaurantId: number, featureKey: FeatureKey, enabled: boolean) {
  return apiFetch<{ features: RestaurantFeature[] }>(`/api/v1/admin/restaurants/${restaurantId}/features`, {
    method: 'PUT',
    body: JSON.stringify({ feature_key: featureKey, enabled }),
  });
}

export async function setRestaurantPlan(restaurantId: number, planTier: PlanTier) {
  return apiFetch<{ plan: RestaurantPlan }>(`/api/v1/admin/restaurants/${restaurantId}/plan`, {
    method: 'PUT',
    body: JSON.stringify({ plan_tier: planTier }),
  });
}

// ─── Subscriptions (admin) ───────────────────────────────────────────────────

export async function listSubscriptions(status?: SubscriptionStatus) {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<{ subscriptions: SubscriptionWithRestaurant[] }>(`/api/v1/admin/subscriptions${qs}`);
}

export async function getRestaurantSubscription(restaurantId: number) {
  return apiFetch<{ subscription: SubscriptionDetail }>(
    `/api/v1/restaurants/${restaurantId}/subscription`
  );
}

export async function adminActivateSubscription(restaurantId: number) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/admin/restaurants/${restaurantId}/subscription/activate`,
    { method: 'POST' }
  );
}

export async function adminDeactivateSubscription(restaurantId: number) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/admin/restaurants/${restaurantId}/subscription/deactivate`,
    { method: 'POST' }
  );
}

// ─── Payment Provider Config ────────────────────────────────────────

export type PaymentProvider = 'payplus' | 'sumit' | 'cibus' | 'verifone' | 'stancer';

export interface PaymentConfigResponse {
  verifone_checkout_theme?: VerifoneCheckoutThemeStatus;
  restaurant_id: number;
  provider: PaymentProvider;
  has_custom_credentials: boolean;
  masked_api_key?: string;
  masked_secret_key?: string;
  masked_public_key?: string;
  masked_payment_page_uid?: string;
  sumit_company_id?: number;
  masked_cibus_restaurant_id?: string;
  masked_cibus_pos_id?: string;
  masked_cibus_company_code?: string;
  verifone_environment?: 'sandbox' | 'production';
  verifone_stored_credential_model?: 'CREDENTIAL_ON_FILE' | 'RECURRING' | 'NONE';
  verifone_token_charging_enabled?: boolean;
  verifone_invoice4u_enabled?: boolean;
  verifone_invoice4u_receipt_type?: 'FULL_RECEIPT' | 'INVOICE' | 'INVOICE_RECEIPT' | '';
  masked_verifone_user_id?: string;
  masked_verifone_api_key?: string;
  masked_verifone_entity_id?: string;
  masked_verifone_checkout_payment_contract_id?: string;
  masked_verifone_token_payment_contract_id?: string;
  masked_verifone_installments_payment_contract_id?: string;
  verifone_apple_pay_enabled?: boolean;
  verifone_google_pay_enabled?: boolean;
  masked_verifone_apple_pay_payment_contract_id?: string;
  masked_verifone_google_pay_payment_contract_id?: string;
  masked_verifone_token_scope?: string;
  masked_verifone_public_key_alias?: string;
  verifone_public_key_configured?: boolean;
  verifone_direct_card_enabled?: boolean;
  verifone_direct_apple_pay_enabled?: boolean;
  verifone_direct_google_pay_enabled?: boolean;
  masked_verifone_direct_apple_pay_contract_id?: string;
  masked_verifone_direct_google_pay_contract_id?: string;
  verifone_apple_pay_domain?: string;
  verifone_apple_pay_association_configured?: boolean;
  verifone_google_pay_gateway_merchant_id?: string;
  verifone_google_pay_merchant_id?: string;
  masked_stancer_secret_key?: string;
  masked_stancer_public_key?: string;
}

export interface UpdatePaymentConfigInput {
  verifone_checkout_theme_enabled?: boolean;
  provider: PaymentProvider;
  payplus_api_key?: string;
  payplus_secret_key?: string;
  payplus_payment_page_uid?: string;
  sumit_company_id?: number;
  sumit_api_key?: string;
  sumit_public_key?: string;
  cibus_restaurant_id?: string;
  cibus_pos_id?: string;
  cibus_company_code?: string;
  verifone_environment?: 'sandbox' | 'production';
  verifone_stored_credential_model?: 'CREDENTIAL_ON_FILE' | 'RECURRING' | 'NONE';
  verifone_user_id?: string;
  verifone_api_key?: string;
  verifone_entity_id?: string;
  verifone_checkout_payment_contract_id?: string;
  verifone_token_payment_contract_id?: string;
  verifone_installments_payment_contract_id?: string;
  verifone_apple_pay_enabled?: boolean;
  verifone_google_pay_enabled?: boolean;
  verifone_apple_pay_payment_contract_id?: string;
  verifone_google_pay_payment_contract_id?: string;
  verifone_token_scope?: string;
  verifone_public_key_alias?: string;
  verifone_public_key?: string;
  verifone_direct_card_enabled?: boolean;
  verifone_direct_apple_pay_enabled?: boolean;
  verifone_direct_google_pay_enabled?: boolean;
  verifone_direct_apple_pay_contract_id?: string;
  verifone_direct_google_pay_contract_id?: string;
  verifone_apple_pay_domain?: string;
  verifone_apple_pay_domain_association?: string;
  verifone_google_pay_gateway_merchant_id?: string;
  verifone_google_pay_merchant_id?: string;
  verifone_token_charging_enabled?: boolean;
  verifone_invoice4u_enabled?: boolean;
  verifone_invoice4u_receipt_type?: 'FULL_RECEIPT' | 'INVOICE' | 'INVOICE_RECEIPT' | '';
  stancer_secret_key?: string;
  stancer_public_key?: string;
}

export async function getPaymentConfig(restaurantId: number): Promise<PaymentConfigResponse> {
  return apiFetch<PaymentConfigResponse>(`/api/v1/admin/restaurants/${restaurantId}/payment-config`);
}

export interface VerifoneCheckoutThemeStatus {
  enabled: boolean;
  ready: boolean;
  outdated: boolean;
  theme_id?: string;
  source?: 'website' | 'portal';
  synced_at?: string;
}

/** Synchronize the restaurant's published branding, without starting a payment. */
export async function syncVerifoneCheckoutTheme(restaurantId: number): Promise<VerifoneCheckoutThemeStatus> {
  return apiFetch<VerifoneCheckoutThemeStatus>(`/api/v1/admin/restaurants/${restaurantId}/payment-config/verifone-theme/sync`, { method: 'POST' });
}

/** Link an existing Verifone Central theme by UUID or exact name. */
export async function linkVerifoneCheckoutTheme(restaurantId: number, reference: string): Promise<VerifoneCheckoutThemeStatus> {
  return apiFetch<VerifoneCheckoutThemeStatus>(`/api/v1/admin/restaurants/${restaurantId}/payment-config/verifone-theme/link`, {
    method: 'POST',
    body: JSON.stringify({ theme_reference: reference }),
  });
}

export async function updatePaymentConfig(restaurantId: number, config: UpdatePaymentConfigInput): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/admin/restaurants/${restaurantId}/payment-config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ── Cibus (Pluxee) platform-level config ───────────────────────────
// Shared across all restaurants. The restaurant-level terminal creds live on the
// per-restaurant payment config; this is Foody's integration environment/creds.

export interface CibusConfigResponse {
  environment: 'sandbox' | 'production';
  endpoint_url: string;
  masked_integrator_key?: string;
  masked_integrator_secret?: string;
}

export interface UpdateCibusConfigInput {
  environment: 'sandbox' | 'production';
  endpoint_url?: string;
  integrator_key?: string;
  integrator_secret?: string;
}

export async function getCibusConfig(): Promise<CibusConfigResponse> {
  return apiFetch<CibusConfigResponse>('/api/v1/admin/cibus-config');
}

export async function updateCibusConfig(config: UpdateCibusConfigInput): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/v1/admin/cibus-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ── Custom Domain ──────────────────────────────────────────────────

export interface CustomDomainResponse {
  restaurant_id: number;
  custom_domain: string;
}

export async function getCustomDomain(restaurantId: number): Promise<CustomDomainResponse> {
  return apiFetch<CustomDomainResponse>(`/api/v1/admin/restaurants/${restaurantId}/custom-domain`);
}

export async function updateCustomDomain(restaurantId: number, domain: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/admin/restaurants/${restaurantId}/custom-domain`, {
    method: 'PUT',
    body: JSON.stringify({ custom_domain: domain }),
  });
}

// ─── Ingredient Icon Library ────────────────────────────────────────

export interface IngredientIcon {
  id: number;
  name: string;
  slug: string;
  image_url: string;
  category: string;
  aliases: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface GenerateIconInput {
  name: string;
  category?: string;
  /** Empty string / "fresh" / "none" → bare ingredient template.
   *  Otherwise a key from listIconPackagings() (or a free-form phrase). */
  packaging?: string;
  aliases?: string[];
  tags?: string[];
}

export interface IconPackagingOption {
  key: string;
  phrase: string;
}

export async function listIconPackagings() {
  return apiFetch<{ packagings: IconPackagingOption[] }>('/api/v1/admin/ingredient-icons/packagings');
}

export interface UpdateIconInput {
  name?: string;
  category?: string;
  aliases?: string[];
  tags?: string[];
  image_url?: string;
}

export async function listIngredientIcons(params?: { q?: string; category?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.category) qs.set('category', params.category);
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<{ icons: IngredientIcon[] }>(`/api/v1/admin/ingredient-icons${query}`);
}

export async function getIngredientIconPrompt(name: string, packaging?: string) {
  const qs = new URLSearchParams({ name });
  if (packaging) qs.set('packaging', packaging);
  return apiFetch<{ prompt: string }>(
    `/api/v1/admin/ingredient-icons/prompt?${qs.toString()}`
  );
}

export async function generateIngredientIcon(input: GenerateIconInput) {
  return apiFetch<IngredientIcon>('/api/v1/admin/ingredient-icons/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateIngredientIcon(id: number, input: UpdateIconInput) {
  return apiFetch<IngredientIcon>(`/api/v1/admin/ingredient-icons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteIngredientIcon(id: number) {
  return apiFetch<{ deleted: boolean }>(`/api/v1/admin/ingredient-icons/${id}`, {
    method: 'DELETE',
  });
}

// ── Spoke (Circuit) Delivery Config ─────────────────────────────────

export interface SpokeConfigResponse {
  configured: boolean;
  enabled?: boolean;
  depot_id?: string;
  default_driver_name?: string;
  default_driver_phone?: string;
}

export interface SpokeConfigInput {
  api_key: string;
  enabled: boolean;
  depot_id: string;
  default_driver_name: string;
  default_driver_phone: string;
}

export async function getSpokeConfig(restaurantId: number): Promise<SpokeConfigResponse> {
  return apiFetch<SpokeConfigResponse>(`/api/v1/spoke/config?restaurant_id=${restaurantId}`);
}

export async function updateSpokeConfig(
  restaurantId: number,
  config: SpokeConfigInput
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/spoke/config?restaurant_id=${restaurantId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ─── POS Login Screen ───────────────────────────────────────────────
// Foody-curated content for the foodypos login carousel. Each slide is a
// background photo + localized headline + caption; the eyebrow line is a
// single global setting. Read by the POS over a public endpoint.

/** A piece of UI copy in each supported language. English is the fallback. */
export interface LocalizedText {
  en: string;
  fr: string;
  he: string;
}

export const emptyLocalizedText = (): LocalizedText => ({ en: '', fr: '', he: '' });

export interface POSLoginSlide {
  id: number;
  image_url: string;
  headline: LocalizedText;
  caption_title: LocalizedText;
  caption_subtitle: LocalizedText;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface POSLoginSlideInput {
  image_url: string;
  headline: LocalizedText;
  caption_title: LocalizedText;
  caption_subtitle: LocalizedText;
  sort_order: number;
  is_active: boolean;
}

export interface POSLoginConfig {
  id: number;
  eyebrow: LocalizedText;
  updated_at: string;
}

export async function listPOSLoginSlides() {
  return apiFetch<{ slides: POSLoginSlide[] }>('/api/v1/admin/pos-login-slides');
}

export async function createPOSLoginSlide(input: POSLoginSlideInput) {
  return apiFetch<POSLoginSlide>('/api/v1/admin/pos-login-slides', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePOSLoginSlide(id: number, input: POSLoginSlideInput) {
  return apiFetch<POSLoginSlide>(`/api/v1/admin/pos-login-slides/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deletePOSLoginSlide(id: number) {
  return apiFetch<{ deleted: boolean }>(`/api/v1/admin/pos-login-slides/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderPOSLoginSlides(ids: number[]) {
  return apiFetch<{ reordered: boolean }>('/api/v1/admin/pos-login-slides/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function getPOSLoginConfig() {
  return apiFetch<POSLoginConfig>('/api/v1/admin/pos-login-config');
}

export async function updatePOSLoginConfig(eyebrow: LocalizedText) {
  return apiFetch<POSLoginConfig>('/api/v1/admin/pos-login-config', {
    method: 'PUT',
    body: JSON.stringify({ eyebrow }),
  });
}

/** Uploads a slide background image (multipart) and returns its stored URL. */
export async function uploadPOSLoginSlideImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/admin/pos-login-slides/upload-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  const data = await res.json();
  return data.image_url as string;
}

// ─── Infrastructure panel (EC2 monitor + dev scheduler + cost) ──────────

export interface InfraInstance {
  instance_id: string;
  name: string;
  state: string; // running | stopped | pending | stopping | ...
  instance_type: string;
  public_ip?: string;
  private_ip?: string;
  availability_zone?: string;
  launched_at?: string;
  controllable: boolean; // true only for the dev instance
  is_dev: boolean;
}

export interface InfraSchedule {
  mode: 'auto' | 'always_on';
  timezone: string;
  start_hour: number;
  end_hour: number;
  weekdays: string;
  dev_instance_id: string;
  should_be_on_now: boolean;
  next_transition?: string;
}

export interface InfraTranslation {
  enabled: boolean;
  available: boolean;
}

export interface InfraCostLine {
  service: string;
  amount: number;
}

export interface InfraCost {
  month_to_date: number;
  forecast: number;
  currency: string;
  by_service: InfraCostLine[];
  period_start: string;
  period_end: string;
  as_of: string;
}

export async function getInstances(): Promise<{ instances: InfraInstance[] }> {
  return apiFetch<{ instances: InfraInstance[] }>('/api/v1/admin/infra/instances');
}

export async function startInstance(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/v1/admin/infra/instances/${id}/start`, { method: 'POST' });
}

export async function stopInstance(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/v1/admin/infra/instances/${id}/stop`, { method: 'POST' });
}

export async function getSchedule(): Promise<InfraSchedule> {
  return apiFetch<InfraSchedule>('/api/v1/admin/infra/schedule');
}

export async function updateSchedule(input: Pick<InfraSchedule, 'mode' | 'start_hour' | 'end_hour'>): Promise<InfraSchedule> {
  return apiFetch<InfraSchedule>('/api/v1/admin/infra/schedule', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function getTranslationSetting(): Promise<InfraTranslation> {
  return apiFetch<InfraTranslation>('/api/v1/admin/infra/translation');
}

export async function setTranslationEnabled(enabled: boolean): Promise<InfraTranslation> {
  return apiFetch<InfraTranslation>('/api/v1/admin/infra/translation', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export async function getCost(refresh = false): Promise<InfraCost> {
  return apiFetch<InfraCost>(`/api/v1/admin/infra/cost${refresh ? '?refresh=1' : ''}`);
}

// ─── Development diagnostics ────────────────────────────────────────

export interface VerifoneDiagnosticStatus {
  available: boolean;
  enabled: boolean;
  environment: 'development' | 'production' | 'unconfigured';
  updated_at: string | null;
}

/** Read the authoritative API-side filtered JSON policy (superadmin only). */
export async function getVerifoneDiagnostics(): Promise<VerifoneDiagnosticStatus> {
  return apiFetch<VerifoneDiagnosticStatus>('/api/v1/admin/observability/verifone', { cache: 'no-store' });
}

/** Persist filtered sandbox JSON logging without restarting the API. */
export async function setVerifoneDiagnostics(enabled: boolean): Promise<VerifoneDiagnosticStatus> {
  return apiFetch<VerifoneDiagnosticStatus>('/api/v1/admin/observability/verifone', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

// ─── Environment clone ──────────────────────────────────────────────
//
// Moves one restaurant's whole dataset between environments so a production bug
// can be reproduced with the real data. The bundle travels through this browser,
// either directly or through a downloaded file. Each half is
// authenticated by the normal superadmin login on that environment, so there is
// no shared secret and production needs no configuration at all.
//
// All routes act on whichever API NEXT_PUBLIC_API_URL points at. Export works
// everywhere, including production; apply is refused on production.

export type CloneCluster = 'stock' | 'users_roles' | 'push_tokens' | 'integrations';

export interface CloneStatus {
  env: string;
  is_clone_target: boolean;
  optional_clusters: CloneCluster[];
  offset_k: number;
  bundle_version: number;
}

export interface CloneRestaurant {
  id: number;
  name: string;
  slug: string;
  orders: number;
  items: number;
}

export interface CloneTableReport {
  name: string;
  cluster: string;
  deleted: number;
  inserted: number;
  source: number;
  nulled?: number;
}

export interface CloneOrphan {
  table: string;
  column: string;
  parent: string;
  count: number;
}

export interface CloneReport {
  dry_run: boolean;
  restaurant_id: number;
  restaurant_name: string;
  source_env: string;
  target_env: string;
  clusters: string[];
  tables: CloneTableReport[];
  total_inserted: number;
  total_deleted: number;
  orphans?: CloneOrphan[];
  warnings?: string[];
  skipped?: Record<string, string>;
  committed: boolean;
}

export type CloneEnvironment = 'production' | 'development';

export interface CloneSession {
  environment: CloneEnvironment;
  token: string;
}

const CLONE_API_URLS: Record<CloneEnvironment, string> = {
  production: 'https://api.foody-pos.co.il',
  development: 'https://dev-api.foody-pos.co.il',
};

/** Identifies the canonical environment served by the API selected for this browser. */
export function getApiEnvironment(): CloneEnvironment | undefined {
  return (Object.keys(CLONE_API_URLS) as CloneEnvironment[]).find(
    (env) => CLONE_API_URLS[env] === API_URL.replace(/\/$/, ''),
  );
}

/** Reuses a login only for the exact API that issued it. */
export function getCurrentCloneSession(): CloneSession | null {
  const token = getToken();
  if (!token) return null;
  const environment = getApiEnvironment();
  return environment ? { environment, token } : null;
}

async function cloneFetch(session: CloneSession, path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${CLONE_API_URLS[session.environment]}${path}`, {
    ...options,
    signal: options?.signal ?? AbortSignal.timeout(240_000),
    headers: { Authorization: `Bearer ${session.token}`, ...options?.headers },
    credentials: 'omit',
    redirect: 'error',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${session.environment}: ${body.error || `API error ${res.status}`}`);
  }
  return res;
}

/** Signs in separately without storing the other environment's credentials. */
export async function loginCloneEnvironment(
  environment: CloneEnvironment, email: string, password: string,
): Promise<CloneSession> {
  const res = await fetch(`${CLONE_API_URLS[environment]}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15_000),
    credentials: 'omit',
    redirect: 'error',
  });
  if (!res.ok) throw new Error(`${environment}: sign-in failed`);
  const data: { token: string; user: User } = await res.json();
  if (data.user.role !== 'superadmin') throw new Error(`${environment}: superadmin access required`);
  return { environment, token: data.token };
}

export async function getCloneStatus(session?: CloneSession): Promise<CloneStatus> {
  if (session) return (await cloneFetch(session, '/api/v1/admin/env-clone/status')).json();
  return apiFetch<CloneStatus>('/api/v1/admin/env-clone/status');
}

export async function getCloneRestaurants(session?: CloneSession): Promise<{ restaurants: CloneRestaurant[] }> {
  if (session) return (await cloneFetch(session, '/api/v1/admin/env-clone/restaurants')).json();
  return apiFetch<{ restaurants: CloneRestaurant[] }>('/api/v1/admin/env-clone/restaurants');
}

/** Keeps the exported bundle in memory for a direct transfer. */
export async function fetchCloneBundle(
  session: CloneSession, restaurantId: number, clusters: CloneCluster[],
): Promise<File> {
  const query = new URLSearchParams({ restaurant_id: String(restaurantId) });
  if (clusters.length) query.set('clusters', clusters.join(','));
  const res = await cloneFetch(session, `/api/v1/admin/env-clone/export?${query}`);
  const bundle = await res.json();
  if (bundle.restaurant_id !== restaurantId || bundle.source_env !== session.environment) {
    throw new Error('The exported bundle does not match the requested restaurant and environment.');
  }
  if (bundle.unclassified?.length) {
    throw new Error('The source API has tables without a copy rule. Update the API before copying this restaurant.');
  }
  return new File([JSON.stringify(bundle)], `foody-${session.environment}-restaurant-${restaurantId}.json`, {
    type: 'application/json',
  });
}

// downloadCloneBundle exports a restaurant from the current environment as a
// JSON file. That file is both the transport to the other environment and the
// backup to keep before overwriting anything.
export async function downloadCloneBundle(restaurantId: number, clusters: CloneCluster[]): Promise<void> {
  const token = getToken();
  const query = new URLSearchParams({ restaurant_id: String(restaurantId) });
  if (clusters.length > 0) query.set('clusters', clusters.join(','));

  const res = await fetch(`${API_URL}/api/v1/admin/env-clone/export?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  // Prefer the filename the server chose, which records the source environment.
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `foody-restaurant-${restaurantId}.json`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// applyCloneBundle uploads a bundle to the current environment. It previews
// unless confirm is true, so a mis-picked file cannot destroy anything.
export async function applyCloneBundle(file: File, confirm: boolean, session?: CloneSession): Promise<CloneReport> {
  const token = getToken();
  const form = new FormData();
  form.append('bundle', file);

  if (session) {
    return (await cloneFetch(session, `/api/v1/admin/env-clone/apply${confirm ? '?confirm=1' : ''}`, {
      method: 'POST', body: form,
    })).json();
  }

  const res = await fetch(`${API_URL}/api/v1/admin/env-clone/apply${confirm ? '?confirm=1' : ''}`, {
    method: 'POST',
    // No Content-Type: the browser sets the multipart boundary itself.
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

/** Restaurant usage counts provider units separately from outbound attempts. */
export interface ExternalApiCounter { id: string; provider: string; unit: string; default_limit: number; used: number; requests: number; limit: number; remaining: number; status: 'available' | 'warning' | 'exhausted' }
export interface ExternalApiUsage { restaurant_id: number; revision: number; month: string; resets_at: string; tracked_since: string; counters: ExternalApiCounter[] }
export const getExternalApiUsage = (id: number) => apiFetch<ExternalApiUsage>(`/api/v1/admin/restaurants/${id}/api-usage`);
export const updateExternalApiQuotas = (id: number, revision: number, limits: Record<string, number>, reason: string) => apiFetch<ExternalApiUsage>(`/api/v1/admin/restaurants/${id}/api-quotas`, { method: 'PUT', body: JSON.stringify({ revision, limits, reason }) });
export const listExternalApiUsage = (page: number) => apiFetch<{ restaurants: { id: number; name: string; usage: ExternalApiUsage }[]; page: number; page_size: number; total: number }>(`/api/v1/admin/api-usage?page=${page}`);

export const externalApiLabels: Record<string, string> = {
 google_autocomplete: 'Address suggestions', google_details: 'Address details', google_geocoding: 'Google geocoding', google_routes: 'Google route calculations', google_optimization_single: 'Single-courier optimization', google_optimization_fleet: 'Fleet optimization', google_tiles: 'Google map tiles', geoapify_credits: 'Geoapify estimated credits',
};

/** Fleet declaration and separately verified CST state. */
export interface TerminalFleetMetadata {
  id: string; device_id: string; restaurant_id: number; revision: number;
  serial_number: string; did: string; shva_terminal_id: string; supplier_id: string;
  vhq_device_uid: string; ashrait_terminal_id: string;
  acquirer: string; lifecycle: 'in_service' | 'repair' | 'returned' | 'quarantine';
  configuration_state: 'declared_not_applied' | 'verified_cst'; updated_at: string;
}

/** Non-secret physical inventory, restricted to the superadmin control plane. */
export interface TerminalFleetEntry {
  device_id: string; restaurant_id: number; restaurant_name: string; name: string;
  manufacturer: string; model: string; status: string; last_seen_at?: string; kind?: string;
  forgotten_at?: string; metadata?: TerminalFleetMetadata; prepared_change_id?: string; serial_locked?: boolean;
}

/** Commercial identifiers from an inventory declaration or a prepared change. */
export type TerminalFleetParameters = Pick<TerminalFleetMetadata,
  'did' | 'shva_terminal_id' | 'ashrait_terminal_id' | 'supplier_id' | 'acquirer'>;

/** Metadata saved for an inventory device without provisioning the terminal. */
export type TerminalFleetDeclaration = TerminalFleetParameters & Pick<TerminalFleetMetadata,
  'revision' | 'serial_number' | 'lifecycle'>;

/** One request bound to the declarations reviewed by the operator. */
export interface TerminalFleetChangeInput {
  request_id: string;
  source_revision: number;
  kind: 'configure' | 'replace' | 'reassign';
  target_device_id?: string;
  target_revision?: number;
  target_restaurant_id?: number;
  requested: TerminalFleetParameters;
}

export type TerminalFleetNativeCommand = 'SetVhqDeviceId' | 'DownloadAshraitParameters';
export type TerminalFleetCommand = TerminalFleetNativeCommand | 'UpdateVHQSHVA';

/** One authorization and the observed SDK result, separate from external verification. */
export interface TerminalFleetAttempt {
  id: string;
  command: TerminalFleetCommand;
  remote?: boolean;
  state: 'authorized' | 'dispatching' | 'confirmed' | 'not_started' | 'uncertain';
  authorized_at: string;
  dispatched_at?: string;
  reviewed_at?: string;
  review_result?: 'verified_cst' | 'verified_unchanged';
  review_reference?: string;
}

/** A change with immutable configuration snapshots and its CST journal. */
export interface TerminalFleetChange {
  id: string;
  device_id: string;
  restaurant_id: number;
  source_revision: number;
  kind: TerminalFleetChangeInput['kind'];
  state: 'prepared' | 'cancelled' | 'verified_cst' | 'verified_unchanged';
  source_serial_number: string;
  source: TerminalFleetParameters;
  target_device_id: string;
  target_restaurant_id: number;
  target_revision: number;
  target_serial_number: string;
  target_vhq_device_uid: string;
  target_before: TerminalFleetParameters;
  requested: TerminalFleetParameters;
  created_by: number;
  created_at: string;
  cancelled_by?: number;
  cancelled_at?: string;
  cst_execution_allowed?: boolean;
  cst_vhq_required?: boolean;
  cst_vhq_available?: boolean;
  attempts?: TerminalFleetAttempt[];
}

type HardwareFilters = {
  q?: string;
  restaurant_id?: string;
  offset?: number;
  include_forgotten?: boolean;
};

function hardwareQuery(options: HardwareFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== '') query.set(key, String(value));
  return query;
}

/** Lists a bounded page of payment-capable devices across restaurants. */
export async function listTerminalFleet(options: HardwareFilters = {}) {
  const query = hardwareQuery(options);
  return apiFetch<{ terminals: TerminalFleetEntry[]; has_more: boolean }>(`/api/v1/admin/terminals?${query}`);
}

/** Lists a bounded page of every registered hardware kind across restaurants. */
export async function listHardware(options: HardwareFilters = {}) {
  const query = hardwareQuery(options);
  return apiFetch<{ devices: TerminalFleetEntry[]; has_more: boolean }>(`/api/v1/admin/devices?${query}`);
}

/** Removes one device within the restaurant shown in the inventory. */
export async function forgetHardware(restaurantId: number, deviceId: string) {
  await apiFetch<void>(`/api/v1/restaurants/${restaurantId}/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
}

/** Saves declarations only; no bank command or reassignment occurs. */
export async function updateTerminalFleet(deviceId: string, input: TerminalFleetDeclaration) {
  return apiFetch<TerminalFleetMetadata>(`/api/v1/admin/terminals/${encodeURIComponent(deviceId)}`, { method: 'PUT', body: JSON.stringify(input) });
}

// ─── Foody software billing (sandbox) ───────────────────────────────

export type FoodyMerchantField = 'user_id' | 'api_key' | 'entity_id' | 'checkout_contract_id' | 'token_contract_id' | 'token_scope';
export type FoodyMerchant = {
  environment: 'sandbox';
  revision: number;
  enabled: boolean;
  recurring_enabled: boolean;
  configured: Record<FoodyMerchantField, boolean>;
};
type FoodyOfferTerms = {
  title: string; includes: string; terms: string;
  monthly_minor: number; annual_minor: number; tax_mode: 'ht' | 'ttc'; start_date: string;
};
type FoodyPrice = { net_minor: number; vat_minor: number; total_minor: number };
type FoodyOffer = FoodyOfferTerms & { id: number; version: number; monthly: FoodyPrice; annual: FoodyPrice };
export type FoodyPrivateBilling = {
  onboarding?: {
    mode: 'public' | 'private';
    trial_days: number;
    trial_allowed: FoodyModule[];
    selection: FoodyModule[];
    licences: FoodyLicenceCounts;
    access: FoodyModuleAccess;
    catalog: FoodyModuleCatalog;
  };
  offer: FoodyOffer | null;
  accepted_offer: FoodyOffer | null;
  agreement: { offer_id: number; cycle: 'monthly' | 'annual'; period_end: string; renews: boolean } | null;
  payment: { status: string; kind: string; amount_minor: number; reference: string } | null;
  checkout_enabled: boolean;
  monthly_enabled: boolean;
  can_simulate_renewal: boolean;
  owner_url?: string;
};
export type FoodyObservedUsage = {
  month: string;
  quotas: { counters: { id: string; used: number; unit: string }[] } | null;
  observed: Record<string, number>;
  complete: boolean;
};

/** Read the configuration status; this endpoint never returns credentials. */
export function getFoodyMerchant(): Promise<FoodyMerchant> {
  return apiFetch('/api/v1/admin/foody-billing/merchant', { cache: 'no-store' });
}

/** Replace supplied credentials only; blanks keep previously stored values. */
export function saveFoodyMerchant(input: Pick<FoodyMerchant, 'revision' | 'enabled' | 'recurring_enabled'> & Partial<Record<FoodyMerchantField, string>>): Promise<FoodyMerchant> {
  return apiFetch('/api/v1/admin/foody-billing/merchant', { method: 'PUT', body: JSON.stringify(input) });
}

function foodyBillingPath(rid: number) {
  return '/api/v1/admin/restaurants/' + rid + '/foody-billing';
}

/** Read the restaurant's sandbox billing and current private offer. */
export function getFoodyPrivateBilling(rid: number): Promise<FoodyPrivateBilling> {
  return apiFetch(foodyBillingPath(rid), { cache: 'no-store' });
}

/** Publish a new immutable version of the private offer. */
export function saveFoodyOffer(rid: number, input: FoodyOfferTerms & { expected_version: number }): Promise<FoodyPrivateBilling> {
  return apiFetch(foodyBillingPath(rid) + '/offer', { method: 'PUT', body: JSON.stringify(input) });
}

/** Read provider status without initiating or repeating a charge. */
export function reconcileFoodyBilling(rid: number, transaction_id?: string): Promise<FoodyPrivateBilling> {
  return apiFetch(foodyBillingPath(rid) + '/reconcile', { method: 'POST', body: JSON.stringify({ transaction_id }) });
}

/** Advance the first authorized monthly renewal in the sandbox. */
export function simulateFoodyRenewal(rid: number): Promise<FoodyPrivateBilling> {
  return apiFetch(foodyBillingPath(rid) + '/simulate-renewal', { method: 'POST', signal: AbortSignal.timeout(45_000) });
}

/** Read measured activity; it is never used to calculate a debit. */
export function getFoodyObservedUsage(rid: number): Promise<FoodyObservedUsage> {
  return apiFetch(foodyBillingPath(rid) + '/usage', { cache: 'no-store' });
}

/** Adds a Mini to inventory by serial number without creating a pairing. */
export async function registerFleetMini(input: { restaurant_id: number; serial_number: string; name: string }) {
  return apiFetch<TerminalFleetEntry>('/api/v1/admin/terminals/mini', { method: 'POST', body: JSON.stringify(input) });
}

/** Reads recent plans for one terminal. */
export async function listTerminalFleetChanges(deviceId: string) {
  return apiFetch<{ changes: TerminalFleetChange[] }>(`/api/v1/admin/terminals/${encodeURIComponent(deviceId)}/changes`);
}

/** Records the requested maintenance without sending a terminal command. */
export async function prepareTerminalFleetChange(deviceId: string, input: TerminalFleetChangeInput) {
  return apiFetch<TerminalFleetChange>(`/api/v1/admin/terminals/${encodeURIComponent(deviceId)}/changes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Cancels the plan and preserves its history. */
export async function cancelTerminalFleetChange(deviceId: string, changeId: string) {
  return apiFetch<TerminalFleetChange>(
    `/api/v1/admin/terminals/${encodeURIComponent(deviceId)}/changes/${encodeURIComponent(changeId)}/cancel`,
    { method: 'POST' },
  );
}

/** Authorizes one command; the enrolled diagnostic POS still has to claim it. */
export async function authorizeTerminalFleetCST(deviceId: string, changeId: string, command: TerminalFleetNativeCommand, remote: boolean) {
  return apiFetch<TerminalFleetAttempt>(
    `/api/v1/admin/terminals/${encodeURIComponent(deviceId)}/changes/${encodeURIComponent(changeId)}/authorize-cst`,
    { method: 'POST', body: JSON.stringify({ command, remote, cst_confirmed: true }) },
  );
}

/** Records independently observed values before releasing the maintenance reservation. */
export async function reviewTerminalFleetCST(deviceId: string, changeId: string, observed: TerminalFleetParameters, reference: string) {
  return apiFetch<{ reviewed: true }>(
    `/api/v1/admin/terminals/${encodeURIComponent(deviceId)}/changes/${encodeURIComponent(changeId)}/review-cst`,
    { method: 'POST', body: JSON.stringify({ observed, reference }) },
  );
}

/** Stages or verifies the SHVA value for a legacy VHQ change request. */
export async function stageTerminalFleetVHQ(deviceId: string, changeId: string, action: 'stage' | 'verify') {
  return apiFetch<TerminalFleetAttempt>(
    `/api/v1/admin/terminals/${encodeURIComponent(deviceId)}/changes/${encodeURIComponent(changeId)}/vhq-cst`,
    { method: 'POST', body: JSON.stringify({ action, cst_confirmed: true }) },
  );
}

export type FoodyModule = 'restaurant' | 'ordering' | 'kitchen';

export type FoodyLicenceCounts = { pos: number; chef: number; kds: number; employees?: number | null; pos_devices?: number | null };

export type FoodyModuleAccess = {
  status: 'pending' | 'trial' | 'active' | 'expired';
  modules: FoodyModule[];
  seats: FoodyLicenceCounts;
  trial_ends_at?: string;
};

export type FoodyModuleCatalog = {
  plans?: FoodyPlan[];
  capabilities?: FoodyCapability[];
  tariffs?: FoodyTariff[];
  version: string;
  currency: 'ILS';
  minimum_trial_days: number;
  extra_pos_minor: number;
  products: {
    id: FoodyModule;
    name: Record<'en' | 'fr' | 'he', string>;
    monthly_minor: number;
    included: FoodyLicenceCounts;
    features: FeatureKey[];
    capabilities?: string[];
  }[];
};

export type ModularOnboardingInput = {
  mode: 'public' | 'private';
  catalog_version: string;
  trial_days: number;
  trial_modules: FoodyModule[];
  custom?: {
    plan_id?: string;
    extra_licences?: Record<string, number>;
    modules: FoodyModule[];
    extra_pos_licences: number;
    title: string;
    terms: string;
    monthly_minor: number;
    annual_minor: number;
    tax_mode: 'ht' | 'ttc';
  };
};

/** Returns the software catalogue available on the sandbox API. */
export async function getFoodyModuleCatalog(signal?: AbortSignal): Promise<FoodyModuleCatalog | null> {
  try {
    return await apiFetch<FoodyModuleCatalog>('/api/v1/admin/foody-billing/catalog', { signal });
  } catch (error) {
    if (runtimeHost !== 'dev-backoffice.foody-pos.co.il' &&
      error instanceof Error && ['foody_billing_sandbox_only', 'API error 404'].includes(error.message)) return null;
    throw error;
  }
}

/** Requests delivery of the scoped invitation for this sandbox restaurant. */
export function resendFoodyModularInvite(id: number) {
  return apiFetch<{ invite_sent: boolean }>(`/api/v1/admin/restaurants/${id}/modular-invite`, { method: 'POST' });
}

export type FoodyCapability = { key: string; category: string; name: Record<'en' | 'fr' | 'he', string>; requires_all: string[]; admin_paths: string[] };
export type FoodyPlan = { capabilities?: string[]; id: string; name: Record<'en' | 'fr' | 'he', string>; modules: FoodyModule[]; monthly_minor: number; included: FoodyLicenceCounts; add_features: string[]; remove_features: string[]; published: boolean };
export type FoodyTariff = { id: string; category: string; name: Record<'en' | 'fr' | 'he', string>; unit: string; amount_minor: number | null; quantity?: number };
export type FoodyEditableCatalog = FoodyModuleCatalog & { revision: number; plans: FoodyPlan[]; tariffs: FoodyTariff[]; capabilities: FoodyCapability[] };
/** Reads the published catalogue with its editable prices and composition. */
export function getEditableFoodyCatalog(signal?: AbortSignal): Promise<FoodyEditableCatalog> {
 return apiFetch('/api/v1/admin/foody-billing/catalog', { signal });
}
/** Publishes an immutable revision only if the edited version is still current. */
export function publishFoodyCatalog(catalog: FoodyEditableCatalog, expectedRevision: number): Promise<FoodyEditableCatalog> {
 return apiFetch('/api/v1/admin/foody-billing/catalog', { method: 'PUT', body: JSON.stringify({ expected_revision: expectedRevision, catalog }) });
}
