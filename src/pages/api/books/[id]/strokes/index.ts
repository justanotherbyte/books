import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { findBook } from '../../../../../lib/books';
import { jsonError, readJson } from '../../../../../lib/http';
import { parseStroke, strokeCreate, type StrokeRow } from '../../../../../lib/strokes';
import type { Stroke } from '../../../../../lib/types';

export const GET: APIRoute = async ({ params }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);

	const { results } = await env.DB.prepare('SELECT * FROM strokes WHERE book_id = ? ORDER BY created_at').bind(book.id).all<StrokeRow>();
	return Response.json(results.map(parseStroke));
};

export const POST: APIRoute = async ({ params, request }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);
	const input = await readJson(request, strokeCreate);
	if (input instanceof Response) return input;
	if (book.pages > 0 && input.page > book.pages) return jsonError(`This book has ${book.pages} pages`, 400);

	const stroke: Stroke = { ...input, book_id: book.id, created_at: Date.now() };
	const { meta } = await env.DB.prepare(
		'INSERT INTO strokes (id, book_id, page, tool, color, width, points, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
	)
		.bind(stroke.id, book.id, stroke.page, stroke.tool, stroke.color, stroke.width, JSON.stringify(stroke.points), stroke.created_at)
		.run();
	if (meta.changes === 0) return jsonError('A stroke with this id already exists', 409);

	return Response.json(stroke, { status: 201 });
};
