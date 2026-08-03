import https from 'https'
import nodeFetch from 'node-fetch'

const KEYGEN_API_URL = process.env.NEXT_PUBLIC_KEYGEN_API_URL
if (!KEYGEN_API_URL) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_KEYGEN_API_URL')
}

// Base URL without the /v1 suffix, so callers can build full paths like `${BASE_URL}/v1/...`
export const KEYGEN_BASE_URL = KEYGEN_API_URL.replace(/\/v1\/?$/, '')

// Always validate TLS certificates — use NODE_TLS_REJECT_UNAUTHORIZED=0 or a custom CA
// bundle in development if connecting to a self-signed Keygen instance.
const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
})

/**
 * Path prefix for account-scoped endpoints (e.g. '/accounts/{id}'), empty in singleplayer mode.
 */
export function getAccountPathPrefix(): string {
  const singleplayer = process.env.NEXT_PUBLIC_KEYGEN_SINGLEPLAYER === 'true'
  const accountId = process.env.NEXT_PUBLIC_KEYGEN_ACCOUNT_ID
  return singleplayer ? '' : `/accounts/${accountId}`
}

/**
 * Fetch an upstream Keygen API URL via node-fetch + a pinned https.Agent, avoiding the
 * SSL certificate errors the global fetch implementation runs into against some hosts.
 */
export async function fetchKeygen(
  targetUrl: string,
  init: {
    method?: string
    headers: Record<string, string>
    body?: string
    // 'manual' lets a caller inspect a 3xx response (status + Location header) instead
    // of transparently following it — needed for the artifact-upload redirect to S3.
    redirect?: 'manual' | 'follow'
  }
) {
  return nodeFetch(targetUrl, {
    method: init.method || 'GET',
    headers: init.headers,
    body: init.body,
    redirect: init.redirect || 'follow',
    agent: targetUrl.startsWith('https') ? httpsAgent : undefined,
  })
}
