# Foody Backoffice

Internal superadmin dashboard for the Foody team. Used to manage the entire platform: onboard restaurants, configure feature flags, monitor subscriptions, and manage users. **Not visible to restaurant owners** — access is restricted to Foody employees with the `superadmin` role.

## Environments

| Environment | Domain | API | Branch |
|-------------|--------|-----|--------|
| **Production** | `backoffice.foody-pos.co.il` | `api.foody-pos.co.il` | Manually promoted `develop` artifact |
| **Development** | `dev-backoffice.foody-pos.co.il` | `dev-api.foody-pos.co.il` | `develop` |
| **Local** | `localhost:3002` | `localhost:8080` | any |

Operational status, error monitoring, and the incident workflow are documented
in [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md). The backoffice exposes the
operator entry point at **Platform → Operations**.

Operations also offers **Verifone JSON diagnostics**: superadmins can enable or
disable filtered request/response bodies immediately in the development API.
The setting persists until disabled; production is blocked server-side. See the
observability guide for filtering, auditing and CloudWatch access.

**Terminal fleet** is the superadmin inventory for registered Verifone hardware.
On a development API with the VHQ CST configuration, Backoffice stages the
reviewed SHVA parameter in VHQ and sends DID and parameter-download authorizations
to the matching enrolled diagnostic POS. Record the observed identifiers on the
terminal after checking synchronization. Production, replacement and transfer
requests remain preparation only.

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

The navigation groups work under **Management**, **Payments & devices**,
**POS content** and **Platform**. The header shows which API the workspace
uses. On smaller screens, use **Open navigation** to display the sections.

**Market** is retired from the Backoffice. Open **Payments & devices → Plans & modules** for public rates. Restaurant feature settings are under **Features & access**. The old **Menu Manager** and **Combo Menus** links redirect to Restaurants. Use Foody Admin to edit menus and combos.

### Cibus (Pluxee) (`/dashboard/payments`)

**Payments & devices → Cibus (Pluxee)** opens Foody's platform settings for
the Cibus environment, API endpoint and optional integrator credentials.
Restaurants enter their terminal identifiers separately in Foody Admin.
The form requires a successful settings load before it accepts changes.

### Verifone terminal inventory (`/dashboard/terminals`)

Superadmins can search across restaurants by name or terminal identifier. Use
**Register a Mini** to add a Mini by physical serial number and restaurant when
it has only been configured on the iPad. Registered Portables appear through
the existing device inventory.

**Edit inventory** records declared DID, VHQ deviceUid, SHVA terminal number,
Ashrait provisioning ID, supplier, acquirer and repair or return status.
**Change requests** prepares a reconfiguration, a same-restaurant replacement
or a transfer of a returned terminal. Compare the declared and requested
identifiers before saving. Open the same history to cancel an unused request.
For a CST configuration request, keep FoodyPOS open on the selected Portable
or paired iPad. Authorize the DID if needed. Stage the SHVA number in VHQ when
it differs, then authorize the parameter download. Verify the actual values on
the terminal and record them in the request. Use **Check VHQ status** to read
back an uncertain write. Each authorization may be claimed once.

Apply API migrations 309–312 after the existing development migrations before
testing this dashboard.

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

**Features & access tab**
- Restaurant info (address, phone, timezone, pickup/delivery flags)
- Owner details
- **Copy prod → dev** — connect as superadmin to both environments, preview
  the selected production restaurant, then confirm replacing its dev data.
  The same action is available under **Platform → Clone data**. Stock is included by
  default. Payment credentials, staff identities, push registrations and live
  integrations are excluded. A conflicting restaurant ID blocks the copy.
  Credentials for the other environment stay in memory until the dialog closes.
- Plan selector — change plan tier (resets feature flags to plan defaults)
- Feature flag matrix — per-restaurant on/off toggles grouped by category (Core, Ordering, Operations, Intelligence, Notifications)

**Billing & modules tab**
- Subscription status, plan tier, payment method (card brand + last 4)
- Trial end date / next billing date / grace period deadline
- Manual **Activate** and **Deactivate** buttons for support use
- Full payment event history (payment succeeded / failed events with amounts)

### Onboard (`/dashboard/onboard`)

Open **Management → Restaurants → Onboard New** to start the wizard:
1. Fill in owner details (name, email, phone, password)
2. Fill in restaurant details (name, slug, address, timezone, plan tier)
3. Submit → creates owner user + restaurant + 30-day trial subscription in one atomic operation

### Users (`/dashboard/users`)

List all users across the platform with role, email, and restaurant associations. Useful for support and debugging.

### Operations (`/dashboard/operations`)

Internal incident-response entry point:
- Live production and development availability checks
- Links to Sentry, Grafana, and deployment evidence when configured
- A French incident guide at `/dashboard/operations/guide` covering severity,
  the role of every observability module and Foody service, safety rules, and
  concrete runbooks starting from an alert or a customer report, including the
  per-restaurant Sumit and Twilio Tech Provider boundaries

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

## Plans, modules and feature access

**Plans & modules** shows the public software rates and included licences from the API, with a table of the feature flags each module grants. [Public pricing](https://foody-pos.co.il/en/pricing)

When you open a restaurant, **Billing & modules** shows the subscription. For restaurants in the development pilot, it shows the offer, the modules in the offer, the currently active modules, the licences and the trial or paid period. **Features & access** shows those restaurants’ current flags in read-only form.

For existing contracts, **Billing & modules** shows the legacy subscription and any private sandbox offer. Use **Features & access** for the existing tier and manual flag controls. Changing the legacy tier resets flags to its defaults.

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Icons | Heroicons v2 |
| State | `useState` + `useEffect` (no external state lib) |
| API calls | Centralized in `src/lib/api.ts` |
| Auth | Cookie-bound encrypted session reference, superadmin role required |

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
- A 202 response opens the authenticator step. The portal checks the role only after sign-in is complete.
- A tab left on the sign-in form across a release checks the current page before submitting a password. If it refreshes, enter your credentials on the refreshed page.
- Role must be `superadmin` — any other role gets rejected at login
- The API encrypts the credential and binds it to a Secure HttpOnly cookie for this browser. Backoffice keeps the encrypted reference under `foody_backoffice_portal_session`.
- Authenticated portal requests send the reference and its matching API cookie.

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

### Verifone hosted wallets

Restaurant → Payment → Verifone offers separate Apple Pay / Google Pay switches
and write-only payment contract UUIDs. Apply API migration
`257_verifone_hosted_wallets.sql` and deploy API first. Both default off; this
form does not activate wallets in Verifone Central. Enable only after Verifone
confirms ABS support, the environment's contracts and SCA NONE, and activates the
wallet on the PPC's organization. Contract IDs remain encrypted server-side and
masked on reload; blank inputs retain saved values. Disable wallets before
changing environment.

The choices appear on Verifone HPP, not as native Foody buttons. They apply to
ordinary immediate fixed-amount payments only, not saved-card registration,
installments or authorization holds. Invoice4U issuance must be verified separately
in acceptance. No new environment variable or guest Web change is required.

### Verifone hosted-page branding

The Verifone Payment tab shows customer-language behavior and a restaurant theme
status. Save payment settings, then choose **Synchronize published logo and colors**.
This superadmin action uploads the published PNG/JPEG/WebP logo when present and
creates a versioned theme; it never initiates a charge or changes the account's
default theme. Unsaved payment edits block synchronization. Draft branding is not
included. Changed published branding is marked outdated until synchronized again.

Migration `258_verifone_checkout_theme.sql` and API support must deploy first.
The enabled switch can revert future links to the account default without deleting
the saved theme. Disable it before changing organization/environment and synchronize
again afterwards. Existing links keep their previous presentation. Private/logo
redirect URLs and SVG are rejected; use a public HTTPS PNG/JPEG/WebP asset.
Synchronization failures remain visible and do not overwrite the working theme.

### Commands

```bash
cd foodybackoffice
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type check
npm run build         # Full production build (catches all errors)
```

Always run `npm run build` locally before pushing — CI runs the same command on Vercel.

## Deployment (Vercel)

Keep the development domain assigned to the Preview branch `dev-portal-routing`. The **Publish development portal** workflow selects a successful Vercel build of the current `develop` commit, checks the Git revision served by `/login`, and publishes a static rewrite to that immutable deployment. The generated branch contains only routing metadata. The same verified application artifact remains available for manual production promotion.

After a release, compare the public `X-Foody-Login-Revision` header on `/login` with the application commit. Retry the workflow on `develop` if publication failed. Both portal projects use the routing action in this repository. Foody Admin pins it to an immutable commit.

The development homepage redirects to `/login` for Admin and to `/dashboard` for Backoffice. The Backoffice dashboard takes signed-out visitors to `/login`. The publisher checks each homepage redirect, its destination and the login revision on both the application deployment and the development domain. This restores the entry points covered by the French, Hebrew and English sign-in guides.

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

## Documentation release contract

`docs/help/contract.json` records the reviewed source hashes and feature mappings.
`node scripts/check-help-contract.mjs --documentation-root ../foodylanding --base origin/develop`
checks local preparation. Remote CI uses a pinned immutable Landing commit and
checks all French, Hebrew and English procedures. New source and behavior changes
require an updated inventory/guide release or an exact reviewed no-user-impact
explanation. See Landing’s `docs/help/MAINTENANCE.md` for the complete workflow.

Canonical production/development backoffice hosts select their matching API at
runtime so the exact verified development artifact can be promoted to production.
The build's Content Security Policy explicitly permits both canonical API origins
so the browser can use that runtime selection in either environment.

## Versioned plans and licence quotas (production and development)

The matching migration 320/API provides editable public modules, composed plans,
prices and categorized capabilities. Superadmins can edit and publish the
production catalogue as well as the development catalogue. The environment
notice explains which public rates change, after about one minute of website
cache. Review changes before publishing; publication never charges a customer.
Employee accounts and physical POS devices use separate quotas. Subscription
checkouts and paid additions remain a separate sandbox pilot. Quotes & orders
are available to superadmins in production and development without charging customers. Onboarding checks the
dedicated sandbox-only onboarding-catalog endpoint, not the editable catalogue.
Accepted contracts and invitations retain their version. See the synchronized
FR/HE/EN billing, staff and catalogue help for the sandbox test procedures.

### Commercial quotations and orders (production and development)

**Payments & devices → Plans & modules → Quotes & orders** composes Foody PDFs
with the owned dark logo in Hebrew, French or English. Set Foody's actual company
identity in **Issuer settings**; sample customer/supplier identities are not
application defaults. The customer can be a prospect or a linked restaurant.

Use catalogue plans/modules, hardware and tariff rows, or a custom item. Every
line has a quantity, agreed unit price and payment schedule. Monthly lines have
an optional minimum commitment. Prepaid subscriptions cover 1–120 months; their
price is for the **whole period per unit**. Changing the period retains the
negotiated package price; **Use catalogue price** explicitly recalculates it.
One-time/prepaid, monthly and usage amounts remain separate. HT/TTC/no-VAT
pricing and VAT rate are explicit. Catalogue quotas are shown per unit; the
full feature list is optional.

**Save draft** freezes the source catalogue. **Preview PDF** produces a marked
draft. **Review & finalize → Finalize document** creates an immutable numbered
archive. **Create order draft** copies an issued quotation into its single order
draft without recording customer acceptance. These actions send no email,
collect no payment and do not change customer subscriptions or licences.
Concurrent edits return a conflict; local edits remain available for recovery.

API migration **321** adds private document storage. Deploy the matching API
before this UI. All document endpoints require an authenticated superadmin in
either environment. No customer invoice or subscription is changed.
Validation: `node --test scripts/commercial-documents.test.mjs`, lint, TypeScript,
build and the service help contract. The API's opt-in `TestBrowserWorkspace`
harness supports local browser checks with a synthetic in-memory database.

For the synthetic browser flow, start the API harness and `npx next start -p
19083 -H 127.0.0.1`, then run `node scripts/commercial-documents.browser.cjs`.
Playwright must be available (or set `FOODY_BROWSER_PLAYWRIGHT_PATH` to its
installed directory). The check blocks external requests, verifies mixed pricing,
PDF download/archive, quote-to-order conversion, stale-edit recovery and mobile
overflow. `FOODY_COMMERCIAL_SAMPLE_DIR` optionally retains synthetic screenshots
and PDFs. Stop the test API with `POST http://127.0.0.1:19082/__test/stop`.

The document workspace's response CSP permits `blob:` PDF frames and objects on
`/dashboard/features` only. Other pages retain `object-src 'none'`; all pages keep
`frame-ancestors 'none'` and `X-Frame-Options: DENY`. No external object origin is
allowed. Browser acceptance must check the visible PDF viewer, not only the modal
and downloaded bytes. Help impact review: this restores the PDF preview already
documented in the FR/HE/EN commercial-document guides; labels, actions, permissions,
prices and contracts are unchanged, so those procedures need no translation change.

## Reviewed commercial grid — 16 November 2026

The software catalogue uses three independent modules: Restaurant 590 ILS/month
with 2 active POS devices, Orders 590 standalone, and Kitchen 890 with 1 chef and
1 KDS. Restaurant + Online is 990 with 2 devices; recommended Foody Integral is
1,790 with 3 devices, 1 chef and 1 KDS. Additional active POS devices cost 149.
All prices exclude VAT and are per site. Personal POS accounts are not charged
per employee on these offers; historical named-user grants keep their rules.
Restaurant includes the table-QR web interface; remote ordering remains Orders.
Hardware, setup, payment services and options are separate.

The API owns the versioned catalogue. Its reviewed seed is
`foodyserver/internal/entitlements/offer-grid.json`; Landing keeps the identical
marketing grid. **Load reviewed software offers** prepares the
Backoffice draft without publishing it or overwriting equipment/payment prices.
Automatic bundles apply only to new exact-module selections and never remove
features or capacity. Saved quotations, invitations, trials, negotiated prices
and accepted grants retain their snapshots. Production activation requires the
normal coordinated API/client release and catalogue review. Publish the matching
Backoffice artifact before the API in production to keep legacy onboarding
available throughout this release.

## Monthly and annual terms — 18 November 2026

Standard monthly software has no minimum commitment. The API billing policy
calculates annual module and plan prices as 11 monthly amounts for 12 months
prepaid (24 for 22). Licences and payment services keep their full period cost.
The catalogue editor previews the annual amount. New quotes use this policy;
saved documents freeze it, while historical quotes without it keep their prior
reference. Negotiated amounts remain explicit and are never silently repriced.
Annual software savings appear in totals and PDF when applicable.

Prepaid benefits stack with the annual saving: 12 months include one relevant
setup service, 24 months include relevant website/setup services and one training
day. Add selected gifts as Included lines and record the scope in quote terms;
there is no automatic gift insertion. Kitchen assistance remains quoted.
The internal FR/HE/EN guides describe this flow. Checkouts and renewals stay
sandbox-only. No existing contract, saved invitation or private offer is migrated.
