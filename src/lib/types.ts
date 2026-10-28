export type Book = {
	id: string;
	title: string;
	author: string;
	pages: number;
	size: number;
	created_at: number;
	updated_at: number;
	tags: string[];
};

// rects are [x, y, width, height] as fractions of the page; a zero-size rect is a pin.
export type Note = {
	id: string;
	book_id: string;
	page: number;
	quote: string;
	rects: [x: number, y: number, width: number, height: number][];
	body: string;
	created_at: number;
	updated_at: number;
};

// points are x0, y0, x1, y1, ... as fractions of the page; width is a fraction of the page width.
export type Stroke = {
	id: string;
	book_id: string;
	page: number;
	tool: 'pen' | 'highlighter';
	color: string;
	width: number;
	points: number[];
	created_at: number;
};

export type Tag = { name: string; count: number };
