import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { jsonError } from '../../../../../lib/http';

// Scoped to the book in the URL, so a stroke id from another book is not found.
export const DELETE: APIRoute = async ({ params }) => {
	const { meta } = await env.DB.prepare('DELETE FROM strokes WHERE id = ? AND book_id = ?').bind(params.strokeId, params.id).run();
	if (meta.changes === 0) return jsonError('Not found', 404);

	return new Response(null, { status: 204 });
};
