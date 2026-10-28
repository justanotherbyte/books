-- rects: JSON array of [x, y, width, height], each a fraction of the page size, so notes line up at any zoom.
-- A zero-size rect is a pin dropped on the page (for scanned books with no selectable text).
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  quote TEXT NOT NULL DEFAULT '',
  rects TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX notes_book ON notes (book_id, page);
