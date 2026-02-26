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
  | 'push_notif';

export type PlanTier = 'starter' | 'premium' | 'enterprise';

export interface OnboardInput {
  restaurant_name: string;
  slug?: string;
  address?: string;
  phone?: string;
  timezone?: string;
  owner_id?: number;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  owner_password?: string;
  plan_tier: PlanTier;
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

// ─── Restaurants ────────────────────────────────────────────────────

export async function listRestaurants(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<{ restaurants: Restaurant[] }>(`/api/v1/admin/restaurants${query}`);
}

export async function getRestaurant(id: number) {
  return apiFetch<{ restaurant: Restaurant }>(`/api/v1/admin/restaurants/${id}`);
}

export async function onboardRestaurant(input: OnboardInput) {
  return apiFetch<{ restaurant: Restaurant }>('/api/v1/admin/restaurants/onboard', {
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
