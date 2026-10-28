import { env } from 'cloudflare:workers';

export const SESSION_COOKIE = 'session';
export const SESSION_SECONDS = 30 * 86400;

const encoder = new TextEncoder();

function hmacKey() {
	return crypto.subtle.importKey('raw', encoder.encode(env.APP_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toHex(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

// crypto.subtle.verify compares in constant time, so neither check leaks how much of the secret matched.
export async function isPassword(password: string) {
	const key = await hmacKey();
	const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(env.APP_PASSWORD));

	return crypto.subtle.verify('HMAC', key, expected, encoder.encode(password));
}

// The cookie is "<expiry>.<HMAC of the expiry keyed by APP_PASSWORD>", so changing the password signs everyone out.
export async function createSession() {
	const expires = String(Date.now() + SESSION_SECONDS * 1000);
	const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(expires));

	return `${expires}.${toHex(signature)}`;
}

export async function isSignedIn(cookie: string | undefined) {
	if (!cookie) return false;

	const [expires, signature] = cookie.split('.');
	if (!signature || Number(expires) < Date.now()) return false;

	return crypto.subtle.verify('HMAC', await hmacKey(), fromHex(signature), encoder.encode(expires));
}
