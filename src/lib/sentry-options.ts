import * as Sentry from '@sentry/nextjs';

function tracesSampleRate(): number {
  const parsed = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1');
  if (!Number.isFinite(parsed)) return 0.1;
  return Math.min(1, Math.max(0, parsed));
}

function withoutQuery(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return value.split('?')[0];
  }
}

export function getSentryOptions(): Parameters<typeof Sentry.init>[0] {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 3,
    },
    tracesSampleRate: tracesSampleRate(),
    normalizeDepth: 3,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data?.url) {
        breadcrumb.data.url = withoutQuery(breadcrumb.data.url);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.request) {
        event.request.data = undefined;
        event.request.query_string = undefined;
        event.request.url = withoutQuery(event.request.url) as string | undefined;
        if (event.request.headers) {
          const headers = { ...event.request.headers };
          for (const key of Object.keys(headers)) {
            if (['authorization', 'cookie', 'set-cookie', 'x-api-key'].includes(key.toLowerCase())) {
              delete headers[key];
            }
          }
          event.request.headers = headers;
        }
      }

      event.user = event.user?.id ? { id: String(event.user.id) } : undefined;
      return event;
    },
  };
}
