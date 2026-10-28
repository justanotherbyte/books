import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Book, fileUrl, type Note, type Stroke } from '../../api';
import { openRemote, type PDFDocument } from '../../pdf';
import {
	buttonBase,
	EraserIcon,
	HighlighterIcon,
	meta,
	Minus,
	Nav,
	NoteIcon,
	PenIcon,
	PinIcon,
	Plus,
	smallPrimaryButton,
	SpreadIcon,
	UndoIcon,
} from '../../ui';
import { type Editing, NotesPanel } from './NotesPanel';
import { Page } from './Page';
import { byPosition, clamp01 } from './shared';
import { INK, type InkTool, useInkInput } from './useInkInput';
import { usePageObservers } from './usePageObservers';
import { useStrokes } from './useStrokes';
import { useTextSelection } from './useTextSelection';
import { GAP, MAX_ZOOM, MIN_ZOOM, PAD, useZoom } from './useZoom';

const NO_NOTES: Note[] = [];
const NO_STROKES: Stroke[] = [];
const tool = `${buttonBase} gap-1.5 h-8 min-w-8 px-2 border text-sm`;
const toolIdle = 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800';
const toolOn = 'border-blue-600 bg-blue-600 text-white';

function useBook(id: string) {
	const [book, setBook] = useState<Book | null>(null);
	const [doc, setDoc] = useState<PDFDocument | null>(null);
	const [ratio, setRatio] = useState(1.414);
	const [error, setError] = useState('');

	useEffect(() => {
		api.get(id).then(setBook, (err: Error) => setError(err.message));

		let loaded: PDFDocument | undefined;
		let cancelled = false;
		async function open() {
			const d = await openRemote(fileUrl(id));
			loaded = d;
			const { width, height } = (await d.getPage(1)).getViewport({ scale: 1 });
			if (cancelled) return;

			setRatio(height / width);
			setDoc(d);
		}
		open().catch((err: Error) => {
			if (!cancelled) setError(err.message);
		});

		return () => {
			cancelled = true;
			loaded?.loadingTask.destroy();
		};
	}, [id]);

	useEffect(() => {
		if (book) document.title = book.title;
	}, [book]);

	return { book, doc, ratio, error };
}

export function Reader({ id }: { id: string }) {
	const { book, doc, ratio, error } = useBook(id);
	const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
	const [current, setCurrent] = useState(1);
	const [notes, setNotes] = useState<Note[]>([]);
	const [panel, setPanel] = useState(false);
	const [editing, setEditing] = useState<Editing>(null);
	const [pinMode, setPinMode] = useState(false);
	const [spread, setSpread] = useState(() => localStorage.getItem('reader-spread') === '1');
	const { zoom, fitWidth, columns, width, zoomTo, zoomBy } = useZoom(scroller, spread, ratio);
	const [selection, setSelection] = useTextSelection(scroller);
	const watch = usePageObservers(scroller, setCurrent);
	const [ink, setInk] = useState<InkTool | null>(null);
	const [inkColors, setInkColors] = useState({ pen: INK.pen.colors[0].hex, highlighter: INK.highlighter.colors[0].hex });
	const { strokes, error: inkError, canUndo, add, erase, undo } = useStrokes(id);
	useInkInput(scroller, ink, ink && ink !== 'eraser' ? inkColors[ink] : '', strokes, add, erase);

	useEffect(() => {
		api.notes(id).then(
			(n) => setNotes(n.sort(byPosition)),
			() => {},
		);
	}, [id]);

	useEffect(() => localStorage.setItem('reader-spread', spread ? '1' : '0'), [spread]);

	// Reopen at the last page read. Saving waits for the restore, so the first page-1 report can't overwrite it.
	const restored = useRef(false);
	useEffect(() => {
		if (!doc || !watch || !fitWidth || restored.current) return;
		restored.current = true;
		const saved = Number(localStorage.getItem(`reader-page-${id}`));
		if (saved > 1) goToPage(saved);
	}, [doc, watch, fitWidth]);
	useEffect(() => {
		if (restored.current) localStorage.setItem(`reader-page-${id}`, String(current));
	}, [id, current]);

	// Escape backs out one step: pin or draw mode, then the editor, then the panel. Ctrl/Cmd+Z undoes drawing.
	useEffect(() => {
		function key(e: KeyboardEvent) {
			if (ink && (e.ctrlKey || e.metaKey) && e.key === 'z' && !(e.target as HTMLElement).closest('input, textarea')) {
				e.preventDefault();
				undo();
			}
			if (e.key !== 'Escape') return;

			if (pinMode) setPinMode(false);
			else if (ink) setInk(null);
			else if (editing) setEditing(null);
			else setPanel(false);
		}

		window.addEventListener('keydown', key);
		return () => window.removeEventListener('keydown', key);
	}, [pinMode, ink, editing, undo]);

	const openNote = useCallback((note: Note) => {
		setEditing({ note });
		setPanel(true);
	}, []);

	const pin = useCallback((page: number, x: number, y: number) => {
		setPinMode(false);
		setEditing({ draft: { page, quote: '', rects: [[clamp01(x), clamp01(y), 0, 0]] } });
		setPanel(true);
	}, []);

	function jumpTo(note: Note) {
		if (!scroller) return;
		const el = scroller.querySelector<HTMLElement>(`[data-page="${note.page}"]`);
		if (!el) return;

		const [x, y] = note.rects[0];
		scroller.scrollTo({
			top: el.offsetTop + y * el.offsetHeight - scroller.clientHeight / 3,
			left: el.offsetLeft + x * el.offsetWidth - scroller.clientWidth / 3,
		});
	}

	function goToPage(n: number) {
		const el = scroller?.querySelector<HTMLElement>(`[data-page="${n}"]`);
		if (el) scroller!.scrollTo({ top: el.offsetTop - PAD });
	}

	async function saveNote(body: string) {
		if (!editing) return;

		let saved: Note;
		if (editing.draft) saved = await api.addNote(id, { ...editing.draft, body });
		else saved = await api.updateNote(id, editing.note!.id, body);

		setNotes((list) => {
			const next = list.filter((n) => n.id !== saved.id);
			next.push(saved);
			return next.sort(byPosition);
		});
		setEditing(null);
	}

	async function deleteNote(note: Note) {
		await api.removeNote(id, note.id);
		setNotes((list) => list.filter((n) => n.id !== note.id));
		setEditing(null);
	}

	const notesByPage = new Map<number, Note[]>();
	for (const note of notes) {
		const onPage = notesByPage.get(note.page) ?? [];
		onPage.push(note);
		notesByPage.set(note.page, onPage);
	}
	const strokesByPage = new Map<number, Stroke[]>();
	for (const stroke of strokes) {
		const onPage = strokesByPage.get(stroke.page) ?? [];
		onPage.push(stroke);
		strokesByPage.set(stroke.page, onPage);
	}
	const draft = editing?.draft;
	const active = editing?.note;

	return (
		<div className="h-dvh flex flex-col">
			<Nav back>
				<span className="truncate text-sm text-zinc-600 dark:text-zinc-400">{book?.title}</span>
			</Nav>
			<div className="flex items-center justify-between gap-2 px-2 md:px-8 h-12 border-b border-zinc-300 dark:border-white/10 bg-white dark:bg-zinc-900">
				{pinMode || !doc ? (
					<span className={`${meta} min-w-0 truncate`} aria-live="polite">
						{pinMode ? 'Tap the page where the note goes' : ''}
					</span>
				) : (
					<PageJump current={current} total={doc.numPages} onJump={goToPage} />
				)}
				<div className="flex items-center gap-2 shrink-0">
					<div className="flex items-center" role="group" aria-label="Zoom">
						<button type="button" onClick={() => zoomBy(0.8)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" className={`${tool} ${toolIdle}`}>
							<Minus />
						</button>
						<button type="button" onClick={() => zoomTo(1)} title="Reset zoom" className={`${tool} ${toolIdle} w-16 -mx-px tabular-nums`}>
							{Math.round(zoom * 100)}%
						</button>
						<button type="button" onClick={() => zoomBy(1.25)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" className={`${tool} ${toolIdle}`}>
							<Plus />
						</button>
					</div>
					<button
						type="button"
						onClick={() => setSpread((s) => !s)}
						aria-pressed={spread}
						aria-label="Two pages side by side"
						title="Two pages side by side"
						className={`${tool} ${spread ? toolOn : toolIdle} max-lg:hidden`}
					>
						<SpreadIcon />
					</button>
					<button
						type="button"
						onClick={() => {
							setInk((t) => (t ? null : 'pen'));
							setPinMode(false);
						}}
						aria-pressed={!!ink}
						aria-label="Draw on the page"
						title="Draw on the page"
						className={`${tool} ${ink ? toolOn : toolIdle}`}
					>
						<PenIcon />
						<span className="hidden md:inline">Draw</span>
					</button>
					<button
						type="button"
						onClick={() => {
							setPinMode((p) => !p);
							setInk(null);
						}}
						aria-pressed={pinMode}
						aria-label="Pin a note to a spot on the page"
						title="Pin a note to a spot (for scanned pages)"
						className={`${tool} ${pinMode ? toolOn : toolIdle}`}
					>
						<PinIcon />
						<span className="hidden md:inline">Pin</span>
					</button>
					<button type="button" onClick={() => setPanel((p) => !p)} aria-pressed={panel} aria-label="Notes" className={`${tool} ${panel ? toolOn : toolIdle}`}>
						<NoteIcon />
						<span className="hidden md:inline">Notes</span>
						{notes.length > 0 && <span className="text-xs opacity-75">{notes.length}</span>}
					</button>
				</div>
			</div>

			{ink && (
				<div className="flex items-center gap-2 px-2 md:px-8 h-12 border-b border-zinc-300 dark:border-white/10 bg-white dark:bg-zinc-900">
					<div className="flex items-center" role="group" aria-label="Drawing tool">
						{(
							[
								['pen', 'Pen', <PenIcon key="i" />],
								['highlighter', 'Highlighter', <HighlighterIcon key="i" />],
								['eraser', 'Eraser', <EraserIcon key="i" />],
							] as const
						).map(([t, label, icon], i) => (
							<button
								key={t}
								type="button"
								onClick={() => setInk(t)}
								aria-pressed={ink === t}
								aria-label={label}
								title={label}
								className={`${tool} ${ink === t ? toolOn : toolIdle} ${i > 0 ? '-ml-px' : ''}`}
							>
								{icon}
								<span className="hidden md:inline">{label}</span>
							</button>
						))}
					</div>
					{ink !== 'eraser' && (
						<div className="flex items-center gap-2 px-1" role="group" aria-label="Colour">
							{INK[ink].colors.map((c) => (
								<button
									key={c.hex}
									type="button"
									onClick={() => setInkColors((all) => ({ ...all, [ink]: c.hex }))}
									aria-pressed={inkColors[ink] === c.hex}
									aria-label={c.name}
									title={c.name}
									className={`w-6 h-6 cursor-pointer border border-zinc-300 dark:border-zinc-600 ${inkColors[ink] === c.hex ? 'outline-2 outline-offset-2 outline-blue-600' : ''}`}
									style={{ background: c.hex }}
								/>
							))}
						</div>
					)}
					<span className={`${meta} min-w-0 truncate`} role="status">
						{inkError}
					</span>
					<button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" className={`${tool} ${toolIdle} ml-auto shrink-0`}>
						<UndoIcon />
						<span className="hidden md:inline">Undo</span>
					</button>
				</div>
			)}

			<div className="flex flex-1 min-h-0">
				<div
					ref={setScroller}
					// While drawing, one finger draws, so native touch scrolling is off; useInkInput scrolls with two fingers instead.
					className={`relative flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-950 ${ink ? 'touch-none' : '[touch-action:pan-x_pan-y]'}`}
					style={{ padding: PAD }}
				>
					{error && (
						<p className="max-w-3xl mx-auto p-4 text-zinc-600 dark:text-zinc-400">
							Could not open this book: {error}.{' '}
							<a href="/" className="underline hover:text-zinc-400 duration-200">
								Back to the library
							</a>
						</p>
					)}
					{!doc && !error && fitWidth > 0 && (
						<div
							className="mx-auto bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 animate-pulse"
							style={{ width: fitWidth, aspectRatio: `1 / ${ratio}` }}
						/>
					)}
					{doc && watch && fitWidth > 0 && (
						<div
							className={columns === 2 ? 'grid grid-cols-2 items-center gap-2 mx-auto' : 'flex flex-col gap-2 mx-auto'}
							style={{ width: columns * width + (columns - 1) * GAP }}
						>
							{Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
								<Page
									key={n}
									doc={doc}
									number={n}
									ratio={ratio}
									width={width}
									watch={watch}
									notes={notesByPage.get(n) ?? NO_NOTES}
									strokes={strokesByPage.get(n) ?? NO_STROKES}
									draft={draft?.page === n ? draft : undefined}
									activeId={active?.page === n ? active.id : undefined}
									pinMode={pinMode}
									drawing={!!ink}
									onPin={pin}
									onOpen={openNote}
								/>
							))}
						</div>
					)}
				</div>

				{panel && (
					<NotesPanel
						notes={notes}
						editing={editing}
						onSelect={(note) => {
							jumpTo(note);
							openNote(note);
						}}
						onSave={saveNote}
						onDelete={deleteNote}
						onCancel={() => setEditing(null)}
						onClose={() => setPanel(false)}
					/>
				)}
			</div>

			{selection && !pinMode && !ink && (
				<button
					type="button"
					// Keep the text selection alive until the click lands.
					onPointerDown={(e) => e.preventDefault()}
					onClick={() => {
						setEditing({ draft: selection.draft });
						setPanel(true);
						getSelection()?.removeAllRanges();
						setSelection(null);
					}}
					className={`${smallPrimaryButton} fixed z-40 -translate-x-1/2`}
					style={{ left: Math.min(Math.max(selection.x, 80), innerWidth - 80), top: Math.min(selection.y + 8, innerHeight - 48) }}
				>
					<NoteIcon />
					Add note
				</button>
			)}
		</div>
	);
}

// Shows the current page; focus it, type a number and press Enter to jump there.
function PageJump({ current, total, onJump }: { current: number; total: number; onJump: (n: number) => void }) {
	// Null while not editing, so the field follows the page as you scroll.
	const [draft, setDraft] = useState<string | null>(null);

	return (
		<form
			className={`${meta} flex items-center gap-1.5 tabular-nums`}
			onSubmit={(e) => {
				e.preventDefault();
				if (draft) onJump(Math.min(total, Math.max(1, Number(draft))));
				(e.currentTarget.elements[0] as HTMLInputElement).blur();
			}}
		>
			<input
				aria-label={`Page number, 1 to ${total}`}
				inputMode="numeric"
				value={draft ?? current}
				onFocus={(e) => {
					setDraft(String(current));
					e.currentTarget.select();
				}}
				onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
				onBlur={() => setDraft(null)}
				onKeyDown={(e) => {
					if (e.key !== 'Escape') return;
					// Keep the reader's Escape handler from also closing the notes panel.
					e.stopPropagation();
					e.currentTarget.blur();
				}}
				className="h-7 px-1 text-center border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 duration-200"
				style={{ width: `calc(${String(total).length}ch + 1rem)` }}
			/>
			<span>/ {total}</span>
		</form>
	);
}
