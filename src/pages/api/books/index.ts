import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bookCreate, type BookRow, SELECT_BOOKS, setTags, withTags } from '../../../lib/books';
import { readJson } from '../../../lib/http';
import type { Book } from '../../../lib/types';

export const GET: APIRoute = async () => {
	const { results } = await env.DB.prepare(`${SELECT_BOOKS} ORDER BY b.created_at DESC`).all<BookRow>();
	return Response.json(results.map(withTags));
};

export const POST: APIRoute = async ({ request }) => {
	const meta = await readJson(request, bookCreate);
	if (meta instanceof Response) return meta;

	const now = Date.now();
	const book: Book = { id: crypto.randomUUID(), ...meta, tags: meta.tags ?? [], size: 0, created_at: now, updated_at: now };

	const insert = env.DB.prepare('INSERT INTO books (id, title, author, pages, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
		book.id,
		book.title,
		book.author,
		book.pages,
		book.size,
		now,
		now,
	);
	await env.DB.batch([insert, ...setTags(book.id, book.tags)]);

	return Response.json(book, { status: 201 });
};
