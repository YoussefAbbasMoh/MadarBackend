const { createHmac } = require('crypto');

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_VCLOUD_ORIGIN = 'https://v.cloudapi.vconnct.me';
const DEFAULT_VCLOUD_BASE = `${DEFAULT_VCLOUD_ORIGIN}/api/v4`;

/**
 * V-Cloud v4 lives under `/api/v4`. Dashboards often copy only the host — fix that so POSTs hit
 * `…/api/v4/rooms/…` instead of `…/rooms/…` (which returns HTML 404).
 * @param {string | undefined} raw
 */
function normalizeVConnectBaseUrl(raw) {
  const s = raw && String(raw).trim();
  if (!s) return DEFAULT_VCLOUD_BASE;
  const trimmed = s.replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    const path = (u.pathname || '/').replace(/\/+$/, '') || '';
    if (path === '' || path === '/') {
      return `${u.origin}/api/v4`;
    }
    return `${u.origin}${path.startsWith('/') ? path : `/${path}`}`;
  } catch {
    return DEFAULT_VCLOUD_BASE;
  }
}

/**
 * HMAC SHA256 (base64) — same contract as @vconnct/devkit for V-Cloud v4.
 * @param {string} message
 * @param {string} secret
 */
function signMessage(message, secret) {
  const normalized = String(message).replace(/\r\n/g, '\n').trim();
  return createHmac('sha256', secret).update(normalized).digest('base64');
}

/**
 * Minimal V-Cloud HTTP client using native fetch (no ky / ESM issues in CJS).
 */
class VConnectHttp {
  /**
   * @param {{ apiKey: string; secretKey: string; baseUrl: string; timeoutMs?: number }} opts
   */
  constructor(opts) {
    this.apiKey = opts.apiKey;
    this.secretKey = opts.secretKey;
    const baseUrl = normalizeVConnectBaseUrl(opts.baseUrl);
    this.baseUrl = baseUrl;
    let pathname = '/api/v4';
    try {
      pathname = new URL(baseUrl).pathname.replace(/\/+$/, '') || '/api/v4';
    } catch {
      /* keep default */
    }
    this.basePath = pathname;
    this.timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
  }

  /**
   * @param {string} path e.g. `rooms/create_schedule_video_room`
   * @param {Record<string, unknown>} body
   */
  async post(path, body) {
    const jsonBody = JSON.stringify(body);
    const signature = signMessage(jsonBody, this.secretKey);
    const url = `${this.baseUrl}/${path}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          key: this.apiKey,
          'hash-signature': signature,
        },
        body: jsonBody,
      });
    } finally {
      clearTimeout(t);
    }
    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {
        message: rawText.includes('<!DOCTYPE') || rawText.includes('<html')
          ? `V-Connect returned HTML (${res.status}) — check VCONNECT_API_URL includes /api/v4 (e.g. ${DEFAULT_VCLOUD_BASE}). Request: POST ${url}`
          : rawText.slice(0, 280),
      };
    }
    if (!res.ok) {
      const err = new Error(
        data.message || data.error || data.msg || data.detail || `V-Connect HTTP ${res.status}: ${url}`,
      );
      err.statusCode = res.status;
      err.response = data;
      err.vconnectUrl = url;
      throw err;
    }
    return data;
  }

  /**
   * @param {string} path e.g. `rooms/get_active_room_info`
   * @param {Record<string, string | number | undefined> | undefined} params
   */
  async get(path, params) {
    const searchParams = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${this.basePath}/${path}?${queryString}` : `${this.basePath}/${path}`;
    const signature = signMessage(fullPath, this.secretKey);
    const url = queryString ? `${this.baseUrl}/${path}?${queryString}` : `${this.baseUrl}/${path}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          key: this.apiKey,
          'hash-signature': signature,
        },
      });
    } finally {
      clearTimeout(t);
    }
    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {
        message: rawText.includes('<!DOCTYPE') || rawText.includes('<html')
          ? `V-Connect returned HTML (${res.status}) — check VCONNECT_API_URL includes /api/v4. Request: GET ${url}`
          : rawText.slice(0, 280),
      };
    }
    if (!res.ok) {
      const err = new Error(data.message || data.error || data.msg || `V-Connect HTTP ${res.status}: ${url}`);
      err.statusCode = res.status;
      err.response = data;
      err.vconnectUrl = url;
      throw err;
    }
    return data;
  }
}

module.exports = { VConnectHttp, signMessage, normalizeVConnectBaseUrl };
