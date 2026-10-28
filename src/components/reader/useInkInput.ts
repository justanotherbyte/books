import { useEffect, useRef } from 'react';
import type { Stroke } from '../../api';
import { HIGHLIGHTER_OPACITY, inkPath } from './Ink';
import { clamp01 } from './shared';
import type { NewStroke } from './useStrokes';

export type InkTool = 'pen' | 'highlighter' | 'eraser';

// Widths are fractions of the page width: about 2px and 15px on a 600px page.
export const INK = {
	pen: {
		width: 0.004,
		colors: [
			{ name: 'Black', hex: '#18181b' },
			{ name: 'Blue', hex: '#2563eb' },
			{ name: 'Red', hex: '#dc2626' },
		],
	},
	highlighter: {
		width: 0.025,
		colors: [
			{ name: 'Yellow', hex: '#facc15' },
			{ name: 'Green', hex: '#4ade80' },
			{ name: 'Blue', hex: '#60a5fa' },
		],
	},
};

const SVG = 'http://www.w3.org/2000/svg';
const MAX_POINTS = 5000; // the API takes up to 10000 numbers, x and y each count
const round = (n: number) => Math.round(clamp01(n) * 1e4) / 1e4;

// Distance from point p to the segment a-b, all in pixels.
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
	const dx = bx - ax;
	const dy = by - ay;
	const t = dx || dy ? clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)) : 0;
	return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

type Active = { pointer: number; page: HTMLElement; number: number; points: number[]; path?: SVGPathElement };

// Drawing on the pages while a tool is picked. One finger, or the mouse, draws or erases;
// two fingers scroll (and pinch-zoom, which useZoom handles), since the pages stop native touch scrolling.
export function useInkInput(
	scroller: HTMLElement | null,
	tool: InkTool | null,
	color: string,
	strokes: Stroke[],
	add: (s: NewStroke) => void,
	erase: (s: Stroke) => void,
) {
	const latest = useRef({ color, strokes, add, erase });
	useEffect(() => {
		latest.current = { color, strokes, add, erase };
	});

	useEffect(() => {
		if (!scroller || !tool) return;
		const el = scroller;
		let active: Active | null = null;
		let pan: { x: number; y: number } | null = null;
		const erased = new Set<string>();

		function cancel() {
			active?.path?.remove();
			active = null;
			erased.clear();
		}

		function extend(e: PointerEvent) {
			const a = active!;
			const box = a.page.getBoundingClientRect();
			for (const ev of e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e]) {
				const x = ev.clientX - box.left;
				const y = ev.clientY - box.top;
				const n = a.points.length;
				// Skip points under 1.5px from the last one; they add bytes, not shape.
				if (n && Math.hypot(x - a.points[n - 2] * box.width, y - a.points[n - 1] * box.height) < 1.5) continue;
				if (n >= MAX_POINTS * 2) break;
				a.points.push(round(x / box.width), round(y / box.height));
			}

			const svg = a.path!.ownerSVGElement!;
			a.path!.setAttribute('d', inkPath(a.points, svg.viewBox.baseVal.height));
		}

		function eraseAt(e: PointerEvent) {
			const a = active!;
			const box = a.page.getBoundingClientRect();
			const px = e.clientX - box.left;
			const py = e.clientY - box.top;
			const reach = e.pointerType === 'touch' ? 12 : 6;

			for (const s of latest.current.strokes) {
				if (s.page !== a.number || erased.has(s.id)) continue;

				const p = s.points;
				const limit = reach + (s.width * box.width) / 2;
				for (let i = 0; i < p.length; i += 2) {
					const j = Math.min(i + 2, p.length - 2);
					if (toSegment(px, py, p[i] * box.width, p[i + 1] * box.height, p[j] * box.width, p[j + 1] * box.height) <= limit) {
						erased.add(s.id);
						latest.current.erase(s);
						break;
					}
				}
			}
		}

		function down(e: PointerEvent) {
			// A second finger means scroll or pinch, not a stroke.
			if (e.pointerType === 'touch' && !e.isPrimary) return cancel();
			if (e.button !== 0 || active) return;
			const page = (e.target as Element).closest<HTMLElement>('[data-page]');
			if (!page) return;

			e.preventDefault();
			el.setPointerCapture(e.pointerId);
			active = { pointer: e.pointerId, page, number: Number(page.dataset.page), points: [] };
			if (tool === 'eraser') return eraseAt(e);

			const { width, colors } = INK[tool!];
			const path = document.createElementNS(SVG, 'path');
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', latest.current.color || colors[0].hex);
			path.setAttribute('stroke-width', String(width));
			path.setAttribute('stroke-opacity', String(tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1));
			path.setAttribute('stroke-linecap', 'round');
			path.setAttribute('stroke-linejoin', 'round');
			page.querySelector<SVGSVGElement>('[data-live]')!.appendChild(path);
			active.path = path;
			extend(e);
		}

		function move(e: PointerEvent) {
			if (!active || e.pointerId !== active.pointer) return;

			if (tool === 'eraser') eraseAt(e);
			else extend(e);
		}

		function up(e: PointerEvent) {
			if (!active || e.pointerId !== active.pointer) return;

			const { number, points, path } = active;
			if (path && points.length >= 2) {
				latest.current.add({
					page: number,
					tool: tool as NewStroke['tool'],
					color: path.getAttribute('stroke')!,
					width: INK[tool as NewStroke['tool']].width,
					points,
				});
			}
			cancel();
		}

		function mid(t: TouchList) {
			return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
		}

		function touchStart(e: TouchEvent) {
			if (e.touches.length === 2) pan = mid(e.touches);
		}

		function touchMove(e: TouchEvent) {
			if (!pan || e.touches.length !== 2) return;

			const m = mid(e.touches);
			el.scrollBy(pan.x - m.x, pan.y - m.y);
			pan = m;
		}

		function touchEnd(e: TouchEvent) {
			if (e.touches.length < 2) pan = null;
		}

		el.addEventListener('pointerdown', down);
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', cancel);
		el.addEventListener('touchstart', touchStart, { passive: true });
		el.addEventListener('touchmove', touchMove, { passive: true });
		el.addEventListener('touchend', touchEnd);
		el.addEventListener('touchcancel', touchEnd);

		return () => {
			cancel();
			el.removeEventListener('pointerdown', down);
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', cancel);
			el.removeEventListener('touchstart', touchStart);
			el.removeEventListener('touchmove', touchMove);
			el.removeEventListener('touchend', touchEnd);
			el.removeEventListener('touchcancel', touchEnd);
		};
	}, [scroller, tool]);
}
