// Local web server: serves the page, explains document photos with Ollama,
// and optionally reads the explanation aloud with ElevenLabs.
import Fastify from 'fastify';
import { HOST, PORT, OLLAMA_MODEL } from './config.js';
import { warmUp } from './services/ollama.js';
import { ttsEnabled } from './services/elevenlabs.js';
import explainRoutes from './routes/explain.js';
import speakRoutes from './routes/speak.js';
import pageRoutes from './routes/pages.js';

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

await app.register(explainRoutes);
await app.register(speakRoutes);
await app.register(pageRoutes);

await app.listen({ host: HOST, port: PORT });
app.log.info(ttsEnabled ? 'ElevenLabs voice enabled' : 'ELEVENLABS_API_KEY not set, page will use a local voice');
warmUp()
  .then(() => app.log.info(`Model ${OLLAMA_MODEL} loaded`))
  .catch((err) => app.log.warn(`Model warm-up failed, is Ollama running? ${err.message}`));
