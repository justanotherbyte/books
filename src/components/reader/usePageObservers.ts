import { useEffect, useState } from 'react';

export type Watch = (el: Element, onNear: (near: boolean) => void) => () => void;

// Two observers shared by every page, rather than two per page on an 800-page book.
export function usePageObservers(root: HTMLElement | null, onCurrent: (n: number) => void): Watch | null {
	const [watch, setWatch] = useState<Watch | null>(null);

	useEffect(() => {
		if (!root) return;
		const callbacks = new Map<Element, (near: boolean) => void>();

		const near = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const onNear = callbacks.get(entry.target);
					if (onNear) onNear(entry.isIntersecting);
				}
			},
			{ root, rootMargin: '200% 100%' },
		);

		// A zero-height band across the middle of the scroller: the page crossing it is the current page.
		const mid = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) onCurrent(Number((entry.target as HTMLElement).dataset.page));
				}
			},
			{ root, rootMargin: '-50% 0px -50% 0px' },
		);

		function observe(el: Element, onNear: (near: boolean) => void) {
			callbacks.set(el, onNear);
			near.observe(el);
			mid.observe(el);

			return () => {
				callbacks.delete(el);
				near.unobserve(el);
				mid.unobserve(el);
			};
		}
		// Wrapped, because setState treats a bare function as an updater and would call it.
		setWatch(() => observe);

		return () => {
			near.disconnect();
			mid.disconnect();
		};
	}, [root, onCurrent]);

	return watch;
}
