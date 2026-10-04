// Sends one document photo to the local Ollama model and returns a plain-language explanation.
import { OLLAMA_URL, OLLAMA_MODEL, OLLAMA_KEEP_ALIVE } from '../config.js';
import { LANGUAGES, schema, buildPrompt } from '../prompts/explain-document.js';

// Loads the model into memory so the first real request does not pay the load time.
export async function warmUp() {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, keep_alive: OLLAMA_KEEP_ALIVE }),
  });
  if (!res.ok) throw new Error(`Ollama warm-up failed (${res.status}): ${await res.text()}`);
}

// onProgress receives the number of characters generated so far.
export async function explainDocument({ imageB64, lang = 'hi', onProgress = () => {}, signal }) {
  if (!LANGUAGES[lang]) throw new Error(`Unsupported language: ${lang}`);

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: true,
      think: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      format: schema,
      // 0.2 made it loop and break the JSON; 0.7 produced odd words. num_predict caps a runaway answer.
      options: { temperature: 0.4, top_p: 0.8, top_k: 20, num_predict: 900 },
      messages: [{ role: 'user', content: buildPrompt(lang), images: [imageB64] }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let stats = null;
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      if (msg.message?.content) {
        content += msg.message.content;
        onProgress(content.length);
      }
      if (msg.done) stats = msg;
    }
  }

  return { result: JSON.parse(content), stats };
}
