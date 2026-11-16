import { useEffect, useRef, useState } from 'react';
import { printPages, type PDFDocument } from '../../pdf';
import { buttonBase, input, meta, PrintIcon, smallPrimaryButton } from '../../ui';

const PRESETS = [
	{ label: 'This page', before: 0, after: 0 },
	{ label: 'Next 5', before: 0, after: 4 },
	{ label: '±2 pages', before: 2, after: 2 },
	{ label: 'Next 10', before: 0, after: 9 },
];

// A toolbar dropdown that prints a range picked relative to the page being read: N pages before it, M after it.
export function PrintMenu({ doc, current, button }: { doc: PDFDocument; current: number; button: string }) {
	const [open, setOpen] = useState(false);
	const [before, setBefore] = useState(0);
	const [after, setAfter] = useState(0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const outside = (e: PointerEvent) => {
			if (!root.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener('pointerdown', outside);
		return () => document.removeEventListener('pointerdown', outside);
	}, [open]);

	const total = doc.numPages;
	const from = Math.max(1, current - before);
	const to = Math.min(total, current + after);
	const count = to - from + 1;

	async function print() {
		setError('');
		setBusy(true);
		try {
			await printPages(doc, from, to);
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not print. Try again.');
		} finally {
			setBusy(false);
		}
	}

	const field = (label: string, value: number, set: (n: number) => void, max: number) => (
		<label className={`${meta} flex flex-col gap-1 flex-1`}>
			{label}
			<input
				type="number"
				min={0}
				max={max}
				value={value}
				onChange={(e) => set(Math.min(max, Math.max(0, Math.floor(Number(e.target.value)) || 0)))}
				className={`${input} text-sm tabular-nums`}
			/>
		</label>
	);

	return (
		<div
			ref={root}
			className="relative"
			onKeyDown={(e) => {
				if (e.key !== 'Escape' || !open) return;
				// Keep the reader's Escape handler from also closing the notes panel.
				e.stopPropagation();
				setOpen(false);
			}}
		>
			<button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Print pages" title="Print pages" className={button}>
				<PrintIcon />
				<span className="hidden md:inline">Print</span>
			</button>
			{open && (
				<div className="absolute right-0 top-full mt-2 z-40 w-80 max-w-[calc(100vw-1rem)] flex flex-col gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700">
					<div className="flex flex-wrap gap-1">
						{PRESETS.map((p) => (
							<button
								key={p.label}
								type="button"
								onClick={() => {
									setBefore(Math.min(p.before, current - 1));
									setAfter(Math.min(p.after, total - current));
								}}
								aria-pressed={before === Math.min(p.before, current - 1) && after === Math.min(p.after, total - current)}
								className={`${buttonBase} h-7 px-2 text-xs border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white`}
							>
								{p.label}
							</button>
						))}
					</div>
					<div className="flex gap-2">
						{field('Pages before', before, setBefore, current - 1)}
						{field('Pages after', after, setAfter, total - current)}
					</div>
					<p className="text-sm dark:text-white tabular-nums" aria-live="polite">
						{count === 1 ? `Page ${from}` : `Pages ${from}–${to}`}
						<span className={`${meta} ml-2`}>
							{count} {count === 1 ? 'page' : 'pages'}, you're on {current}
						</span>
					</p>
					{error && (
						<p role="alert" className="text-sm dark:text-white">
							{error}
						</p>
					)}
					<button type="button" onClick={print} disabled={busy} className={smallPrimaryButton}>
						{busy ? 'Preparing…' : 'Print'}
					</button>
				</div>
			)}
		</div>
	);
}
