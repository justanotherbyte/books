import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { findBook } from '../../../../../lib/books';
import { jsonError, readJson } from '../../../../../lib/http';
import { noteCreate, type NoteRow, parseNote } from '../../../../../lib/notes';
import type { Note } from '../../../../../lib/types';

export const GET: APIRoute = async ({ params }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);

	const { results } = await env.DB.prepare('SELECT * FROM notes WHERE book_id = ? ORDER BY page, created_at').bind(book.id).all<NoteRow>();
	return Response.json(results.map(parseNote));
};

export const POST: APIRoute = async ({ params, request }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);
	const input = await readJson(request, noteCreate);
	if (input instanceof Response) return input;
	if (book.pages > 0 && input.page > book.pages) return jsonError(`This book has ${book.pages} pages`, 400);

	const now = Date.now();
	const note: Note = { id: crypto.randomUUID(), book_id: book.id, ...input, created_at: now, updated_at: now };
	await env.DB.prepare('INSERT INTO notes (id, book_id, page, quote, rects, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
		.bind(note.id, book.id, note.page, note.quote, JSON.stringify(note.rects), note.body, now, now)
		.run();

	return Response.json(note, { status: 201 });
};
