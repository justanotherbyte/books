import { defineMiddleware } from 'astro:middleware';
import { isSignedIn, SESSION_COOKIE } from './lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login'];

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname, search } = context.url;
	if (PUBLIC_PATHS.includes(pathname)) return next();
	if (await isSignedIn(context.cookies.get(SESSION_COOKIE)?.value)) return next();

	if (pathname.startsWith('/api/')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
	return context.redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
});
