import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const argumentsList = process.argv.slice(2);
const positionalRoot = argumentsList.find((argument) => !argument.startsWith('-')) ?? '.';
const portFlagIndex = argumentsList.indexOf('--port');
const requestedPort = portFlagIndex >= 0 ? argumentsList[portFlagIndex + 1] : process.env.PORT;
const port = Number.parseInt(requestedPort ?? '5173', 10);
const root = path.resolve(process.cwd(), positionalRoot);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Neplatný port: ${requestedPort}`);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wav', 'audio/wav'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, relativePath);
  const relativeCandidate = path.relative(root, candidate);

  if (relativeCandidate.startsWith('..') || path.isAbsolute(relativeCandidate)) {
    return null;
  }

  return candidate;
}

const server = createServer(async (request, response) => {
  try {
    let filePath = resolveRequestPath(request.url);

    if (!filePath) {
      response.writeHead(403).end('Zakázáno');
      return;
    }

    let fileStats;
    try {
      fileStats = await stat(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const relativePath = path.relative(root, filePath);
      const publicPath = path.resolve(root, 'public', relativePath);
      const relativePublicPath = path.relative(path.resolve(root, 'public'), publicPath);
      if (relativePublicPath.startsWith('..') || path.isAbsolute(relativePublicPath)) throw error;
      filePath = publicPath;
      fileStats = await stat(filePath);
    }

    if (fileStats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fileStats = await stat(filePath);
    }

    if (!fileStats.isFile()) {
      response.writeHead(404).end('Nenalezeno');
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': fileStats.size,
      'Content-Type': contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      response.writeHead(404).end('Nenalezeno');
      return;
    }

    console.error(error);
    response.writeHead(500).end('Chyba serveru');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Citadela běží na http://localhost:${port}`);
  console.log(`Kořen: ${root}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
