# Foody observability

This document describes the minimum production observability stack for Foody.
It deliberately separates customer-facing diagnostics from raw telemetry: the
backoffice shows service status and links to the systems that own errors, logs,
metrics, and deployments. It must not become a second log store.

The operator-facing runbook is available at **Backoffice → Operations → Incident
guide**. It is the preferred first response for Foody support: it maps each
signal to the right evidence, explains every module and service, and provides
step-by-step scenarios. Keep this document for implementation and configuration
details; keep the in-product guide focused on decisions during an incident.

## Recommended starter stack

| Signal | System | Purpose |
|---|---|---|
| Application errors and traces | Sentry | Group exceptions, correlate releases, and alert on regressions |
| Centralised API and infrastructure logs | Grafana Cloud Logs | Search structured logs across releases and instances |
| Metrics and external probes | Grafana Cloud Metrics / Synthetic Monitoring | Alert on availability, latency, saturation, and error rate |
| Instrumentation contract | OpenTelemetry | Keep traces, metrics, and logs portable between vendors |
| Operator entry point | Backoffice Operations | Confirm scope and open the relevant evidence quickly |
| Account-free uptime fallback | GitHub Actions | Probe nine public entry points every five minutes and maintain an assigned incident issue on failure |

Sentry and Grafana Cloud both have free starter tiers. Keep the two tools: they
solve different problems. Sentry is exception-first; Grafana is service and
infrastructure-first.

Until Grafana Synthetic Monitoring is configured, the
`Monitor Public Services` GitHub workflow provides an independent fallback. It
checks the production and development API, ordering, admin, backoffice, and
landing entry points every five minutes. API checks also require the health JSON
body to contain `status: ok`. Network errors are retried twice; HTTP failures
fail the workflow, while responses slower than two seconds produce warnings.
The workflow opens one assigned issue when an outage begins, avoids duplicate
issues while it persists, and closes the issue after a successful recovery run.
The assignee must keep issue notifications enabled for the repository. GitHub
notification settings should also include failed Actions runs as a fallback.
This fallback is not an SLA monitor and should remain secondary once an external
probe provider is active.

To test the alert path without interrupting a service, manually run **Monitor
Public Services** with **simulate_failure** enabled. The workflow executes every
real probe first, then deliberately fails, opens and assigns the normal incident
issue, and closes it with a drill comment. The expected workflow conclusion is
failure: that is what exercises the same notification channel as a real outage.
Never test this path by changing a production endpoint or credential.

## Backoffice configuration

Configure these variables separately in development and production:

```dotenv
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_SENTRY_DASHBOARD_URL=
NEXT_PUBLIC_GRAFANA_DASHBOARD_URL=
NEXT_PUBLIC_GITHUB_ACTIONS_URL=
```

`SENTRY_AUTH_TOKEN` is build-only and must be stored in the hosting provider's
secret store. It must never use the `NEXT_PUBLIC_` prefix. The DSN is public by
design, but it still belongs in environment configuration rather than source.

The SDK is disabled when `NEXT_PUBLIC_SENTRY_DSN` is empty. Request bodies,
cookies, authorization headers, query strings, stack variables, and default
user information are not collected. Source maps are uploaded only when the
Sentry organisation, project, and build token are present.

## Alert policy

Start with a small number of actionable alerts. Every alert must have an owner,
a response action, and a link to evidence.

| Alert | Initial threshold | Channel |
|---|---|---|
| Production API unavailable | 2 consecutive failures over 2 minutes | Email immediately |
| Production ordering unavailable | 2 consecutive failures over 2 minutes | Email immediately |
| API 5xx ratio | over 2% for 5 minutes and at least 20 requests | Email immediately |
| Payment callback failures | 3 failures in 5 minutes | Email immediately |
| p95 API latency | over 1.5 seconds for 10 minutes | Email during launch, then tune |
| New Sentry regression | first occurrence in production after a release | Email immediately |
| Database/storage saturation | over 80% for 15 minutes | Email warning |
| No successful backup | 26 hours | Email immediately |

Do not alert on a single slow request, development errors, or every log line.
Those create fatigue and make real incidents easier to miss.

## Logging contract

API logs should be structured JSON at the source. Each request log should use a
stable schema:

- `timestamp`, `level`, `service`, `environment`, `release`
- `request_id`, `trace_id`, `route`, `method`, `status`, `duration_ms`
- `restaurant_id` only when needed for support and authorised operator access
- `error_code` and a sanitised error message

Never log tokens, cookies, passwords, OTP values, payment identifiers, card
data, request bodies, customer names, email addresses, or phone numbers. Use a
request ID to correlate a backoffice error with API logs instead.

Run Grafana Alloy or an OpenTelemetry Collector on the API host and export
container logs to Grafana Cloud. Keep local container logs bounded so a logging
failure cannot fill the production disk.

## Incident workflow

1. Open **Backoffice → Operations** and record the first failing timestamp.
2. Confirm whether the problem is isolated to production, development, or one
   service.
3. Open Sentry for the exception and release, then Grafana for matching request
   IDs and infrastructure signals.
4. Contain the smallest scope: roll back the immutable release or disable a
   feature. Do not edit customer or payment data as the first response.
5. Re-run the service checks and one safe customer journey.
6. Write a short incident note with timeline, impact, cause, action, and follow-up.

Payment incidents require additional care. Payment accounts and credentials are
owned and funded by each restaurant; a non-production Foody environment does not
prove that the provider account is a sandbox. Never initiate a live transaction
without the restaurant's explicit approval of the amount, reimbursement method,
and test window. Never mark an order as paid solely from a customer report.

WhatsApp follows the same tenant boundary. Foody participates in Twilio's
[WhatsApp Tech Provider program](https://www.twilio.com/docs/whatsapp/isv/tech-provider-program):
each restaurant completes Meta Embedded Signup, creates or selects its WABA, and
is mapped to a dedicated Twilio subaccount and sender. The restaurant supports
its contracted usage cost; Foody orchestrates onboarding and message delivery.
Production sends must resolve an ONLINE sender for that restaurant and must
never fall back to a shared global Foody sender. For Twilio error `63007`, verify
that the WABA, sender, Account SID, and subaccount all belong to the same
restaurant chain. If onboarding is incomplete, disable WhatsApp only for that
restaurant and complete the connection instead of testing with a global sender.

## Rollout order

1. Create the Sentry and Grafana projects and configure development only.
2. Verify scrubbing with synthetic data and confirm source maps resolve a test
   exception.
3. Add structured API logging and the collector in development.
4. Configure external probes and alert routing; trigger each alert deliberately.
5. Promote the same validated configuration to production with a low trace
   sample rate, then tune from observed traffic.
