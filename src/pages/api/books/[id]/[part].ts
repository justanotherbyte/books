import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { coverKey, findBook, pdfKey } from '../../../../lib/books';
import { jsonError } from '../../../../lib/http';
import type { Book } from '../../../../lib/types';

const parts = {
	file: { key: pdfKey, type: 'application/pdf' },
	cover: { key: coverKey, type: 'image/jpeg' },
};

function partOf(name: string | undefined) {
	if (name === 'file' || name === 'cover') return parts[name];
	return null;
}

// Streams an R2 object, honouring Range and conditional headers so pdf.js can fetch only the pages it needs.
export const GET: APIRoute = async ({ params, request }) => {
	const part = partOf(params.part);
	const book = await findBook(params.id);
	if (!part || !book) return jsonError('Not found', 404);

	const object = await env.BUCKET.get(part.key(book.id), { range: request.headers, onlyIf: request.headers });
	if (!object) return jsonError('Not found', 404);

	const headers = new Headers({
		'Content-Type': part.type,
		'Accept-Ranges': 'bytes',
		ETag: object.httpEtag,
		'Cache-Control': 'private, max-age=31536000, immutable',
	});
	if (!('body' in object)) return new Response(null, { status: 304, headers });

	const range = object.range as { offset?: number; length?: number } | undefined;
	if (request.headers.has('Range') && range) {
		const offset = range.offset ?? 0;
		const length = range.length ?? object.size - offset;
		headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
		headers.set('Content-Length', String(length));
		return new Response(object.body, { status: 206, headers });
	}

	headers.set('Content-Length', String(object.size));
	return new Response(object.body, { headers });
};

export const PUT: APIRoute = async ({ params, request }) => {
	const part = partOf(params.part);
	const book = await findBook(params.id);
	if (!part || !book) return jsonError('Not found', 404);
	if (!request.body) return jsonError('Empty body', 400);

	// shortcut: one request body per upload caps PDFs at the plan's request size (100 MB on Free/Pro); switch to R2 multipart upload for larger files.
	const object = await env.BUCKET.put(part.key(book.id), request.body, { httpMetadata: { contentType: part.type } });

	const updated: Book = { ...book, size: params.part === 'file' ? object.size : book.size, updated_at: Date.now() };
	await env.DB.prepare('UPDATE books SET size = ?, updated_at = ? WHERE id = ?').bind(updated.size, updated.updated_at, updated.id).run();

	return Response.json(updated);
};
