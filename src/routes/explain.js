// POST /explain: photo in, streamed progress and explanation out.
import { explainDocument } from '../services/ollama.js';
import { LANGUAGES } from '../prompts/explain-document.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// JPEG, PNG and WebP magic bytes.
const IMAGE_SIGNATURES = [[0xff, 0xd8, 0xff], [0x89, 0x50, 0x4e, 0x47], [0x52, 0x49, 0x46, 0x46]];

export default async function explainRoutes(app) {
  app.post('/explain', {
    schema: {
      body: {
        type: 'object',
        required: ['image', 'lang'],
        properties: {
          image: { type: 'string', minLength: 1 },
          lang: { type: 'string', enum: Object.keys(LANGUAGES) },
        },
      },
    },
  }, async (request, reply) => {
    const imageB64 = request.body.image.replace(/^data:image\/[a-z]+;base64,/, '');
    const bytes = Buffer.from(imageB64, 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) {
      return reply.code(413).send({ error: 'Image is too large. Please use a smaller photo.' });
    }
    if (!IMAGE_SIGNATURES.some((sig) => sig.every((b, i) => bytes[i] === b))) {
      return reply.code(400).send({ error: 'Please upload a JPEG, PNG or WebP photo.' });
    }

    // Stream newline-delimited JSON so the page can show progress during the long wait.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' });
    const send = (event) => res.write(JSON.stringify(event) + '\n');

    // Stop the model if the person closes the page mid-request.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    send({ type: 'progress', phase: 'reading', chars: 0 });
    const started = Date.now();
    try {
      const { result } = await explainDocument({
        imageB64,
        lang: request.body.lang,
        signal: abort.signal,
        onProgress: (chars) => send({ type: 'progress', phase: 'writing', chars }),
      });
      send({ type: 'result', data: result, seconds: Math.round((Date.now() - started) / 1000) });
    } catch (err) {
      if (abort.signal.aborted) return;
      request.log.error(err);
      send({ type: 'error', message: 'Could not read this document. Please try again with a clearer photo.' });
    }
    res.end();
  });
}
