import { useState } from 'react';
import { api } from '../api';
import { card, input, primaryButton } from '../ui';

// `next` is the page that hit a 401; the login route has already checked it is a local path.
export function Login({ next }: { next: string }) {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError('');

		try {
			await api.login(password);
			location.replace(next);
		} catch (err) {
			const wrongPassword = err instanceof Error && err.message === 'Wrong password';
			setError(wrongPassword ? 'Wrong password. Try again.' : 'Could not reach the server. Try again.');
			setBusy(false);
		}
	}

	return (
		<main className="min-h-dvh flex items-center justify-center p-8">
			<form onSubmit={submit} className={`${card} w-full max-w-sm p-4 flex flex-col gap-4`}>
				<div>
					<h1 className="text-2xl font-semibold dark:text-white">Library</h1>
					<p className="text-zinc-600 dark:text-zinc-400 mt-1">Enter the password to see your books.</p>
				</div>
				<label className="flex flex-col gap-1">
					<span className="text-sm text-zinc-600 dark:text-zinc-400">Password</span>
					<input
						type="password"
						autoComplete="current-password"
						autoFocus
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className={input}
						aria-invalid={error !== ''}
						aria-describedby={error ? 'login-error' : undefined}
					/>
				</label>
				{error && (
					<p id="login-error" role="alert" className="text-sm text-zinc-900 dark:text-white">
						{error}
					</p>
				)}
				<button type="submit" disabled={busy} className={primaryButton}>
					{busy ? 'Unlocking…' : 'Unlock'}
				</button>
			</form>
		</main>
	);
}
