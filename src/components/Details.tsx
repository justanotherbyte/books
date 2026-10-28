import { useEffect, useState } from 'react';
import { api, type Book, fileUrl } from '../api';
import { card, input, meta, Nav, primaryButton, secondaryButton, SectionHeading, X } from '../ui';
import { Cover } from './Cover';

function formatSize(bytes: number) {
	if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

function errorText(prefix: string, err: unknown) {
	if (err instanceof Error) return `${prefix}: ${err.message}`;
	return `${prefix}.`;
}

export function Details({ id, isNew }: { id: string; isNew: boolean }) {
	const [book, setBook] = useState<Book | null>(null);
	const [error, setError] = useState('');
	const [title, setTitle] = useState('');
	const [author, setAuthor] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [knownTags, setKnownTags] = useState<string[]>([]);
	const [coverPage, setCoverPage] = useState(1);
	const [status, setStatus] = useState(isNew ? 'Uploaded. Check the title and author, then save.' : '');
	const [busy, setBusy] = useState<'' | 'save' | 'cover' | 'delete'>('');

	function showBook(b: Book) {
		setBook(b);
		setTitle(b.title);
		setAuthor(b.author);
		setTags(b.tags);
	}

	useEffect(() => {
		api.get(id).then(showBook, (err: Error) => setError(err.message));

		// Suggestions are optional; the form works without them.
		api.tags().then(
			(t) => setKnownTags(t.map((x) => x.name)),
			() => {},
		);
	}, [id]);

	let dirty = false;
	if (book) {
		dirty = title.trim() !== book.title || author.trim() !== book.author || tags.join('\n') !== book.tags.join('\n');
	}

	async function save(e: React.FormEvent) {
		e.preventDefault();
		setBusy('save');

		try {
			// The server trims and de-duplicates, so the saved book replaces what the user typed.
			showBook(await api.update(id, { title, author, tags }));
			setStatus('Saved.');
		} catch (err) {
			setStatus(errorText('Could not save', err));
		}

		setBusy('');
	}

	async function useCoverPage() {
		setBusy('cover');
		setStatus(`Rendering page ${coverPage}…`);

		try {
			const { openRemote, renderCover } = await import('../pdf');
			const doc = await openRemote(fileUrl(id));
			let blob: Blob;
			try {
				blob = await renderCover(doc, coverPage);
			} finally {
				doc.loadingTask.destroy();
			}

			setBook(await api.putCover(id, blob));
			setStatus(`Cover set to page ${coverPage}.`);
		} catch (err) {
			setStatus(errorText('Could not change the cover', err));
		}

		setBusy('');
	}

	async function remove() {
		if (!book) return;
		if (!confirm(`Delete "${book.title}"? This removes the PDF from storage and cannot be undone.`)) return;
		setBusy('delete');

		try {
			await api.remove(id);
			location.replace('/');
		} catch (err) {
			setStatus(errorText('Could not delete', err));
			setBusy('');
		}
	}

	function changeCoverPage(value: string) {
		const max = book?.pages || Infinity;
		const page = Number(value) || 1;
		setCoverPage(Math.max(1, Math.min(max, page)));
	}

	return (
		<>
			<Nav back>
				{book && (
					<a href={`/books/${id}/read`} className={primaryButton}>
						Read
					</a>
				)}
			</Nav>
			<main className="container mx-auto max-w-screen-xl p-4 md:p-8">
				<SectionHeading title="Book details" />
				{error && <p className="text-zinc-600 dark:text-zinc-400">{error === 'Not found' ? 'This book does not exist. It may have been deleted.' : error}</p>}
				{!book && !error && <div className="h-96 max-w-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" aria-hidden />}
				{book && (
					<div className="grid gap-8 md:grid-cols-[16rem_minmax(0,36rem)]">
						<div className="flex flex-col gap-2 w-full max-w-56 md:max-w-none">
							<div className={`${card} overflow-hidden`}>
								<Cover key={book.updated_at} book={book} className="border-b-0" />
							</div>
							<div className="flex items-end gap-2">
								<label className="flex flex-col gap-1 w-24">
									<span className={meta}>Cover page</span>
									<input
										type="number"
										min={1}
										max={book.pages || undefined}
										value={coverPage}
										onChange={(e) => changeCoverPage(e.target.value)}
										className={input}
									/>
								</label>
								<button type="button" onClick={useCoverPage} disabled={busy !== ''} className={`${secondaryButton} flex-1`}>
									{busy === 'cover' ? 'Rendering…' : 'Use page'}
								</button>
							</div>
						</div>

						<form onSubmit={save} className="flex flex-col gap-4">
							<label className="flex flex-col gap-1">
								<span className="text-sm text-zinc-600 dark:text-zinc-400">Title</span>
								<input required value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-sm text-zinc-600 dark:text-zinc-400">Author</span>
								<input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Unknown" className={input} />
							</label>
							<TagInput tags={tags} onChange={setTags} suggestions={knownTags} />
							<p className={meta}>
								{book.pages} pages · {formatSize(book.size)} · added {new Date(book.created_at).toLocaleDateString()}
							</p>
							<div className="flex flex-wrap items-center gap-4">
								<button type="submit" disabled={!dirty || busy !== ''} className={primaryButton}>
									{busy === 'save' ? 'Saving…' : 'Save'}
								</button>
								<p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
									{status}
								</p>
							</div>
							<hr className="my-4 h-0.5 border-t-0 bg-zinc-300 dark:bg-white/10" />
							<div>
								<button
									type="button"
									onClick={remove}
									disabled={busy !== ''}
									className="text-sm text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-white duration-200 cursor-pointer disabled:opacity-50"
								>
									{busy === 'delete' ? 'Deleting…' : 'Delete this book'}
								</button>
							</div>
						</form>
					</div>
				)}
			</main>
		</>
	);
}

function TagInput({ tags, onChange, suggestions }: { tags: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
	const [draft, setDraft] = useState('');
	const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());

	function commit() {
		const tag = draft.trim().replace(/\s+/g, ' ').slice(0, 40);
		setDraft('');
		if (!tag || has(tag)) return;

		// Reuse an existing tag's spelling so "fiction" joins "Fiction".
		const known = suggestions.find((s) => s.toLowerCase() === tag.toLowerCase());
		const next = [...tags, known ?? tag];
		next.sort((a, b) => a.localeCompare(b));
		onChange(next);
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commit();
			return;
		}

		if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
			onChange(tags.slice(0, -1));
		}
	}

	return (
		<div className="flex flex-col gap-1">
			<label htmlFor="tag-input" className="text-sm text-zinc-600 dark:text-zinc-400">
				Tags
			</label>
			<div className="flex flex-wrap items-center gap-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 focus-within:border-blue-500 dark:focus-within:border-blue-500 duration-200">
				{tags.map((tag) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 pl-2 text-sm dark:text-white"
					>
						{tag}
						<button
							type="button"
							onClick={() => onChange(tags.filter((t) => t !== tag))}
							aria-label={`Remove tag ${tag}`}
							className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer duration-200"
						>
							<X />
						</button>
					</span>
				))}
				<input
					id="tag-input"
					list="tag-suggestions"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={onKeyDown}
					onBlur={commit}
					placeholder={tags.length ? 'Add another' : 'e.g. Fiction, To read'}
					className="flex-1 min-w-32 bg-transparent px-2 py-1 [&::-webkit-calendar-picker-indicator]:hidden dark:text-white placeholder:text-zinc-500 focus:outline-none"
				/>
				<datalist id="tag-suggestions">
					{suggestions
						.filter((s) => !has(s))
						.map((s) => (
							<option key={s} value={s} />
						))}
				</datalist>
			</div>
			<p className={meta}>Press Enter or comma to add. Tags group books on the library page.</p>
		</div>
	);
}
