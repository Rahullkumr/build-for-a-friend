// Every setting the app reads from the environment, with defaults. See .env.example.

export const HOST = process.env.HOST || '127.0.0.1';
export const PORT = Number(process.env.PORT) || 3000;

// 127.0.0.1, not localhost: Node 22 tries IPv6 ::1 first, and Ollama listens on IPv4 only.
export const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
export const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
// George, a premade multilingual voice.
export const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
// Supports Hindi and the speed setting.
export const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
