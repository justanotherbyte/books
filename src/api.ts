import type { Book, Note, Stroke, Tag } from './lib/types';

export type { Book, Note, Stroke };
type NewNote = Pick<Note, 'page' | 'quote' | 'rects' | 'body'>;
type NewStroke = Omit<Stroke, 'book_id' | 'created_at'>;

class Unauthorized extends Error {}

// Calls an /api route: 401 sends the browser to the login page, other errors throw the server's message.
async function call<T>(path: string, init: RequestInit = {}, redirectOn401 = true): Promise<T> {
	const res = await fetch(`/api${path}`, init);

	if (res.status === 401 && redirectOn401) {
		const here = location.pathname + location.search;
		location.assign(`/login?next=${encodeURIComponent(here)}`);
		throw new Unauthorized();
	}

	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? `Request failed (${res.status})`);
	}

	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

function sendJson(method: string, body: unknown): RequestInit {
	return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const api = {
	login: (password: string) => call<void>('/login', sendJson('POST', { password }), false),
	list: () => call<Book[]>('/books'),
	tags: () => call<Tag[]>('/tags'),
	get: (id: string) => call<Book>(`/books/${id}`),
	create: (json: { title: string; author: string; pages: number; tags: string[] }) => call<Book>('/books', sendJson('POST', json)),
	update: (id: string, json: { title: string; author: string; tags: string[] }) => call<Book>(`/books/${id}`, sendJson('PATCH', json)),
	remove: (id: string) => call<void>(`/books/${id}`, { method: 'DELETE' }),
	putCover: (id: string, cover: Blob) => call<Book>(`/books/${id}/cover`, { method: 'PUT', body: cover }),
	notes: (id: string) => call<Note[]>(`/books/${id}/notes`),
	addNote: (id: string, json: NewNote) => call<Note>(`/books/${id}/notes`, sendJson('POST', json)),
	updateNote: (id: string, noteId: string, body: string) => call<Note>(`/books/${id}/notes/${noteId}`, sendJson('PATCH', { body })),
	removeNote: (id: string, noteId: string) => call<void>(`/books/${id}/notes/${noteId}`, { method: 'DELETE' }),
	strokes: (id: string) => call<Stroke[]>(`/books/${id}/strokes`),
	addStroke: (id: string, json: NewStroke) => call<Stroke>(`/books/${id}/strokes`, sendJson('POST', json)),
	removeStroke: (id: string, strokeId: string) => call<void>(`/books/${id}/strokes/${strokeId}`, { method: 'DELETE' }),
};

export const fileUrl = (id: string) => `/api/books/${id}/file`;
export const coverUrl = (b: Book) => `/api/books/${b.id}/cover?v=${b.updated_at}`;

// XHR rather than fetch because fetch has no upload progress events.
export function putFile(id: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', fileUrl(id));

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(e.loaded / e.total);
		};
		xhr.onload = () => {
			if (xhr.status < 300) resolve();
			else reject(new Error(`Upload failed (${xhr.status})`));
		};
		xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));

		xhr.send(file);
	});
}
