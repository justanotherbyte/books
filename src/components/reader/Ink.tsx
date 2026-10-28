import type { Stroke } from '../../api';

// SVG path for flat [x0, y0, x1, y1, ...] page fractions, in a viewBox one unit wide and `aspect` tall.
export function inkPath(points: number[], aspect: number) {
	let d = `M${points[0]} ${points[1] * aspect}`;
	for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1] * aspect}`;
	// A single point gets a zero-length segment, which the round cap draws as a dot.
	return points.length === 2 ? `${d}L${points[0]} ${points[1] * aspect}` : d;
}

export const HIGHLIGHTER_OPACITY = 0.4;
const layer = 'absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply';

// Saved strokes, plus an empty layer that useInkInput draws the stroke in progress into.
export function Ink({ strokes, aspect }: { strokes: Stroke[]; aspect: number }) {
	const viewBox = `0 0 1 ${aspect}`;

	return (
		<>
			<svg className={layer} viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
				{strokes.map((s) => (
					<path
						key={s.id}
						d={inkPath(s.points, aspect)}
						fill="none"
						stroke={s.color}
						strokeWidth={s.width}
						strokeOpacity={s.tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				))}
			</svg>
			<svg data-live className={layer} viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true" />
		</>
	);
}
