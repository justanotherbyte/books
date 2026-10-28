import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Tag } from '../../lib/types';

export const GET: APIRoute = async () => {
	const { results } = await env.DB.prepare('SELECT tag AS name, count(*) AS count FROM book_tags GROUP BY tag ORDER BY tag').all<Tag>();
	return Response.json(results);
};
