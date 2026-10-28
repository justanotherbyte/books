import { z } from 'zod';
import type { Note } from './types';

export type NoteRow = Omit<Note, 'rects'> & { rects: string };
export const parseNote = (row: NoteRow): Note => ({ ...row, rects: JSON.parse(row.rects) });

const unit = z.number().min(0).max(1);
export const noteCreate = z.object({
	page: z.number().int().min(1),
	quote: z
		.string()
		.default('')
		.transform((s) => s.slice(0, 2000)),
	rects: z
		.array(z.tuple([unit, unit, unit, unit]), 'A note needs a position on the page')
		.min(1)
		.max(100),
	body: z.string().max(10000).default(''),
});
export const noteUpdate = z.object({ body: z.string('Note text is required').max(10000) });
