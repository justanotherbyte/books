import type { Note } from '../../api';

export type Rect = Note['rects'][number];
export type Draft = { page: number; quote: string; rects: Rect[] };

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const byPosition = (a: Note, b: Note) => a.page - b.page || a.rects[0][1] - b.rects[0][1];
