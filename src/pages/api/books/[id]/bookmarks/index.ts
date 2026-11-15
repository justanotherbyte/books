import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bookmarkCreate } from '../../../../../lib/bookmarks';
import { findBook } from '../../../../../lib/books';
import { jsonError, readJson } from '../../../../../lib/http';
import type { Bookmark } from '../../../../../lib/types';

export const GET: APIRoute = async ({ params }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);

	const { results } = await env.DB.prepare('SELECT * FROM bookmarks WHERE book_id = ? ORDER BY page, created_at').bind(book.id).all<Bookmark>();
	return Response.json(results);
};

export const POST: APIRoute = async ({ params, request }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);
	const input = await readJson(request, bookmarkCreate);
	if (input instanceof Response) return input;
	if (book.pages > 0 && input.page > book.pages) return jsonError(`This book has ${book.pages} pages`, 400);

	const bookmark: Bookmark = { id: crypto.randomUUID(), book_id: book.id, ...input, created_at: Date.now() };
	await env.DB.prepare('INSERT INTO bookmarks (id, book_id, page, name, created_at) VALUES (?, ?, ?, ?, ?)')
		.bind(bookmark.id, book.id, bookmark.page, bookmark.name, bookmark.created_at)
		.run();

	return Response.json(bookmark, { status: 201 });
};
