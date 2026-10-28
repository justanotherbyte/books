import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createSession, isPassword, SESSION_COOKIE, SESSION_SECONDS } from '../../lib/auth';
import { jsonError, readJson } from '../../lib/http';

export const POST: APIRoute = async ({ request, cookies }) => {
	const input = await readJson(request, z.object({ password: z.string() }));
	if (input instanceof Response) return input;
	if (!(await isPassword(input.password))) return jsonError('Wrong password', 401);

	cookies.set(SESSION_COOKIE, await createSession(), { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: SESSION_SECONDS });
	return new Response(null, { status: 204 });
};
