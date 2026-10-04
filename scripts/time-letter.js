// Times one letter photo through local Ollama and prints the explanation.
// Usage: node scripts/time-letter.js <image> [hi|en]   (set OLLAMA_MODEL to try another model)
import { readFile } from 'node:fs/promises';
import { explainDocument } from '../src/services/ollama.js';
import { OLLAMA_MODEL as MODEL } from '../src/config.js';

const [image, lang = 'hi'] = process.argv.slice(2);
if (!image) {
  console.error('Usage: node scripts/time-letter.js <image> [hi|en]');
  process.exit(1);
}

const imageB64 = (await readFile(image)).toString('base64');
const started = performance.now();
let firstTokenAt = null;

const { result, stats } = await explainDocument({
  imageB64,
  lang,
  onProgress: (chars) => {
    if (chars > 0) firstTokenAt ??= performance.now();
  },
});

const sec = (ns) => (ns / 1e9).toFixed(1);
console.log(JSON.stringify(result, null, 2));
console.log(`\nmodel: ${MODEL}  language: ${lang}`);
console.log(`wall clock:        ${((performance.now() - started) / 1000).toFixed(1)}s`);
console.log(`time to 1st token: ${((firstTokenAt - started) / 1000).toFixed(1)}s`);
console.log(`model load:        ${sec(stats.load_duration)}s`);
console.log(`prompt + image:    ${sec(stats.prompt_eval_duration)}s (${stats.prompt_eval_count} tokens)`);
console.log(`generation:        ${sec(stats.eval_duration)}s (${stats.eval_count} tokens, ${(stats.eval_count / (stats.eval_duration / 1e9)).toFixed(1)} tok/s)`);
