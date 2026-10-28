-- Freehand drawing, one row per stroke. points: JSON array x0, y0, x1, y1, ... as fractions of the page size;
-- width is a fraction of the page width. Both keep strokes lined up at any zoom.
CREATE TABLE strokes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  tool TEXT NOT NULL,
  color TEXT NOT NULL,
  width REAL NOT NULL,
  points TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX strokes_book ON strokes (book_id, page);
