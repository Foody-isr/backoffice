// Foody Backoffice API client
// All calls go through the Go API at /api/v1/admin/* (superadmin only)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
  plan_tier: PlanTier;
  pos_platform?: 'ipad' | 'macos' | 'both';
}

// ─── HTTP helpers ───────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('foody_admin_token');
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
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
  return apiFetch<{ restaurant: Restaurant; temporary_password?: string }>('/api/v1/admin/restaurants/onboard', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ─── Features ───────────────────────────────────────────────────────

export async function getFeatureCatalog() {
  return apiFetch<{ features: FeatureMeta[]; plans: PlanDefinition[] }>('/api/v1/admin/features/catalog');
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

// ─── Combo Menus ────────────────────────────────────────────────────

export interface ComboStepItem {
  id?: number;
  menu_item_id: number;
  price_delta: number;
  menu_item?: {
    id: number;
    name: string;
    image_url?: string;
    modifiers?: MenuItemModifier[];
  };
}

export interface ComboStep {
  id?: number;
  name: string;
  min_picks: number;
  max_picks: number;
  sort_order: number;
  fixed_modifier_name?: string | null;
  items: ComboStepItem[];
}

export interface ComboMenu {
  id: number;
  restaurant_id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  steps: ComboStep[];
  created_at?: string;
}

export interface ComboInput {
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  sort_order?: number;
  steps: {
    name: string;
    min_picks: number;
    max_picks: number;
    sort_order: number;
    fixed_modifier_name?: string | null;
    items: { menu_item_id: number; price_delta: number }[];
  }[];
}

export interface MenuItemRef {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  category_name?: string;
  modifiers?: MenuItemModifier[];
}

export interface MenuCategory {
  id: number;
  name: string;
  items: MenuItemRef[];
}

export async function listCombos(restaurantId: number) {
  return apiFetch<{ combos: ComboMenu[] }>(
    `/api/v1/combos?restaurant_id=${restaurantId}`
  );
}

export async function getCombo(restaurantId: number, comboId: number) {
  return apiFetch<{ combo: ComboMenu }>(
    `/api/v1/combos/${comboId}?restaurant_id=${restaurantId}`
  );
}

export async function createCombo(restaurantId: number, input: ComboInput) {
  return apiFetch<{ combo: ComboMenu }>(
    `/api/v1/combos?restaurant_id=${restaurantId}`,
    { method: 'POST', body: JSON.stringify(input) }
  );
}

export async function updateCombo(restaurantId: number, comboId: number, input: ComboInput) {
  return apiFetch<{ combo: ComboMenu }>(
    `/api/v1/combos/${comboId}?restaurant_id=${restaurantId}`,
    { method: 'PUT', body: JSON.stringify(input) }
  );
}

export async function deleteCombo(restaurantId: number, comboId: number) {
  return apiFetch<{ deleted: boolean }>(
    `/api/v1/combos/${comboId}?restaurant_id=${restaurantId}`,
    { method: 'DELETE' }
  );
}

export async function fetchMenuItems(restaurantId: number): Promise<MenuCategory[]> {
  // Use staff endpoint so combo_only items are included (public endpoint filters them out)
  const data = await apiFetch<{ categories: MenuCategory[] }>(
    `/api/v1/menu?restaurant_id=${restaurantId}`
  );
  return data.categories || [];
}

// ─── Menu Management ────────────────────────────────────────────────

export interface MenuItemModifier {
  id: number;
  menu_item_id: number;
  name: string;
  action: 'add' | 'remove';
  category: string;
  price_delta: number;
  is_active: boolean;
  sort_order: number;
  max_selection: number;
  free_quantity: number;
  extra_price: number;
}

export interface MenuItemFull {
  id: number;
  category_id: number;
  name: string;
  description: string;
  image_url: string;
  price: number;
  is_active: boolean;
  combo_only: boolean;
  sort_order: number;
  modifiers?: MenuItemModifier[];
}

export interface MenuCategoryFull {
  id: number;
  restaurant_id: number;
  name: string;
  image_url: string;
  sort_order: number;
  items: MenuItemFull[];
}

export async function fetchMenuFull(restaurantId: number): Promise<MenuCategoryFull[]> {
  const data = await apiFetch<{ categories: MenuCategoryFull[] }>(
    `/api/v1/menu?restaurant_id=${restaurantId}&include_inactive_modifiers=true`
  );
  return data.categories || [];
}

export async function bulkCreateModifiers(restaurantId: number, modifiers: {
  menu_item_id: number; name: string; action: string; category?: string;
  price_delta: number; is_active: boolean; sort_order?: number;
}[]) {
  return apiFetch<{ modifiers: MenuItemModifier[] }>(
    `/api/v1/menu/modifiers/bulk?restaurant_id=${restaurantId}`,
    { method: 'POST', body: JSON.stringify({ modifiers }) }
  );
}

export async function deleteModifier(restaurantId: number, modifierId: number) {
  return apiFetch<void>(
    `/api/v1/menu/modifiers/${modifierId}?restaurant_id=${restaurantId}`,
    { method: 'DELETE' }
  );
}

// ─── Payment Provider Config ────────────────────────────────────────

export type PaymentProvider = 'payplus' | 'sumit' | 'cibus' | 'verifone' | 'stancer';

export interface PaymentConfigResponse {
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
  verifone_stored_credential_model?: 'RECURRING' | 'NONE';
  verifone_token_charging_enabled?: boolean;
  verifone_invoice4u_enabled?: boolean;
  masked_verifone_user_id?: string;
  masked_verifone_api_key?: string;
  masked_verifone_entity_id?: string;
  masked_verifone_checkout_payment_contract_id?: string;
  masked_verifone_token_payment_contract_id?: string;
  masked_verifone_installments_payment_contract_id?: string;
  masked_verifone_threeds_contract_id?: string;
  masked_verifone_token_scope?: string;
  masked_verifone_public_key_alias?: string;
  masked_stancer_secret_key?: string;
  masked_stancer_public_key?: string;
}

export interface UpdatePaymentConfigInput {
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
  verifone_stored_credential_model?: 'RECURRING' | 'NONE';
  verifone_user_id?: string;
  verifone_api_key?: string;
  verifone_entity_id?: string;
  verifone_checkout_payment_contract_id?: string;
  verifone_token_payment_contract_id?: string;
  verifone_installments_payment_contract_id?: string;
  verifone_threeds_contract_id?: string;
  verifone_token_scope?: string;
  verifone_public_key_alias?: string;
  verifone_token_charging_enabled?: boolean;
  verifone_invoice4u_enabled?: boolean;
  stancer_secret_key?: string;
  stancer_public_key?: string;
}

export async function getPaymentConfig(restaurantId: number): Promise<PaymentConfigResponse> {
  return apiFetch<PaymentConfigResponse>(`/api/v1/admin/restaurants/${restaurantId}/payment-config`);
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

// ─── Market & Playbook ──────────────────────────────────────────────

export interface Objection {
  q: string;
  a: string;
}

export interface Competitor {
  name: string;
  notes: string;
}

export interface LeadSegment {
  id: number;
  slug: string;
  name: string;
  description: string;
  pain_points: string[];
  key_features: string[];
  pitch_angle: string;
  objections: Objection[];
  demo_notes: string;
  pricing_notes: string;
  typical_deal_size: string;
  disqualifiers: string[];
  competitors: Competitor[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LeadSegmentWithCount extends LeadSegment {
  prospect_count: number;
}

export interface LeadSegmentInput {
  slug: string;
  name: string;
  description: string;
  pain_points: string[];
  key_features: string[];
  pitch_angle: string;
  objections: Objection[];
  demo_notes: string;
  pricing_notes: string;
  typical_deal_size: string;
  disqualifiers: string[];
  competitors: Competitor[];
  sort_order: number;
}

export type ProspectStatus = 'researching' | 'pitched' | 'won' | 'lost' | 'on_hold';

export type ProspectCloseReason =
  | ''
  | 'price'
  | 'competitor_won'
  | 'feature_gap'
  | 'timing'
  | 'no_decision_maker'
  | 'ghosted'
  | 'other';

export const PROSPECT_STATUSES: ProspectStatus[] = [
  'researching',
  'pitched',
  'won',
  'lost',
  'on_hold',
];

export const CLOSED_PROSPECT_STATUSES: ProspectStatus[] = ['won', 'lost', 'on_hold'];

export function isClosedStatus(s: ProspectStatus): boolean {
  return CLOSED_PROSPECT_STATUSES.includes(s);
}

export interface MarketProspect {
  id: number;
  segment_id: number | null;
  name: string;
  city: string;
  website: string;
  socials: string;
  notes: string;
  starred: boolean;
  status: ProspectStatus;
  what_offered: string[];
  loved: string[];
  did_not_love: string[];
  close_reason: ProspectCloseReason;
  close_reason_detail: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  segment?: LeadSegment | null;
}

export interface MarketProspectInput {
  segment_id: number | null;
  name: string;
  city: string;
  website: string;
  socials: string;
  notes: string;
  starred: boolean;
  status: ProspectStatus;
  what_offered: string[];
  loved: string[];
  did_not_love: string[];
  close_reason: ProspectCloseReason;
  close_reason_detail: string;
}

export interface ProspectFilters {
  segment_id?: number;
  starred?: boolean;
  status?: ProspectStatus;
  search?: string;
}

export async function listSegments() {
  return apiFetch<{ segments: LeadSegmentWithCount[] }>('/api/v1/admin/market/segments');
}

export async function getSegment(slug: string) {
  return apiFetch<{ segment: LeadSegment }>(`/api/v1/admin/market/segments/${encodeURIComponent(slug)}`);
}

export async function createSegment(input: LeadSegmentInput) {
  return apiFetch<{ segment: LeadSegment }>('/api/v1/admin/market/segments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSegment(id: number, input: LeadSegmentInput) {
  return apiFetch<{ segment: LeadSegment }>(`/api/v1/admin/market/segments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteSegment(id: number) {
  return apiFetch<{ deleted: boolean }>(`/api/v1/admin/market/segments/${id}`, {
    method: 'DELETE',
  });
}

export async function listProspects(filters?: ProspectFilters) {
  const qs = new URLSearchParams();
  if (filters?.segment_id) qs.set('segment_id', String(filters.segment_id));
  if (filters?.starred) qs.set('starred', 'true');
  if (filters?.status) qs.set('status', filters.status);
  if (filters?.search) qs.set('search', filters.search);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<{ prospects: MarketProspect[] }>(`/api/v1/admin/market/prospects${query}`);
}

export async function createProspect(input: MarketProspectInput) {
  return apiFetch<{ prospect: MarketProspect }>('/api/v1/admin/market/prospects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateProspect(id: number, input: MarketProspectInput) {
  return apiFetch<{ prospect: MarketProspect }>(`/api/v1/admin/market/prospects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteProspect(id: number) {
  return apiFetch<{ deleted: boolean }>(`/api/v1/admin/market/prospects/${id}`, {
    method: 'DELETE',
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

// ─── Environment clone ──────────────────────────────────────────────
//
// Moves one restaurant's whole dataset between environments so a production bug
// can be reproduced with the real data. The bundle travels through this browser:
// export it from one environment, then upload it to the other. Each half is
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

export async function getCloneStatus(): Promise<CloneStatus> {
  return apiFetch<CloneStatus>('/api/v1/admin/env-clone/status');
}

export async function getCloneRestaurants(): Promise<{ restaurants: CloneRestaurant[] }> {
  return apiFetch<{ restaurants: CloneRestaurant[] }>('/api/v1/admin/env-clone/restaurants');
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
export async function applyCloneBundle(file: File, confirm: boolean): Promise<CloneReport> {
  const token = getToken();
  const form = new FormData();
  form.append('bundle', file);

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
