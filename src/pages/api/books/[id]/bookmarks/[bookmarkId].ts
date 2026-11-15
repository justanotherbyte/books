import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bookmarkUpdate } from '../../../../../lib/bookmarks';
import { jsonError, readJson } from '../../../../../lib/http';
import type { Bookmark } from '../../../../../lib/types';

// Scoped to the book in the URL, so a bookmark id from another book is not found.
function findBookmark(bookId: string | undefined, bookmarkId: string | undefined) {
	return env.DB.prepare('SELECT * FROM bookmarks WHERE id = ? AND book_id = ?').bind(bookmarkId, bookId).first<Bookmark>();
}

export const PATCH: APIRoute = async ({ params, request }) => {
	const row = await findBookmark(params.id, params.bookmarkId);
	if (!row) return jsonError('Not found', 404);
	const input = await readJson(request, bookmarkUpdate);
	if (input instanceof Response) return input;

	await env.DB.prepare('UPDATE bookmarks SET name = ? WHERE id = ?').bind(input.name, row.id).run();

	return Response.json({ ...row, name: input.name });
};

export const DELETE: APIRoute = async ({ params }) => {
	const row = await findBookmark(params.id, params.bookmarkId);
	if (!row) return jsonError('Not found', 404);

	await env.DB.prepare('DELETE FROM bookmarks WHERE id = ?').bind(row.id).run();

	return new Response(null, { status: 204 });
};
