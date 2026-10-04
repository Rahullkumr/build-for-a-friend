// GET /config and POST /speak: the ElevenLabs voice for the Listen button.
import { Readable } from 'node:stream';
import { speak, ttsEnabled } from '../services/elevenlabs.js';

export default async function speakRoutes(app) {
  // Tells the page whether the ElevenLabs voice is set up, so it can fall back to a local voice.
  app.get('/config', async () => ({ tts: ttsEnabled }));

  app.post('/speak', {
    schema: {
      body: {
        type: 'object',
        required: ['text'],
        properties: { text: { type: 'string', minLength: 1, maxLength: 3000 } },
      },
    },
  }, async (request, reply) => {
    if (!ttsEnabled) return reply.code(503).send({ error: 'ElevenLabs is not set up.' });
    const abort = new AbortController();
    reply.raw.on('close', () => abort.abort());
    try {
      const audio = await speak(request.body.text, abort.signal);
      return reply.type('audio/mpeg').header('Cache-Control', 'no-store').send(Readable.fromWeb(audio));
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: 'Voice service failed.' });
    }
  });
}
