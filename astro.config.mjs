import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
	output: 'server',
	// Covers are plain <img> tags served from R2, so there is nothing for Cloudflare Images to transform.
	adapter: cloudflare({ imageService: 'passthrough' }),
	integrations: [react()],
	// The API has its own signed-cookie login; Astro sessions would need a KV namespace nobody uses.
	session: false,
	vite: { plugins: [tailwindcss()] },
});
