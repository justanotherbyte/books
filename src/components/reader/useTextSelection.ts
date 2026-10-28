import { useEffect, useState } from 'react';
import { clamp01, type Draft, type Rect } from './shared';

// Selection rects come per text run; merge them into one box per line so highlights read as lines.
function mergeLines(rects: Rect[]) {
	const lines: Rect[] = [];
	rects.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

	for (const [x, y, w, h] of rects) {
		const line = lines.find((l) => Math.abs(l[1] - y) < Math.min(l[3], h) / 2);
		if (!line) {
			lines.push([x, y, w, h]);
			continue;
		}

		const right = Math.max(line[0] + line[2], x + w);
		const bottom = Math.max(line[1] + line[3], y + h);
		line[0] = Math.min(line[0], x);
		line[1] = Math.min(line[1], y);
		line[2] = right - line[0];
		line[3] = bottom - line[1];
	}

	return lines.slice(0, 100);
}

type TextSelection = { draft: Draft; x: number; y: number };

// Tracks a text selection inside the pages so the reader can offer "Add note" just below it.
export function useTextSelection(scroller: HTMLElement | null) {
	const [selection, setSelection] = useState<TextSelection | null>(null);

	useEffect(() => {
		if (!scroller) return;
		const root = scroller;

		function read(): TextSelection | null {
			const sel = getSelection();
			if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

			const range = sel.getRangeAt(0);
			const pageEl = range.startContainer.parentElement?.closest<HTMLElement>('[data-page]');
			if (!pageEl || !root.contains(pageEl)) return null;

			// Client rects become fractions of the page, keeping only the ones on the starting page.
			const box = pageEl.getBoundingClientRect();
			const onPage = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0 && r.bottom > box.top && r.top < box.bottom);
			const fractions = onPage.map((r) => {
				const rect: Rect = [(r.left - box.left) / box.width, (r.top - box.top) / box.height, r.width / box.width, r.height / box.height];
				return rect.map(clamp01) as Rect;
			});
			const rects = mergeLines(fractions);

			const quote = sel.toString().replace(/\s+/g, ' ').trim();
			if (rects.length === 0 || quote === '') return null;

			const end = range.getBoundingClientRect();
			return { draft: { page: Number(pageEl.dataset.page), quote, rects }, x: end.left + end.width / 2, y: end.bottom };
		}

		function update() {
			setSelection(read());
		}

		document.addEventListener('selectionchange', update);
		scroller.addEventListener('scroll', update, { passive: true });
		return () => {
			document.removeEventListener('selectionchange', update);
			scroller.removeEventListener('scroll', update);
		};
	}, [scroller]);

	return [selection, setSelection] as const;
}
