import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

type Environment = 'production' | 'development';

interface MonitorTarget {
  id: string;
  service: string;
  environment: Environment;
  url: string;
  expectsHealthBody?: boolean;
}

interface StatusPayload {
  checked_at: string;
  release: string | null;
  services: Awaited<ReturnType<typeof checkTarget>>[];
}

let cachedPayload: StatusPayload | null = null;
let cacheExpiresAt = 0;
let checkInFlight: Promise<StatusPayload> | null = null;

const targets: MonitorTarget[] = [
  {
    id: 'prod-api',
    service: 'API',
    environment: 'production',
    url: 'https://api.foody-pos.co.il/health',
    expectsHealthBody: true,
  },
  {
    id: 'prod-ordering',
    service: 'Guest ordering',
    environment: 'production',
    url: 'https://app.foody-pos.co.il/',
  },
  {
    id: 'prod-admin',
    service: 'Restaurant admin',
    environment: 'production',
    url: 'https://admin.foody-pos.co.il/login',
  },
  {
    id: 'prod-backoffice',
    service: 'Backoffice',
    environment: 'production',
    url: 'https://backoffice.foody-pos.co.il/login',
  },
  {
    id: 'prod-landing',
    service: 'Public website',
    environment: 'production',
    url: 'https://foody-pos.co.il/',
  },
  {
    id: 'dev-api',
    service: 'API',
    environment: 'development',
    url: 'https://dev-api.foody-pos.co.il/health',
    expectsHealthBody: true,
  },
  {
    id: 'dev-ordering',
    service: 'Guest ordering',
    environment: 'development',
    url: 'https://dev-app.foody-pos.co.il/',
  },
  {
    id: 'dev-admin',
    service: 'Restaurant admin',
    environment: 'development',
    url: 'https://dev-admin.foody-pos.co.il/login',
  },
  {
    id: 'dev-backoffice',
    service: 'Backoffice',
    environment: 'development',
    url: 'https://dev-backoffice.foody-pos.co.il/login',
  },
];

async function checkTarget(target: MonitorTarget) {
  const startedAt = performance.now();

  try {
    const response = await fetch(target.url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(5_000),
      headers: { 'User-Agent': 'Foody-Backoffice-Monitor/1.0' },
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    let validHealthBody = true;

    if (target.expectsHealthBody && response.ok) {
      const body = (await response.json().catch(() => null)) as { status?: string } | null;
      validHealthBody = body?.status === 'ok';
    }

    const state = !response.ok || !validHealthBody
      ? 'down'
      : latencyMs > 2_000
        ? 'degraded'
        : 'operational';

    return {
      ...target,
      state,
      latency_ms: latencyMs,
      http_status: response.status,
      detail: validHealthBody ? null : 'Health response was not valid',
    };
  } catch (error) {
    return {
      ...target,
      state: 'down',
      latency_ms: Math.round(performance.now() - startedAt),
      http_status: null,
      detail: error instanceof Error && error.name === 'TimeoutError' ? 'Timed out after 5 seconds' : 'Connection failed',
    };
  }
}

async function collectStatus(): Promise<StatusPayload> {
  const checkedAt = new Date().toISOString();
  const services = await Promise.all(targets.map(checkTarget));

  return {
    checked_at: checkedAt,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    services,
  };
}

export async function GET() {
  const now = Date.now();
  if (!cachedPayload || now >= cacheExpiresAt) {
    checkInFlight ??= collectStatus();
    try {
      cachedPayload = await checkInFlight;
      cacheExpiresAt = Date.now() + 30_000;
    } finally {
      checkInFlight = null;
    }
  }

  return NextResponse.json(
    cachedPayload,
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
      },
    },
  );
}
