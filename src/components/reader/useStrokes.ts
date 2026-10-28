import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Stroke } from '../../api';

export type NewStroke = Pick<Stroke, 'page' | 'tool' | 'color' | 'width' | 'points'>;
type Action = { kind: 'add' | 'erase'; stroke: Stroke };

// A book's strokes. Changes show at once and save in the background; a failed save is rolled back.
export function useStrokes(id: string) {
	const [strokes, setStrokes] = useState<Stroke[]>([]);
	const [error, setError] = useState('');
	const [canUndo, setCanUndo] = useState(false);
	const history = useRef<Action[]>([]);
	const queue = useRef(Promise.resolve());

	useEffect(() => {
		api.strokes(id).then(setStrokes, () => {});
	}, [id]);

	const forget = useCallback((stroke: Stroke) => {
		history.current = history.current.filter((a) => a.stroke.id !== stroke.id);
		setCanUndo(history.current.length > 0);
	}, []);

	// One request at a time, so erasing a stroke never reaches the server before the stroke itself.
	const send = useCallback((request: () => Promise<unknown>, rollback: () => void, message: string) => {
		queue.current = queue.current.then(request).then(
			() => {},
			() => {
				rollback();
				setError(message);
			},
		);
	}, []);

	const put = useCallback(
		(stroke: Stroke) => {
			setStrokes((list) => [...list, stroke]);
			const { page, tool, color, width, points } = stroke;
			send(
				() => api.addStroke(id, { id: stroke.id, page, tool, color, width, points }),
				() => {
					setStrokes((list) => list.filter((s) => s.id !== stroke.id));
					forget(stroke);
				},
				'Could not save the drawing. Check your connection.',
			);
		},
		[id, send, forget],
	);

	const drop = useCallback(
		(stroke: Stroke) => {
			setStrokes((list) => list.filter((s) => s.id !== stroke.id));
			send(
				// Already gone (say its own save failed) is what erasing wanted anyway.
				() => api.removeStroke(id, stroke.id).catch((err: Error) => (err.message === 'Not found' ? undefined : Promise.reject(err))),
				() => {
					setStrokes((list) => [...list, stroke]);
					forget(stroke);
				},
				'Could not erase. Check your connection.',
			);
		},
		[id, send, forget],
	);

	const record = useCallback((action: Action) => {
		history.current.push(action);
		setCanUndo(true);
		setError('');
	}, []);

	const add = useCallback(
		(s: NewStroke) => {
			const stroke: Stroke = { ...s, id: crypto.randomUUID(), book_id: id, created_at: Date.now() };
			put(stroke);
			record({ kind: 'add', stroke });
		},
		[id, put, record],
	);

	const erase = useCallback(
		(stroke: Stroke) => {
			drop(stroke);
			record({ kind: 'erase', stroke });
		},
		[drop, record],
	);

	// Undoing an erase saves the stroke again under its old id.
	const undo = useCallback(() => {
		const action = history.current.pop();
		setCanUndo(history.current.length > 0);
		if (!action) return;

		if (action.kind === 'add') drop(action.stroke);
		else put(action.stroke);
	}, [drop, put]);

	return { strokes, error, canUndo, add, erase, undo };
}
