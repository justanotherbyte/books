import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bookUpdate, coverKey, findBook, pdfKey, setTags } from '../../../../lib/books';
import { jsonError, readJson } from '../../../../lib/http';
import type { Book } from '../../../../lib/types';

export const GET: APIRoute = async ({ params }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);

	return Response.json(book);
};

export const PATCH: APIRoute = async ({ params, request }) => {
	const current = await findBook(params.id);
	if (!current) return jsonError('Not found', 404);
	const input = await readJson(request, bookUpdate);
	if (input instanceof Response) return input;

	const { title, author, tags } = input;
	const book: Book = { ...current, title, author, tags: tags ?? current.tags, updated_at: Date.now() };

	// Tags are optional in the body; leaving them out keeps the current ones.
	const statements = [env.DB.prepare('UPDATE books SET title = ?, author = ?, updated_at = ? WHERE id = ?').bind(title, author, book.updated_at, book.id)];
	if (tags) statements.push(...setTags(book.id, tags));
	await env.DB.batch(statements);

	return Response.json(book);
};

export const DELETE: APIRoute = async ({ params }) => {
	const book = await findBook(params.id);
	if (!book) return jsonError('Not found', 404);

	await env.BUCKET.delete([pdfKey(book.id), coverKey(book.id)]);

	await env.DB.batch([
		env.DB.prepare('DELETE FROM book_tags WHERE book_id = ?').bind(book.id),
		env.DB.prepare('DELETE FROM notes WHERE book_id = ?').bind(book.id),
		env.DB.prepare('DELETE FROM strokes WHERE book_id = ?').bind(book.id),
		env.DB.prepare('DELETE FROM books WHERE id = ?').bind(book.id),
	]);

	return new Response(null, { status: 204 });
};
