import type { ReactNode } from 'react';

export const card = 'bg-zinc-100 dark:bg-zinc-800 rounded-none border border-zinc-300 dark:border-zinc-700';
export const buttonBase =
	'inline-flex items-center justify-center gap-2 cursor-pointer duration-200 active:opacity-75 disabled:opacity-50 disabled:cursor-not-allowed';
const primaryColors = 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500';
const secondaryColors = 'border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800';
export const primaryButton = `${buttonBase} px-4 py-2 ${primaryColors}`;
export const secondaryButton = `${buttonBase} px-4 py-2 ${secondaryColors}`;
export const smallPrimaryButton = `${buttonBase} px-3 py-1.5 text-sm ${primaryColors}`;
export const smallSecondaryButton = `${buttonBase} px-3 py-1.5 text-sm ${secondaryColors}`;
export const input =
	'w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 duration-200';
export const meta = 'text-xs text-zinc-500 dark:text-zinc-400';

export function Nav({ children, back }: { children?: ReactNode; back?: boolean }) {
	return (
		<nav className="bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-zinc-300 dark:border-white/10">
			<div className="max-w-screen-xl flex items-center justify-between gap-4 mx-auto px-4 md:px-8 h-16">
				<a
					href="/"
					className="text-2xl font-semibold whitespace-nowrap dark:text-white flex items-center gap-2 md:hover:text-blue-600 md:dark:hover:text-blue-500 duration-200"
				>
					{back && <ArrowLeft />}
					Library
				</a>
				<div className="flex items-center gap-4 min-w-0">{children}</div>
			</div>
		</nav>
	);
}

export function SectionHeading({ title, aside }: { title: string; aside?: ReactNode }) {
	return (
		<>
			<div className="flex items-baseline justify-between gap-4">
				<h1 className="dark:text-white text-xl">{title}</h1>
				{aside}
			</div>
			<hr className="my-4 h-0.5 border-t-0 bg-zinc-300 dark:bg-white/10" />
		</>
	);
}

const icon = {
	width: 16,
	height: 16,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
} as const;

const ArrowLeft = () => (
	<svg {...icon}>
		<path d="M19 12H5" />
		<path d="m12 19-7-7 7-7" />
	</svg>
);

export const Plus = () => (
	<svg {...icon}>
		<path d="M12 5v14" />
		<path d="M5 12h14" />
	</svg>
);

export const Upload = ({ size = 16 }: { size?: number }) => (
	<svg {...icon} width={size} height={size}>
		<path d="M12 3v12" />
		<path d="m17 8-5-5-5 5" />
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
	</svg>
);

export const X = () => (
	<svg {...icon} width={12} height={12}>
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</svg>
);

export const Minus = () => (
	<svg {...icon}>
		<path d="M5 12h14" />
	</svg>
);

export const PinIcon = () => (
	<svg {...icon}>
		<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
		<circle cx="12" cy="10" r="3" />
	</svg>
);

export const PenIcon = () => (
	<svg {...icon}>
		<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
		<path d="m15 5 4 4" />
	</svg>
);

export const HighlighterIcon = () => (
	<svg {...icon}>
		<path d="m9 11-6 6v3h9l3-3" />
		<path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
	</svg>
);

export const EraserIcon = () => (
	<svg {...icon}>
		<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
		<path d="m5.082 11.09 8.828 8.828" />
	</svg>
);

export const UndoIcon = () => (
	<svg {...icon}>
		<path d="M9 14 4 9l5-5" />
		<path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
	</svg>
);

export const SpreadIcon = () => (
	<svg {...icon}>
		<path d="M12 7v14" />
		<path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
	</svg>
);

export const NoteIcon = ({ size = 16 }: { size?: number }) => (
	<svg {...icon} width={size} height={size}>
		<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
	</svg>
);
