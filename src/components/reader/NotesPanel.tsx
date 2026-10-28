import { useState } from 'react';
import type { Note } from '../../api';
import { buttonBase, meta, smallPrimaryButton, smallSecondaryButton, X } from '../../ui';
import type { Draft } from './shared';

export type Editing = { note?: Note; draft?: Draft } | null;

export function NotesPanel({
	notes,
	editing,
	onSelect,
	onSave,
	onDelete,
	onCancel,
	onClose,
}: {
	notes: Note[];
	editing: Editing;
	onSelect: (note: Note) => void;
	onSave: (body: string) => Promise<void>;
	onDelete: (note: Note) => Promise<void>;
	onCancel: () => void;
	onClose: () => void;
}) {
	const active = editing?.note;
	return (
		<aside
			aria-label="Notes"
			className="fixed inset-x-0 bottom-0 z-30 max-h-[55dvh] md:static md:max-h-none md:w-96 flex flex-col bg-white dark:bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-300 dark:border-zinc-700"
		>
			<div className="flex items-center justify-between px-4 h-12 border-b border-zinc-300 dark:border-white/10 shrink-0">
				<h2 className="dark:text-white">
					Notes <span className={meta}>{notes.length}</span>
				</h2>
				<button type="button" onClick={onClose} aria-label="Close notes" className={`${buttonBase} h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
					<X />
				</button>
			</div>
			<div className="overflow-y-auto p-4 flex flex-col gap-2">
				{editing && (
					<NoteEditor key={editing.note?.id ?? 'draft'} note={editing.note} draft={editing.draft} onSave={onSave} onDelete={onDelete} onCancel={onCancel} />
				)}
				{notes.length === 0 && !editing && (
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						No notes yet. Select text on a page and choose Add note. On a scanned page with no selectable text, use Pin and tap the spot.
					</p>
				)}
				{notes.map((note) => (
					<button
						key={note.id}
						type="button"
						onClick={() => onSelect(note)}
						className={`text-left p-3 border cursor-pointer active:opacity-75 duration-100 ${
							active?.id === note.id
								? 'border-blue-500 bg-zinc-100 dark:bg-zinc-800'
								: 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500'
						}`}
					>
						<span className={meta}>Page {note.page}</span>
						{note.quote && <p className="text-sm italic text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">"{note.quote}"</p>}
						<p className={`text-sm mt-1 line-clamp-3 whitespace-pre-line ${note.body ? 'dark:text-white' : 'text-zinc-400'}`}>{note.body || 'No text'}</p>
					</button>
				))}
			</div>
		</aside>
	);
}

function NoteEditor({
	note,
	draft,
	onSave,
	onDelete,
	onCancel,
}: {
	note?: Note;
	draft?: Draft;
	onSave: (body: string) => Promise<void>;
	onDelete: (note: Note) => Promise<void>;
	onCancel: () => void;
}) {
	const [body, setBody] = useState(note?.body ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const quote = note?.quote ?? draft?.quote;
	const page = note?.page ?? draft?.page;

	async function run(action: () => Promise<void>) {
		setBusy(true);
		setError('');

		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
			setBusy(false);
		}
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				run(() => onSave(body));
			}}
			className="flex flex-col gap-2 p-3 border border-blue-500 bg-white dark:bg-zinc-900"
		>
			<span className={meta}>
				{note ? 'Edit note' : 'New note'} · page {page}
			</span>
			{quote && <p className="text-sm italic text-zinc-600 dark:text-zinc-400 line-clamp-4">"{quote}"</p>}
			<textarea
				autoFocus
				rows={4}
				value={body}
				onChange={(e) => setBody(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						run(() => onSave(body));
					}
				}}
				placeholder="Write a note"
				aria-label="Note"
				className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 duration-200 resize-y"
			/>
			{error && (
				<p role="alert" className="text-sm dark:text-white">
					Could not save: {error}
				</p>
			)}
			<div className="flex items-center gap-2">
				<button type="submit" disabled={busy} className={smallPrimaryButton}>
					{busy ? 'Saving…' : 'Save'}
				</button>
				<button type="button" onClick={onCancel} disabled={busy} className={smallSecondaryButton}>
					Cancel
				</button>
				{note && (
					<button
						type="button"
						disabled={busy}
						onClick={() => {
							if (confirm('Delete this note?')) run(() => onDelete(note));
						}}
						className="ml-auto text-sm text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-white duration-200 cursor-pointer disabled:opacity-50"
					>
						Delete
					</button>
				)}
			</div>
		</form>
	);
}
