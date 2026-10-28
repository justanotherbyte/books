# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript on Cloudflare Workers. Astro with the Cloudflare adapter serves the pages and the API (Astro endpoints, request bodies validated with Zod) from one Worker; each page is a client-only React island. Tailwind CSS v4. Book files and covers in R2, book metadata in D1. Built and tested locally with `wrangler dev`; deploy is left to the owner.

## Users

One person, the owner, reading their own PDF collection on phone and desktop, often on the go.

## Product Purpose

A private library. Upload a PDF, browse the collection by cover and title, and read any book in the browser without downloading the whole file first. The reader fetches PDF bytes from R2 with HTTP range requests as pages scroll into view.

## Operating Context

- Upload happens on desktop by dragging a PDF onto the library page.
- Reading happens on phone or desktop, sometimes on slow mobile connections, which is why streaming matters.
- After upload the owner lands on a Book Details page to correct the auto-extracted title (from PDF metadata or first page) and cover (page 1 render).

## Capabilities and Constraints

- PDF only. EPUB was considered and excluded.
- The whole site sits behind one password, stored as a Cloudflare secret (`APP_PASSWORD`).
- Cover and title extraction run in the browser with pdf.js before upload.
- Books are grouped with tags (many per book, stored in D1 `book_tags`). The library filters by one tag at a time, and a PDF dropped while a tag is selected gets that tag.
- The reader zooms the pages only (buttons, ctrl/cmd + wheel or keys, two-finger pinch); browser zoom stays at 1. Zoom level is remembered per device.
- Notes attach to selected text (highlighted lines) or, on scanned pages, to a pinned spot. Stored in D1 `notes` with positions as page fractions, listed in a side panel.
- Undecided: reading-position sync, search, renaming a tag across all books.

## Brand Commitments

Visual style is binding: the owner's viswa.space style (JetBrains Mono, zinc greys, blue as the only accent, square bordered cards, no shadows or gradients, dark mode follows the OS).

## Product Principles

- The library opens straight into the books. No hero, no dashboard.
- Uploading takes one drag. Editing details is optional.
- Reading starts before the file finishes downloading.
