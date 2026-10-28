import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { jsonError, readJson } from '../../../../../lib/http';
import { noteUpdate, type NoteRow, parseNote } from '../../../../../lib/notes';
import type { Note } from '../../../../../lib/types';

// Scoped to the book in the URL, so a note id from another book is not found.
function findNote(bookId: string | undefined, noteId: string | undefined) {
	return env.DB.prepare('SELECT * FROM notes WHERE id = ? AND book_id = ?').bind(noteId, bookId).first<NoteRow>();
}

export const PATCH: APIRoute = async ({ params, request }) => {
	const row = await findNote(params.id, params.noteId);
	if (!row) return jsonError('Not found', 404);
	const input = await readJson(request, noteUpdate);
	if (input instanceof Response) return input;

	const note: Note = { ...parseNote(row), body: input.body, updated_at: Date.now() };
	await env.DB.prepare('UPDATE notes SET body = ?, updated_at = ? WHERE id = ?').bind(note.body, note.updated_at, note.id).run();

	return Response.json(note);
};

export const DELETE: APIRoute = async ({ params }) => {
	const row = await findNote(params.id, params.noteId);
	if (!row) return jsonError('Not found', 404);

	await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(row.id).run();

	return new Response(null, { status: 204 });
};
