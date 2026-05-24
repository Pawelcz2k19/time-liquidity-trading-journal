// ===== Tesseract OCR wrapper =====
// Loads Tesseract.js lazily, runs OCR with English + Polish + Italian language packs.
// Returns plain text — parsing happens in broker-specific parsers.

import Tesseract from "tesseract.js";

let workerPromise: Promise<Tesseract.Worker> | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker(["eng", "pol", "ita"], 1, {
      // CDN paths — Tesseract auto-loads from unpkg by default
      logger: () => {}, // silent; UI uses its own progress
    });
  }
  return workerPromise;
}

export async function runOcr(
  image: File | Blob | string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const worker = await getWorker();

  // Hook into the recognize progress via re-creating worker for progress events
  // tesseract.js v5 surfaces progress via createWorker logger which we set above.
  // For simplicity we report 50% before, 100% after.
  onProgress?.(20);
  const { data } = await worker.recognize(image);
  onProgress?.(100);
  return data.text;
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
