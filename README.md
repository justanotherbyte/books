# Books

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/justanotherbyte/books)

A private PDF library on Cloudflare Workers. PDFs and covers live in R2, metadata in D1. The reader fetches pages with HTTP range requests as you scroll, so a 40 MB book opens after a few hundred KB.

## Layout

- `src/pages/` holds the Astro routes. Each page renders one React component from `src/components/` as a client-only island.
- `src/pages/api/` is the API, one Astro endpoint per route. Shared queries and Zod schemas live in `src/lib/`.
- `src/middleware.ts` checks the session cookie on every request. Pages redirect to `/login`, and API routes return 401.
- `src/api.ts` is the frontend's client. Request and response types come from `src/lib/types.ts`, which the endpoints use too.
- `src/components/reader/` is the reader: zoom, text selection, page rendering and the notes panel each live in their own file.
- `migrations/` holds the D1 schema.

## Develop

```sh
npm install
echo "APP_PASSWORD=books" > .dev.vars
npm run db:migrate:local
npm run dev                         # http://localhost:4321
npm run smoke -- some.pdf           # in a second terminal: auth, upload and range checks
```

## Deploy

The button above creates the R2 bucket and D1 database, asks for `APP_PASSWORD`, and runs the migrations on each deploy. To deploy by hand:

```sh
npx wrangler login
npx wrangler r2 bucket create books
npx wrangler d1 create books        # paste the printed database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put APP_PASSWORD
npm run deploy
```

Changing `APP_PASSWORD` signs out every session.
