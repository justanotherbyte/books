import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
export const PAD = 8; // padding around the pages inside the scroller
export const GAP = 8; // space between pages, matches gap-2
const MIN_SPREAD = 800; // narrower than this, two pages would each be too small to read

function clampZoom(z: number) {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

type Gesture = Event & { scale: number; clientX: number; clientY: number };

// Zooms the pages inside `scroller` without touching browser zoom. Returns the page width to render at
// and how many pages sit side by side. `ratio` is page height over width.
export function useZoom(scroller: HTMLElement | null, spread: boolean, ratio: number) {
	const [fit, setFit] = useState({ fitWidth: 0, columns: 1 });
	const [zoom, setZoom] = useState(() => clampZoom(Number(localStorage.getItem('reader-zoom')) || 1));
	// The page under the scroller's centre before a re-fit, and where on it, so the re-fit keeps it in view.
	const fitAnchor = useRef<{ page: string; fx: number; fy: number } | null>(null);

	// "Fit width" is the scroller's width, capped at a comfortable reading measure.
	// A two-page spread instead fits both pages to the scroller's height, so the whole spread is on screen.
	useEffect(() => {
		if (!scroller) return;
		const el = scroller;

		function measure() {
			const box = el.getBoundingClientRect();
			const cy = box.top + el.clientHeight / 2;
			// In a spread the centre falls in the gap between the two pages, so also try just left of it.
			for (const cx of [box.left + el.clientWidth / 2, box.left + el.clientWidth / 2 - 2 * GAP]) {
				const page = document.elementFromPoint(cx, cy)?.closest<HTMLElement>('[data-page]');
				if (!page || !el.contains(page)) continue;

				const p = page.getBoundingClientRect();
				fitAnchor.current = { page: page.dataset.page!, fx: (cx - p.left) / p.width, fy: (cy - p.top) / p.height };
				break;
			}

			const w = el.clientWidth - 2 * PAD;
			if (spread && w >= MIN_SPREAD) {
				setFit({ fitWidth: Math.floor(Math.min((w - GAP) / 2, (el.clientHeight - 2 * PAD) / ratio)), columns: 2 });
			} else {
				setFit({ fitWidth: Math.min(w, 768), columns: 1 });
			}
		}

		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [scroller, spread, ratio]);
	const { fitWidth, columns } = fit;

	// Runs after the pages take their new size: scrolls the anchored page back under the centre.
	useLayoutEffect(() => {
		const a = fitAnchor.current;
		fitAnchor.current = null;
		const page = a && scroller?.querySelector<HTMLElement>(`[data-page="${a.page}"]`);
		if (!page || !scroller) return;

		scroller.scrollLeft = page.offsetLeft + a.fx * page.offsetWidth - scroller.clientWidth / 2;
		scroller.scrollTop = page.offsetTop + a.fy * page.offsetHeight - scroller.clientHeight / 2;
	}, [fit, scroller]);

	// Zoom keeps the point under the cursor (or pinch centre) in place.
	const zoomRef = useRef(zoom);
	const anchor = useRef<{ x: number; y: number; fx: number; fy: number; ratio: number } | null>(null);

	// fx and fy are the focus point in scroller coordinates; without them zoom centres on the view.
	const zoomTo = useCallback(
		(next: number, fx?: number, fy?: number) => {
			const z = clampZoom(next);
			const prev = zoomRef.current;
			if (!scroller || z === prev) return;

			const focusX = fx ?? scroller.clientWidth / 2;
			const focusY = fy ?? scroller.clientHeight / 2;
			anchor.current = {
				x: scroller.scrollLeft + focusX - PAD,
				y: scroller.scrollTop + focusY - PAD,
				fx: focusX,
				fy: focusY,
				ratio: z / prev,
			};

			zoomRef.current = z;
			setZoom(z);
		},
		[scroller],
	);

	// Runs after the pages resize, so the scroll offset can be moved to keep the anchor still.
	useLayoutEffect(() => {
		const a = anchor.current;
		anchor.current = null;
		localStorage.setItem('reader-zoom', String(zoom));
		if (!a || !scroller) return;

		scroller.scrollLeft = a.x * a.ratio + PAD - a.fx;
		scroller.scrollTop = a.y * a.ratio + PAD - a.fy;
	}, [zoom, scroller]);

	// Pinch, ctrl+wheel (trackpad pinch) and Safari gesture events zoom the pages, not the browser page.
	useEffect(() => {
		if (!scroller) return;
		const el = scroller;

		function zoomAt(next: number, clientX: number, clientY: number) {
			const r = el.getBoundingClientRect();
			zoomTo(next, clientX - r.left, clientY - r.top);
		}

		function wheel(e: WheelEvent) {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();

			// Clamp so one mouse-wheel notch (~100) zooms about 25%, while small trackpad-pinch deltas stay smooth.
			const delta = Math.max(-25, Math.min(25, e.deltaY));
			zoomAt(zoomRef.current * Math.exp(-delta * 0.01), e.clientX, e.clientY);
		}

		// Two-finger pinch on touch screens.
		let pinch: { dist: number; zoom: number } | null = null;
		let frame = 0;

		function distance(t: TouchList) {
			return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
		}

		function touchStart(e: TouchEvent) {
			if (e.touches.length === 2) pinch = { dist: distance(e.touches), zoom: zoomRef.current };
		}

		function touchMove(e: TouchEvent) {
			if (!pinch || e.touches.length !== 2) return;
			e.preventDefault();

			const a = e.touches[0];
			const b = e.touches[1];
			const next = (pinch.zoom * distance(e.touches)) / pinch.dist;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => zoomAt(next, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2));
		}

		function touchEnd(e: TouchEvent) {
			if (e.touches.length < 2) pinch = null;
		}

		// Desktop Safari's trackpad pinch. Touch screens are handled by the touch listeners above.
		let gestureStart = 1;

		function gStart(e: Event) {
			e.preventDefault();
			gestureStart = zoomRef.current;
		}

		function gChange(e: Event) {
			e.preventDefault();
			if (pinch) return;

			const g = e as Gesture;
			zoomAt(gestureStart * g.scale, g.clientX, g.clientY);
		}

		const opts = { passive: false };
		el.addEventListener('wheel', wheel, opts);
		el.addEventListener('touchstart', touchStart, { passive: true });
		el.addEventListener('touchmove', touchMove, opts);
		el.addEventListener('touchend', touchEnd);
		el.addEventListener('touchcancel', touchEnd);
		el.addEventListener('gesturestart', gStart, opts);
		el.addEventListener('gesturechange', gChange, opts);

		return () => {
			cancelAnimationFrame(frame);
			el.removeEventListener('wheel', wheel);
			el.removeEventListener('touchstart', touchStart);
			el.removeEventListener('touchmove', touchMove);
			el.removeEventListener('touchend', touchEnd);
			el.removeEventListener('touchcancel', touchEnd);
			el.removeEventListener('gesturestart', gStart);
			el.removeEventListener('gesturechange', gChange);
		};
	}, [scroller, zoomTo]);

	// Ctrl/Cmd + plus, minus and 0 zoom the book instead of the whole page.
	useEffect(() => {
		function key(e: KeyboardEvent) {
			if (!e.ctrlKey && !e.metaKey) return;

			if (e.key === '=' || e.key === '+') {
				e.preventDefault();
				zoomTo(zoomRef.current * 1.25);
			} else if (e.key === '-') {
				e.preventDefault();
				zoomTo(zoomRef.current * 0.8);
			} else if (e.key === '0') {
				e.preventDefault();
				zoomTo(1);
			}
		}

		window.addEventListener('keydown', key);
		return () => window.removeEventListener('keydown', key);
	}, [zoomTo]);

	const zoomBy = useCallback((factor: number) => zoomTo(zoomRef.current * factor), [zoomTo]);

	return { zoom, fitWidth, columns, width: Math.round(fitWidth * zoom), zoomTo, zoomBy };
}
