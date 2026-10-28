import { env } from 'cloudflare:workers';
import { z } from 'zod';
import type { Book } from './types';

export const pdfKey = (id: string) => `books/${id}.pdf`;
export const coverKey = (id: string) => `covers/${id}.jpg`;

export const SELECT_BOOKS = `SELECT b.*, (
	SELECT json_group_array(tag) FROM (SELECT tag FROM book_tags WHERE book_id = b.id ORDER BY tag COLLATE NOCASE)
) AS tags FROM books b`;
export type BookRow = Omit<Book, 'tags'> & { tags: string };
export const withTags = (row: BookRow): Book => ({ ...row, tags: JSON.parse(row.tags) });

export async function findBook(id: string | undefined) {
	const row = await env.DB.prepare(`${SELECT_BOOKS} WHERE b.id = ?`).bind(id).first<BookRow>();
	if (!row) return null;

	return withTags(row);
}

// Trimmed, whitespace-collapsed, de-duplicated ignoring case, at most 20 tags of 40 characters.
const tagList = z
	.array(z.string())
	.max(100)
	.transform((raw) => {
		const seen = new Map<string, string>();
		for (const t of raw) {
			const tag = t.trim().replace(/\s+/g, ' ').slice(0, 40);
			if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
		}

		return [...seen.values()].slice(0, 20);
	});

const text = z
	.string()
	.trim()
	.transform((s) => s.slice(0, 500));
export const bookUpdate = z.object({
	title: text.refine((s) => s.length > 0, 'Title is required'),
	author: text.default(''),
	tags: tagList.optional(),
});
export const bookCreate = bookUpdate.extend({ pages: z.number().int().min(0).default(0) });

// Statements that replace a book's tags, for use inside a batch.
export function setTags(id: string, tags: string[]) {
	const statements = [env.DB.prepare('DELETE FROM book_tags WHERE book_id = ?').bind(id)];
	for (const tag of tags) {
		statements.push(env.DB.prepare('INSERT INTO book_tags (book_id, tag) VALUES (?, ?)').bind(id, tag));
	}
	return statements;
}
