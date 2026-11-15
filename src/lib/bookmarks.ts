import { z } from 'zod';

const name = z
	.string('Name is required')
	.trim()
	.min(1, 'Name is required')
	.transform((s) => s.slice(0, 200));
export const bookmarkCreate = z.object({ page: z.number().int().min(1), name });
export const bookmarkUpdate = z.object({ name });
