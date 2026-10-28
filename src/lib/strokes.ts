import { z } from 'zod';
import type { Stroke } from './types';

export type StrokeRow = Omit<Stroke, 'points'> & { points: string };
export const parseStroke = (row: StrokeRow): Stroke => ({ ...row, points: JSON.parse(row.points) });

// The client picks the id, so it can draw, erase and undo a stroke before the save comes back.
export const strokeCreate = z.object({
	id: z.uuid(),
	page: z.number().int().min(1),
	tool: z.enum(['pen', 'highlighter']),
	color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Colour must be a hex value like #2563eb'),
	width: z.number().positive().max(0.1),
	points: z
		.array(z.number().min(0).max(1))
		.min(2)
		.max(10000)
		.refine((p) => p.length % 2 === 0, 'Points come in x, y pairs'),
});
