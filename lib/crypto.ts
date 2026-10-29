import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Saved platform tokens are encrypted with a key made from TOKEN_ENCRYPTION_KEY (AES-256-GCM).
function key() {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k || k.length < 32) throw new Error('Set TOKEN_ENCRYPTION_KEY (32+ characters).');
  return createHash('sha256').update(k).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64url')).join('.');
}

export function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split('.').map(p => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// Signed login cookie: "<value>.<hmac>"
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('Set SESSION_SECRET (32+ characters).');
  return s;
}
export function sign(value: string): string {
  return `${value}.${createHmac('sha256', secret()).update(value).digest('base64url')}`;
}
export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const want = Buffer.from(sign(value));
  const got = Buffer.from(signed);
  return want.length === got.length && timingSafeEqual(want, got) ? value : null;
}
