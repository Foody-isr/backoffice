# Foody Backoffice

Internal superadmin dashboard for the Foody team. Used to manage the entire platform: onboard restaurants, configure feature flags, monitor subscriptions, and manage users. **Not visible to restaurant owners** — access is restricted to Foody employees with the `superadmin` role.

## Environments

| Environment | Domain | API | Branch |
|-------------|--------|-----|--------|
| **Production** | `backoffice.foody-pos.co.il` | `api.foody-pos.co.il` | `main` |
| **Development** | `dev-backoffice.foody-pos.co.il` | `dev-api.foody-pos.co.il` | `develop` |
| **Local** | `localhost:3002` | `localhost:8080` | any |

## Quick Start

```bash
cd foodybackoffice
npm install
npm run dev   # runs on http://localhost:3002
```

### Local `.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

For testing against the dev server:

```bash
NEXT_PUBLIC_API_URL=https://dev-api.foody-pos.co.il
```

## Purpose in the Foody Ecosystem

Foody is a multi-tenant restaurant POS & QR ordering platform. The backoffice is the **Foody company's control center** that sits above all restaurants:

```
foodybackoffice  ← You are here (Foody internal team)
       ↓ manages
  foodyserver (API)
       ↓ serves
  foodyweb (QR guests) + foodypos (POS tablets) + foodyadmin (restaurant owners)
```

Superadmins use the backoffice to:
- **Onboard** new restaurants (creates owner account + restaurant record + trial subscription)
- **Monitor** all restaurants, subscriptions, and payment health across the platform
- **Configure** feature flags and plan limits per restaurant
- **Manage** users and roles

## Pages & Features

### Dashboard (`/dashboard`)

Platform-wide KPIs shown at a glance:
- Total restaurants, active users, total orders, total revenue
- Past-due subscription alert — highlighted warning list of restaurants that have missed payments and are in the grace period
- Plan breakdown (Starter / Premium / Enterprise distribution)

### Restaurants (`/dashboard/restaurants`)

Full list of all onboarded restaurants with:
- Name, slug, owner, assigned plan, subscription status badge (trial / active / past_due / deactivated / cancelled)
- Search by name or slug
- Link to individual restaurant detail page

#### Restaurant Detail (`/dashboard/restaurants/[id]`)

Two tabs:

**Features tab**
- Restaurant info (address, phone, timezone, pickup/delivery flags)
- Owner details
- Plan selector — change plan tier (resets feature flags to plan defaults)
- Feature flag matrix — per-restaurant on/off toggles grouped by category (Core, Ordering, Operations, Intelligence, Notifications)

**Billing tab**
- Subscription status, plan tier, payment method (card brand + last 4)
- Trial end date / next billing date / grace period deadline
- Manual **Activate** and **Deactivate** buttons for support use
- Full payment event history (payment succeeded / failed events with amounts)

### Onboard (`/dashboard/onboard`)

Wizard to onboard a new restaurant:
1. Fill in owner details (name, email, phone, password)
2. Fill in restaurant details (name, slug, address, timezone, plan tier)
3. Submit → creates owner user + restaurant + 30-day trial subscription in one atomic operation

### Users (`/dashboard/users`)

List all users across the platform with role, email, and restaurant associations. Useful for support and debugging.

### Subscriptions (`/dashboard/subscriptions`) *(via API)*

Admin subscription endpoints used by the billing tab and dashboard alert:
- `GET /api/v1/admin/subscriptions?status=past_due` — filter by status
- `POST /api/v1/admin/restaurants/:id/subscription/activate`
- `POST /api/v1/admin/restaurants/:id/subscription/deactivate`

## Subscription System

Restaurants go through the following lifecycle:

```
Onboard → trial (30 days)
              ↓ (owner sets up card in foodyadmin)
           active  ←── recurring monthly charge succeeds
              ↓  (charge fails)
           past_due  (7-day grace period)
              ↓  (grace period expires, no card update)
         deactivated  (restaurant loses API access → 402 returned)
```

- Deactivated restaurants get HTTP 402 on all protected API calls
- Superadmin can manually activate/deactivate from the Billing tab
- The scheduler runs every 24h to enforce grace period expirations and trial expirations

## Feature Flags & Plans

Plans define a set of default-enabled features:

| Plan | Monthly | Key Inclusions |
|------|---------|----------------|
| **Starter** | ₪299 | POS, menu management, receipt printing, pickup/takeaway, push notifications |
| **Premium** | ₪799 | Everything in Starter + QR dine-in, online payments, delivery, stock management, advanced analytics, WhatsApp |
| **Enterprise** | Custom | Everything in Premium + multi-restaurant, custom API, priority support |

Changing a restaurant's plan resets all feature flags to the plan's defaults. Individual flags can then be overridden per-restaurant.

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Icons | Heroicons v2 |
| State | `useState` + `useEffect` (no external state lib) |
| API calls | Centralized in `src/lib/api.ts` |
| Auth | JWT stored in `localStorage`, role must be `superadmin` |

## Project Structure

```
src/
  app/
    login/                  # Login page (superadmin only)
    dashboard/
      page.tsx              # Platform dashboard (KPIs + past-due alerts)
      onboard/page.tsx      # New restaurant onboarding wizard
      restaurants/
        page.tsx            # Restaurant list with subscription badges
        [id]/page.tsx       # Restaurant detail (features + billing tabs)
      users/page.tsx        # User management
  lib/
    api.ts                  # All API functions + TypeScript types
    auth-context.tsx        # Auth state, token storage, superadmin guard
    utils.ts                # planColor, formatDate, categoryInfo helpers
  components/
    Sidebar.tsx             # Nav sidebar
```

## Authentication

- Login at `/login` with email + password
- JWT returned by `POST /api/v1/auth/login`
- Role must be `superadmin` — any other role gets rejected at login
- Token stored in `localStorage` under `foody_backoffice_token`
- All API calls send `Authorization: Bearer <token>`

## API Reference (used by this app)

All calls go to `NEXT_PUBLIC_API_URL/api/v1/...` with `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Login |
| `GET` | `/admin/restaurants` | List all restaurants |
| `GET` | `/admin/restaurants/:id` | Restaurant detail + features |
| `POST` | `/admin/restaurants/onboard` | Onboard new restaurant |
| `GET` | `/admin/features/catalog` | Feature catalog + plan definitions |
| `POST` | `/admin/restaurants/:id/features/:key` | Toggle feature flag |
| `POST` | `/admin/restaurants/:id/plan` | Change plan tier |
| `GET` | `/admin/users` | List all users |
| `GET` | `/admin/subscriptions` | List all subscriptions (filterable by status) |
| `GET` | `/restaurants/:id/subscription` | Get restaurant subscription detail |
| `POST` | `/admin/restaurants/:id/subscription/activate` | Manually activate |
| `POST` | `/admin/restaurants/:id/subscription/deactivate` | Manually deactivate |

## Validation & Pre-push

```bash
cd foodybackoffice
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type check
npm run build         # Full production build (catches all errors)
```

Always run `npm run build` locally before pushing — CI runs the same command on Vercel.

## Deployment (Vercel)

| Setting | Value |
|---------|-------|
| Root Directory | `foodybackoffice` |
| Framework | Next.js |
| Build Command | `npm run build` |
| Install Command | `npm install` |

**Environment variable to set in Vercel:**

```
NEXT_PUBLIC_API_URL=https://api.foody-pos.co.il
```

**Custom domain:** `backoffice.foody-pos.co.il`

DNS: `CNAME backoffice.foody-pos.co.il → cname.vercel-dns.com`

## Security Notes

- This app is for **internal Foody team use only** — do not share the URL publicly
- Always use HTTPS in production (enforced by Vercel)
- The `superadmin` role check is enforced both on the frontend (login rejection) and on every API endpoint in `foodyserver`
- Never store secrets in this app — it only needs `NEXT_PUBLIC_API_URL`
