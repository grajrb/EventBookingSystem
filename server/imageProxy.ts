import type { Request, Response, NextFunction } from 'express';
import { createError } from './middleware/errorHandler';
import crypto from 'crypto';

// We'll use Redis via existing connection utilities (reuse global clients in services/redis)
// Reuse internal client (not exported) - fallback by dynamic import if needed
let baseRedis: any = null;
import('./services/redis').then(m => { (baseRedis as any) = (m as any).default || (m as any); }).catch(()=>{});

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'
]);
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const CACHE_TTL = 60 * 60; // 1 hour
const ALLOWED_HOST_SUFFIXES = ['.googleusercontent.com', '.ggpht.com'];

function allowedHost(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'images.unsplash.com' || hostname === 'cdn.jsdelivr.net') return true;
  if (ALLOWED_HOST_SUFFIXES.some(s => hostname.endsWith(s))) return true;
  // allow generic hosts but block localhost/internal
  if (hostname === 'localhost' || hostname.endsWith('.local')) return false;
  return true; // fallback permissive; tighten if needed
}

export async function imageProxyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const src = req.query.url as string;
    if (!src) throw createError('Missing url parameter', 400);
    let parsed: URL;
    try { parsed = new URL(src); } catch { throw createError('Invalid URL', 400); }
    if (!/^https?:$/.test(parsed.protocol)) throw createError('Only http/https allowed', 400);
    if (!allowedHost(parsed)) throw createError('Host not allowed', 403);
    const cacheKey = 'img:' + crypto.createHash('sha1').update(src).digest('hex');
    if (baseRedis) {
      const cached = await baseRedis.get(cacheKey);
      if (cached) {
        const meta = JSON.parse(cached);
        res.setHeader('Content-Type', meta.contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.end(Buffer.from(meta.data, 'base64'));
      }
    }
    // Use global fetch (Node 18+). No need for node-fetch dependency.
    const response = await fetch(src, { redirect: 'follow' });
    if (!response.ok) throw createError('Upstream fetch failed', 502);
    const contentType = response.headers.get('content-type')?.split(';')[0].trim() || '';
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) throw createError('Unsupported content type', 415);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) throw createError('Image too large', 413);
    const buf = Buffer.from(arrayBuffer);
    if (baseRedis) {
      await baseRedis.setEx(cacheKey, CACHE_TTL, JSON.stringify({ contentType, data: buf.toString('base64') }));
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(buf);
  } catch (error) { next(error); }
}
