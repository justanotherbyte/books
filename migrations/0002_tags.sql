-- A tag exists while at least one book has it, so tags need no table of their own.
CREATE TABLE book_tags (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (book_id, tag)
);
CREATE INDEX book_tags_tag ON book_tags (tag);
