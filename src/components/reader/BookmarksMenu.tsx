import { useEffect, useRef, useState } from 'react';
import { api, type Bookmark } from '../../api';
import { BookmarkIcon, buttonBase, input, meta, smallPrimaryButton, X } from '../../ui';

// A toolbar dropdown: name and save the current page, jump to a saved one, rename or delete it.
export function BookmarksMenu({ bookId, current, onJump, button }: { bookId: string; current: number; onJump: (page: number) => void; button: string }) {
	const [open, setOpen] = useState(false);
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [name, setName] = useState('');
	const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
	const [error, setError] = useState('');
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		api.bookmarks(bookId).then(setBookmarks, () => {});
	}, [bookId]);

	useEffect(() => {
		if (!open) return;
		const outside = (e: PointerEvent) => {
			if (!root.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener('pointerdown', outside);
		return () => document.removeEventListener('pointerdown', outside);
	}, [open]);

	async function run(action: () => Promise<void>) {
		setError('');
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
		}
	}

	const add = () =>
		run(async () => {
			const saved = await api.addBookmark(bookId, current, name.trim() || `Page ${current}`);
			setBookmarks((list) => [...list, saved].sort((a, b) => a.page - b.page || a.created_at - b.created_at));
			setName('');
		});

	const rename = (id: string, newName: string) =>
		run(async () => {
			const saved = await api.renameBookmark(bookId, id, newName);
			setBookmarks((list) => list.map((b) => (b.id === id ? saved : b)));
			setRenaming(null);
		});

	const remove = (b: Bookmark) =>
		run(async () => {
			await api.removeBookmark(bookId, b.id);
			setBookmarks((list) => list.filter((x) => x.id !== b.id));
		});

	return (
		<div
			ref={root}
			className="relative"
			onKeyDown={(e) => {
				if (e.key !== 'Escape' || !open) return;
				// Keep the reader's Escape handler from also closing the notes panel.
				e.stopPropagation();
				if (renaming) setRenaming(null);
				else setOpen(false);
			}}
		>
			<button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Bookmarks" title="Bookmarks" className={button}>
				<BookmarkIcon filled={bookmarks.some((b) => b.page === current)} />
				<span className="hidden md:inline">Bookmarks</span>
			</button>
			{open && (
				<div className="absolute right-0 top-full mt-2 z-40 w-80 max-w-[calc(100vw-1rem)] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700">
					<form
						className="flex gap-2 p-3 border-b border-zinc-300 dark:border-white/10"
						onSubmit={(e) => {
							e.preventDefault();
							add();
						}}
					>
						<input
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={`Page ${current}`}
							aria-label={`Bookmark name for page ${current}`}
							maxLength={200}
							className={`${input} min-w-0 flex-1 text-sm`}
						/>
						<button type="submit" className={smallPrimaryButton}>
							Add
						</button>
					</form>
					{error && (
						<p role="alert" className="px-3 pt-2 text-sm dark:text-white">
							{error}
						</p>
					)}
					<ul className="max-h-80 overflow-y-auto p-1">
						{bookmarks.length === 0 && <li className={`${meta} p-2`}>No bookmarks yet. Name this page and press Add.</li>}
						{bookmarks.map((b) =>
							renaming?.id === b.id ? (
								<li key={b.id}>
									<form
										className="flex gap-2 p-2"
										onSubmit={(e) => {
											e.preventDefault();
											rename(b.id, renaming.name);
										}}
									>
										<input
											autoFocus
											value={renaming.name}
											onChange={(e) => setRenaming({ id: b.id, name: e.target.value })}
											aria-label="New bookmark name"
											maxLength={200}
											className={`${input} min-w-0 flex-1 text-sm`}
										/>
										<button type="submit" className={smallPrimaryButton}>
											Save
										</button>
									</form>
								</li>
							) : (
								<li key={b.id} className="group flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
									<button
										type="button"
										onClick={() => {
											onJump(b.page);
											setOpen(false);
										}}
										className="flex-1 min-w-0 flex items-baseline gap-2 p-2 text-left cursor-pointer"
									>
										<span className="truncate text-sm dark:text-white">{b.name}</span>
										<span className={`${meta} ml-auto shrink-0 tabular-nums`}>p. {b.page}</span>
									</button>
									<button
										type="button"
										onClick={() => setRenaming({ id: b.id, name: b.name })}
										className={`${meta} underline px-1 cursor-pointer hover:text-zinc-900 dark:hover:text-white`}
									>
										Rename
									</button>
									<button
										type="button"
										onClick={() => remove(b)}
										aria-label={`Delete bookmark ${b.name}`}
										className={`${buttonBase} h-7 w-7 hover:bg-zinc-200 dark:hover:bg-zinc-700`}
									>
										<X />
									</button>
								</li>
							),
						)}
					</ul>
				</div>
			)}
		</div>
	);
}
