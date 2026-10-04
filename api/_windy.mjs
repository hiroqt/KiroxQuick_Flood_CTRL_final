const CACHE_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const PAGE_SIZE = 50;
const MAX_OFFSET = 1000;
const WINDY_URL = 'https://api.windy.com/webcams/api/v3/webcams';
const INCLUDE = 'images,location,urls';
const NCR_BOUNDS = { west: 120.9, south: 14.34, east: 121.15, north: 14.8 };
const viewportCache = new Map();
const pendingViewports = new Map();

function apiError(message, status) { return Object.assign(new Error(message), { status }); }

function getApiKey() {
  const key = process.env.WINDY_WEBCAMS_API_KEY?.trim();
  if (!key) throw apiError('Windy API key is not configured', 503);
  return key;
}

async function fetchWindyJson(url, key = getApiKey()) {
  const response = await fetch(url, {
    headers: { 'x-windy-api-key': key, accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw apiError(`Windy returned ${response.status}`, 502);
  return response.json();
}

function clampBbox(value) {
  if (!value) return { ...NCR_BOUNDS };
  const values = value.split(',').map(Number);
  if (values.length !== 4 || !values.every(Number.isFinite)) throw apiError('Invalid camera viewport', 400);
  const [north, east, south, west] = values;
  if (north < south || east < west || north > 90 || south < -90 || east > 180 || west < -180) {
    throw apiError('Invalid camera viewport', 400);
  }
  const bounds = {
    west: Math.max(west, NCR_BOUNDS.west), south: Math.max(south, NCR_BOUNDS.south),
    east: Math.min(east, NCR_BOUNDS.east), north: Math.min(north, NCR_BOUNDS.north),
  };
  return bounds.west >= bounds.east || bounds.south >= bounds.north ? null : bounds;
}

function bboxKey(bounds) {
  return [bounds.north, bounds.east, bounds.south, bounds.west].map((n) => n.toFixed(5)).join(',');
}

async function fetchViewport(bounds) {
  const key = getApiKey();
  const records = [];
  let total = Infinity;
  for (let offset = 0; offset < total && offset <= MAX_OFFSET; offset += PAGE_SIZE) {
    const url = new URL(WINDY_URL);
    url.searchParams.set('bbox', bboxKey(bounds));
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('include', INCLUDE);
    url.searchParams.set('lang', 'en');
    const page = await fetchWindyJson(url, key);
    const webcams = Array.isArray(page) ? page : page?.webcams;
    if (!Array.isArray(webcams)) throw apiError('Invalid Windy response', 502);
    records.push(...webcams);
    total = Number.isFinite(page?.total) ? page.total : offset + webcams.length;
    if (!webcams.length) break;
  }
  return { cameras: records, fetchedAt: Math.floor(Date.now() / 1000), stale: false };
}

async function getViewport(bounds, forceFresh = false) {
  const key = bboxKey(bounds);
  const cached = viewportCache.get(key);
  if (!forceFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  if (pendingViewports.has(key)) return pendingViewports.get(key);
  const pending = fetchViewport(bounds).then((value) => {
    viewportCache.set(key, { value, at: Date.now() });
    for (const [cacheKey, entry] of viewportCache) if (Date.now() - entry.at >= CACHE_MS) viewportCache.delete(cacheKey);
    while (viewportCache.size > MAX_CACHE_ENTRIES) viewportCache.delete(viewportCache.keys().next().value);
    return value;
  }).finally(() => pendingViewports.delete(key));
  pendingViewports.set(key, pending);
  return pending;
}

export async function handleCameras(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const url = new URL(req.url || '/api/cameras', `https://${req.headers.host || 'localhost'}`);
    const bounds = clampBbox(url.searchParams.get('bbox'));
    if (!bounds) return send(res, 200, { cameras: [], fetchedAt: Math.floor(Date.now() / 1000), stale: false });
    return send(res, 200, await getViewport(bounds, url.searchParams.get('fresh') === '1'));
  } catch (error) { return sendFailure(res, error); }
}

export async function handleCamera(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const id = req.query?.id;
    if (!/^\d+$/.test(String(id ?? ''))) return send(res, 400, { error: 'invalid_camera_id' });
    const url = new URL(`${WINDY_URL}/${id}`);
    url.searchParams.set('include', INCLUDE);
    url.searchParams.set('lang', 'en');
    const camera = await fetchWindyJson(url);
    return send(res, 200, { camera, fetchedAt: Math.floor(Date.now() / 1000) });
  } catch (error) { return sendFailure(res, error); }
}

function send(res, status, value) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  return res.end(JSON.stringify(value));
}

function sendFailure(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 502;
  const code = status === 503 ? 'provider_not_configured' : status === 400 ? 'invalid_viewport' : 'provider_unavailable';
  return send(res, status, { error: code });
}
