// Turns the explanation text into speech with ElevenLabs.
// Only the spoken text is sent; the photo and the details list never leave the computer.
import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL } from '../config.js';

export const ttsEnabled = Boolean(ELEVENLABS_API_KEY);

// Returns the MP3 as a web ReadableStream.
export async function speak(text, signal) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        // Slightly slower and steadier than default, for an elderly listener.
        voice_settings: { stability: 0.6, similarity_boost: 0.75, speed: 0.9 },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.body;
}
