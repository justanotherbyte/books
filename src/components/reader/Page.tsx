import { memo, useEffect, useRef, useState } from 'react';
import type { Note, Stroke } from '../../api';
import { type PDFDocument, renderReaderPage } from '../../pdf';
import { NoteIcon } from '../../ui';
import { Ink } from './Ink';
import type { Draft, Rect } from './shared';
import type { Watch } from './usePageObservers';

type PageProps = {
	doc: PDFDocument;
	number: number;
	ratio: number;
	width: number;
	watch: Watch;
	notes: Note[];
	strokes: Stroke[];
	draft?: Draft;
	activeId?: string;
	pinMode: boolean;
	drawing: boolean;
	onPin: (page: number, x: number, y: number) => void;
	onOpen: (note: Note) => void;
};

// Renders only while within ~2 screens of the viewport; pdf.js then requests just that page's byte ranges from R2.
export const Page = memo(function Page({ doc, number, ratio, width, watch, notes, strokes, draft, activeId, pinMode, drawing, onPin, onOpen }: PageProps) {
	const ref = useRef<HTMLDivElement>(null);
	const canvasHost = useRef<HTMLDivElement>(null);
	const textHost = useRef<HTMLDivElement>(null);
	const [near, setNear] = useState(false);
	const [aspect, setAspect] = useState(ratio);
	const [hoverId, setHoverId] = useState<string | null>(null);
	const hovered = pinMode || drawing ? undefined : notes.find((n) => n.id === hoverId);

	useEffect(() => watch(ref.current!, setNear), [watch]);

	useEffect(() => {
		if (!near) {
			canvasHost.current!.replaceChildren();
			textHost.current!.replaceChildren();
			return;
		}

		let cancelled = false;
		async function render() {
			const canvas = document.createElement('canvas');
			canvas.className = 'block w-full h-full';
			const text = document.createElement('div');
			text.className = 'textLayer';

			const pageAspect = await renderReaderPage(doc, number, canvas, text, width);
			if (cancelled) return;

			setAspect(pageAspect);
			canvasHost.current!.replaceChildren(canvas);
			textHost.current!.replaceChildren(text);
		}

		// After a zoom the old bitmap stretches until the zoom settles, then re-renders sharp.
		const hasBitmap = canvasHost.current!.childElementCount > 0;
		const timer = setTimeout(() => render().catch(() => {}), hasBitmap ? 200 : 0);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [near, doc, number, width]);

	return (
		<div
			ref={ref}
			data-page={number}
			aria-label={`Page ${number}`}
			onClick={(e) => {
				if (!pinMode) return;

				const box = e.currentTarget.getBoundingClientRect();
				onPin(number, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
			}}
			// Hit-tests the pointer against the highlights, which stay pointer-events-none so text selection still works under them.
			onPointerMove={(e) => {
				if (e.pointerType !== 'mouse') return;

				const box = e.currentTarget.getBoundingClientRect();
				const x = (e.clientX - box.left) / box.width;
				const y = (e.clientY - box.top) / box.height;
				const marker = (e.target as HTMLElement).closest<HTMLElement>('[data-note]')?.dataset.note;
				const hit = notes.find((n) => n.body && (n.id === marker || n.rects.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh)));
				setHoverId(hit?.id ?? null);
			}}
			onPointerLeave={() => setHoverId(null)}
			className={`relative shrink-0 bg-white border border-zinc-300 dark:border-zinc-700 ${pinMode || drawing ? 'cursor-crosshair' : ''} ${drawing ? 'select-none' : ''}`}
			style={{ width, aspectRatio: `1 / ${aspect}` }}
		>
			<div ref={canvasHost} className="absolute inset-0" />
			<Ink strokes={strokes} aspect={aspect} />
			<div ref={textHost} className={pinMode || drawing ? 'pointer-events-none' : ''} />
			{notes.map((note) => (
				<Marks
					key={note.id}
					inert={drawing}
					id={note.id}
					rects={note.rects}
					state={note.id === activeId ? 'active' : 'saved'}
					onOpen={() => onOpen(note)}
					label={note.body || note.quote}
				/>
			))}
			{draft && <Marks rects={draft.rects} state="draft" />}
			{hovered && <NoteTip note={hovered} />}
		</div>
	);
});

// The note's text, shown under its highlight (or above it near the page bottom) while the mouse is over it.
function NoteTip({ note }: { note: Note }) {
	const [[x, , w, h]] = note.rects;
	const top = Math.min(...note.rects.map((r) => r[1]));
	const bottom = Math.max(...note.rects.map((r) => r[1] + r[3]));
	const below = bottom < 0.75;
	// Clears the 24px marker, which is centred on a pin.
	const gap = w === 0 && h === 0 ? (below ? 'mt-4' : '-mt-4') : below ? 'mt-1' : '-mt-1';

	return (
		<div
			role="tooltip"
			className={`absolute z-20 max-w-[min(20rem,50%)] px-3 py-2 text-sm whitespace-pre-wrap line-clamp-8 pointer-events-none bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ${below ? '' : '-translate-y-full'} ${gap}`}
			style={{ left: `${Math.min(x, 0.5) * 100}%`, top: `${(below ? bottom : top) * 100}%` }}
		>
			{note.body}
		</div>
	);
}

function Marks({
	id,
	rects,
	state,
	onOpen,
	label,
	inert,
}: {
	id?: string;
	inert?: boolean;
	rects: Rect[];
	state: 'saved' | 'active' | 'draft';
	onOpen?: () => void;
	label?: string;
}) {
	const [x, y, w, h] = rects[0];
	const isPin = w === 0 && h === 0;

	const fill = state === 'saved' ? 'bg-blue-500/25' : 'bg-blue-500/40';
	const markerColor = state === 'saved' ? 'bg-blue-600' : 'bg-blue-700 outline-2 outline-offset-1 outline-blue-500';
	const marker = `absolute z-10 flex items-center justify-center w-6 h-6 text-white ${markerColor}`;
	const markerLabel = label ? `Open note: ${label.slice(0, 60)}` : 'Open note';

	function open(e: React.MouseEvent) {
		e.stopPropagation();
		if (onOpen) onOpen();
	}

	return (
		<>
			{!isPin &&
				rects.map(([rx, ry, rw, rh], i) => (
					<div
						key={i}
						className={`absolute pointer-events-none mix-blend-multiply ${fill}`}
						style={{ left: `${rx * 100}%`, top: `${ry * 100}%`, width: `${rw * 100}%`, height: `${rh * 100}%` }}
					/>
				))}
			<button
				type="button"
				onClick={open}
				disabled={!onOpen}
				aria-label={markerLabel}
				data-note={id}
				className={`${marker} ${isPin ? '-translate-x-1/2 -translate-y-1/2' : 'right-1 -translate-y-1/4'} ${onOpen ? 'cursor-pointer' : ''} ${inert ? 'pointer-events-none' : ''}`}
				style={isPin ? { left: `${x * 100}%`, top: `${y * 100}%` } : { top: `${y * 100}%` }}
			>
				<NoteIcon size={14} />
			</button>
		</>
	);
}
