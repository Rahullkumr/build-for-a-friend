// Serves the page and its CSS/JS from public/.
// Only files that exist at startup are served, so a crafted path can never reach outside public/.
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && TYPES[extname(e.name)])
    .map((e) => '/' + relative(PUBLIC_DIR, join(e.parentPath, e.name)).split(sep).join('/'));
}

export default async function pageRoutes(app) {
  const files = new Set(await listFiles(PUBLIC_DIR));

  app.get('/*', async (request, reply) => {
    const path = request.url.split('?')[0];
    const file = path === '/' ? '/index.html' : path;
    if (!files.has(file)) return reply.code(404).send({ error: 'Not found' });
    // Read on each request so edits show up on refresh without restarting the server.
    const body = await readFile(join(PUBLIC_DIR, file));
    return reply.type(TYPES[extname(file)]).header('Cache-Control', 'no-cache').send(body);
  });
}
