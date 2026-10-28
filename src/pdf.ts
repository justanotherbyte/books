import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export type PDFDocument = pdfjs.PDFDocumentProxy;

// Range requests only: pdf.js fetches the xref and each page's bytes on demand instead of the whole file.
export function openRemote(url: string) {
	return pdfjs.getDocument({ url, disableAutoFetch: true, disableStream: true, rangeChunkSize: 256 * 1024 }).promise;
}

export function openLocal(data: ArrayBuffer) {
	return pdfjs.getDocument({ data }).promise;
}

async function renderPage(doc: PDFDocument, pageNumber: number, canvas: HTMLCanvasElement, width: number) {
	const page = await doc.getPage(pageNumber);
	const scale = width / page.getViewport({ scale: 1 }).width;
	const viewport = page.getViewport({ scale });

	canvas.width = Math.floor(viewport.width);
	canvas.height = Math.floor(viewport.height);
	await page.render({ canvas, viewport }).promise;
}

// Canvas pixels are capped so deep zoom doesn't exceed mobile Safari's ~16.7M-pixel canvas limit.
// shortcut: past the cap the bitmap is CSS-upscaled and slightly soft; tile the page if crisp 400% zoom on phones matters.
const MAX_CANVAS_PIXELS = 12_000_000;

// Renders the bitmap and the invisible, selectable text layer for a page shown `cssWidth` pixels wide.
export async function renderReaderPage(doc: PDFDocument, pageNumber: number, canvas: HTMLCanvasElement, textLayer: HTMLElement, cssWidth: number) {
	const page = await doc.getPage(pageNumber);
	const base = page.getViewport({ scale: 1 });
	const cssScale = cssWidth / base.width;
	const cssPixels = base.width * base.height * cssScale * cssScale;
	const pixelRatio = Math.min(devicePixelRatio, Math.sqrt(MAX_CANVAS_PIXELS / cssPixels));
	const viewport = page.getViewport({ scale: cssScale * pixelRatio });

	canvas.width = Math.floor(viewport.width);
	canvas.height = Math.floor(viewport.height);
	await page.render({ canvas, viewport }).promise;

	textLayer.replaceChildren();
	textLayer.style.setProperty('--total-scale-factor', String(cssScale));
	const text = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textLayer, viewport: page.getViewport({ scale: cssScale }) });
	await text.render();

	return base.height / base.width;
}

export async function renderCover(doc: PDFDocument, pageNumber = 1): Promise<Blob> {
	const canvas = document.createElement('canvas');
	// 480px covers a 2x-density grid tile; larger adds bytes nobody sees.
	await renderPage(doc, pageNumber, canvas, 480);

	return new Promise((resolve, reject) => {
		function done(blob: Blob | null) {
			if (blob) resolve(blob);
			else reject(new Error('Could not render cover'));
		}
		canvas.toBlob(done, 'image/jpeg', 0.8);
	});
}

// PDF metadata titles are often junk ("Microsoft Word - draft3.doc", "untitled"), so fall back to the file name.
export async function extractDetails(doc: PDFDocument, fileName: string) {
	const { info } = (await doc.getMetadata()) as { info: { Title?: string; Author?: string } };
	const metaTitle = info.Title?.trim() ?? '';
	const junk = metaTitle === '' || /^(untitled|microsoft word|document\d*$)|\.(docx?|pdf|indd|tex)$/i.test(metaTitle);

	const fromName = fileName
		.replace(/\.pdf$/i, '')
		.replace(/[_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	return { title: junk ? fromName : metaTitle, author: info.Author?.trim() ?? '', pages: doc.numPages };
}
