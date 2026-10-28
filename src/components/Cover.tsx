import { useState } from 'react';
import { type Book, coverUrl } from '../api';

export function Cover({ book, className = '' }: { book: Book; className?: string }) {
	const [failed, setFailed] = useState(false);
	return failed ? (
		<div
			className={`aspect-[5/7] border-b border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-700 p-3 text-sm text-zinc-600 dark:text-zinc-300 overflow-hidden ${className}`}
		>
			{book.title}
		</div>
	) : (
		<img
			src={coverUrl(book)}
			alt=""
			loading="lazy"
			decoding="async"
			onError={() => setFailed(true)}
			className={`w-full aspect-[5/7] object-cover object-top border-b border-zinc-300 dark:border-zinc-700 bg-white ${className}`}
		/>
	);
}
