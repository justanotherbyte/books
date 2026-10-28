import { useEffect, useRef, useState } from 'react';
import { api, type Book, putFile } from '../api';
import { Cover } from './Cover';
import { card, meta, Nav, Plus, primaryButton, SectionHeading, Upload } from '../ui';

type Pending = { id: string; name: string; progress: number; stage: string; error?: string };

function isPdf(f: File) {
	return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

function sameTag(a: string, b: string) {
	return a.toLowerCase() === b.toLowerCase();
}

function tagHref(name: string | null) {
	if (name === null) return '/';
	return `/?tag=${encodeURIComponent(name)}`;
}

function pendingLabel(p: Pending) {
	if (p.error) return '';
	if (p.stage === 'Uploading') return `${Math.round(p.progress * 100)}%`;
	return `${p.stage}…`;
}

async function uploadBook(file: File, tags: string[], onUpdate: (p: Partial<Pending>) => void): Promise<Book> {
	onUpdate({ stage: 'Reading PDF' });

	// pdf.js is ~450 KB, so load it only when a book is added.
	const { extractDetails, openLocal, renderCover } = await import('../pdf');
	const doc = await openLocal(await file.arrayBuffer());
	let book: Book;
	let cover: Blob;
	try {
		const details = await extractDetails(doc, file.name);
		cover = await renderCover(doc);
		book = await api.create({ ...details, tags });
	} finally {
		doc.loadingTask.destroy();
	}

	try {
		onUpdate({ stage: 'Uploading' });
		await api.putCover(book.id, cover);
		await putFile(book.id, file, (progress) => onUpdate({ progress }));
	} catch (err) {
		// Don't leave a book row that points at a missing file.
		await api.remove(book.id).catch(() => {});
		throw err;
	}

	return book;
}

// Counts books per tag, grouping spellings that differ only in case.
function countTags(books: Book[]) {
	const tags = new Map<string, { name: string; count: number }>();
	for (const book of books) {
		for (const tag of book.tags) {
			const key = tag.toLowerCase();
			const entry = tags.get(key) ?? { name: tag, count: 0 };
			entry.count += 1;
			tags.set(key, entry);
		}
	}

	const list = [...tags.values()];
	list.sort((a, b) => a.name.localeCompare(b.name));
	return list;
}

export function Library({ initialTag }: { initialTag: string | null }) {
	const [activeTag, setActiveTag] = useState(initialTag);
	const [books, setBooks] = useState<Book[] | null>(null);
	const [loadError, setLoadError] = useState('');
	const [pending, setPending] = useState<Pending[]>([]);
	const [dragging, setDragging] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const uploadsLeft = useRef(0);

	useEffect(() => {
		api.list().then(setBooks, (err: Error) => setLoadError(err.message));
	}, []);

	function updatePending(id: string, patch: Partial<Pending>) {
		setPending((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
	}

	async function addFiles(files: File[]) {
		const pdfs = files.filter(isPdf);
		const skipped = files.filter((f) => !isPdf(f));
		const ids = pdfs.map(() => crypto.randomUUID());

		const waiting = pdfs.map((f, i) => ({ id: ids[i], name: f.name, progress: 0, stage: 'Waiting' }));
		const rejected = skipped.map((f) => ({ id: crypto.randomUUID(), name: f.name, progress: 0, stage: '', error: 'Not a PDF, skipped.' }));
		setPending((list) => [...list, ...waiting, ...rejected]);

		const tags = activeTag ? [activeTag] : [];
		let last: Book | undefined;
		uploadsLeft.current += pdfs.length;
		for (const [i, file] of pdfs.entries()) {
			try {
				const book = await uploadBook(file, tags, (patch) => updatePending(ids[i], patch));
				last = book;
				setBooks((list) => [book, ...(list ?? [])]);
				updatePending(ids[i], { stage: 'done' });
			} catch (err) {
				updatePending(ids[i], { error: err instanceof Error ? err.message : 'Upload failed.' });
			} finally {
				uploadsLeft.current -= 1;
			}
		}

		if (pdfs.length === 1 && last) location.assign(`/books/${last.id}?new=1`);
	}

	// Window-level listeners so a PDF can be dropped anywhere on the page.
	useEffect(() => {
		let depth = 0;

		function hasFiles(e: DragEvent) {
			return e.dataTransfer !== null && e.dataTransfer.types.includes('Files');
		}

		function enter(e: DragEvent) {
			if (!hasFiles(e)) return;
			depth += 1;
			setDragging(true);
		}

		function leave(e: DragEvent) {
			if (!hasFiles(e)) return;
			depth -= 1;
			if (depth <= 0) setDragging(false);
		}

		function over(e: DragEvent) {
			if (hasFiles(e)) e.preventDefault();
		}

		function drop(e: DragEvent) {
			if (!hasFiles(e)) return;
			e.preventDefault();
			depth = 0;
			setDragging(false);
			addFiles(Array.from(e.dataTransfer!.files));
		}

		window.addEventListener('dragenter', enter);
		window.addEventListener('dragleave', leave);
		window.addEventListener('dragover', over);
		window.addEventListener('drop', drop);
		return () => {
			window.removeEventListener('dragenter', enter);
			window.removeEventListener('dragleave', leave);
			window.removeEventListener('dragover', over);
			window.removeEventListener('drop', drop);
		};
	});

	// Leaving the page aborts the upload and strands a book row without its file, so ask first.
	// A ref rather than state, so the jump to the new book's details right after the last upload doesn't prompt.
	useEffect(() => {
		function warn(e: BeforeUnloadEvent) {
			if (uploadsLeft.current > 0) e.preventDefault();
		}

		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, []);

	const visiblePending = pending.filter((p) => p.stage !== 'done');

	function selectTag(name: string | null) {
		history.replaceState(null, '', tagHref(name));
		setActiveTag(name);
	}

	const tagList = countTags(books ?? []);
	let shown = books;
	if (books && activeTag) {
		shown = books.filter((b) => b.tags.some((t) => sameTag(t, activeTag)));
	}

	return (
		<>
			<Nav>
				<button type="button" onClick={() => fileInput.current?.click()} className={primaryButton}>
					<Plus />
					Add book
				</button>
				<input
					ref={fileInput}
					type="file"
					accept="application/pdf,.pdf"
					multiple
					hidden
					onChange={(e) => {
						addFiles(Array.from(e.target.files ?? []));
						e.target.value = '';
					}}
				/>
			</Nav>
			<main className="container mx-auto max-w-screen-xl p-4 md:p-8">
				<SectionHeading
					title={activeTag ?? 'Books'}
					aside={
						shown &&
						shown.length > 0 && (
							<span className={meta}>
								{shown.length} {shown.length === 1 ? 'book' : 'books'}
							</span>
						)
					}
				/>

				{tagList.length > 0 && (
					<nav aria-label="Tags" className="-mx-4 px-4 md:mx-0 md:px-0 mb-4 overflow-x-auto">
						<ul className="flex md:flex-wrap gap-2 w-max md:w-auto">
							{[{ name: null, count: books!.length }, ...tagList].map((t) => {
								const active = t.name === null ? !activeTag : !!activeTag && sameTag(t.name, activeTag);
								return (
									<li key={t.name ?? ''}>
										<a
											href={tagHref(t.name)}
											aria-current={active ? 'page' : undefined}
											onClick={(e) => {
												e.preventDefault();
												selectTag(active ? null : t.name);
											}}
											className={`flex items-baseline gap-2 border px-3 py-1 text-sm whitespace-nowrap duration-200 active:opacity-75 ${
												active
													? 'border-blue-600 bg-blue-600 text-white'
													: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 hover:border-zinc-400 dark:hover:text-white dark:hover:border-zinc-500'
											}`}
										>
											{t.name ?? 'All'}
											<span className={`text-xs ${active ? 'text-blue-100' : 'text-zinc-400 dark:text-zinc-500'}`}>{t.count}</span>
										</a>
									</li>
								);
							})}
						</ul>
					</nav>
				)}

				{visiblePending.length > 0 && (
					<ul className="flex flex-col gap-2 mb-6" aria-live="polite">
						{visiblePending.map((p) => (
							<li key={p.id} className={`${card} p-4 flex flex-col gap-2`}>
								<div className="flex items-baseline justify-between gap-4">
									<span className="truncate dark:text-white">{p.name}</span>
									<span className={`${meta} shrink-0`}>{pendingLabel(p)}</span>
								</div>
								{p.error ? (
									<p className="text-sm text-zinc-600 dark:text-zinc-400">{p.error}</p>
								) : (
									<div className="h-1 bg-zinc-200 dark:bg-zinc-700">
										<div className="h-full bg-blue-500 duration-200" style={{ width: `${p.progress * 100}%` }} />
									</div>
								)}
							</li>
						))}
					</ul>
				)}

				{loadError && <p className="text-zinc-600 dark:text-zinc-400">Could not load your books: {loadError}</p>}

				{!books && !loadError && (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2" aria-hidden>
						{Array.from({ length: 6 }, (_, i) => (
							<div key={i} className={`${card} overflow-hidden`}>
								<div className="aspect-[5/7] bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
								<div className="p-3 flex flex-col gap-2">
									<div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
									<div className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
								</div>
							</div>
						))}
					</div>
				)}

				{books?.length === 0 && visiblePending.length === 0 && (
					<button
						type="button"
						onClick={() => fileInput.current?.click()}
						className="w-full flex flex-col items-center gap-3 py-24 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white duration-200"
					>
						<Upload size={24} />
						<span>No books yet. Drop a PDF anywhere on this page, or tap to choose one.</span>
					</button>
				)}

				{activeTag && books && shown?.length === 0 && visiblePending.length === 0 && (
					<p className="text-zinc-500 dark:text-zinc-400 text-sm italic">
						No books tagged {activeTag}. Drop a PDF here to add one with this tag, or{' '}
						<a
							href="/"
							onClick={(e) => {
								e.preventDefault();
								selectTag(null);
							}}
							className="underline hover:text-zinc-400 duration-200"
						>
							show all books
						</a>
						.
					</p>
				)}

				{shown && shown.length > 0 && (
					<ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
						{shown.map((book) => (
							<li key={book.id} className={`${card} overflow-hidden flex flex-col`}>
								<a href={`/books/${book.id}/read`} className="block cursor-pointer active:opacity-75 duration-100 group">
									<Cover book={book} />
									<div className="px-3 pt-3 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-500 duration-200">
										{book.title}
									</div>
								</a>
								<div className="px-3 pb-3 pt-1 mt-auto flex items-baseline justify-between gap-2">
									<span className={`${meta} truncate`}>{book.author || `${book.pages} pages`}</span>
									<a
										href={`/books/${book.id}`}
										className="text-xs text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-white duration-200 shrink-0"
									>
										Edit
									</a>
								</div>
							</li>
						))}
					</ul>
				)}
			</main>

			{dragging && (
				<div className="fixed inset-0 z-50 p-4 bg-white/90 dark:bg-zinc-900/90 pointer-events-none drop-overlay">
					<div className="h-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-blue-500 text-blue-600 dark:text-blue-500">
						<Upload size={32} />
						<span className="text-xl">Drop to add to your library</span>
						<span className={meta}>PDF files only</span>
					</div>
				</div>
			)}
		</>
	);
}
