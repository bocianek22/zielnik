// Hook ładowania modułów dla testów z bazą: kod aplikacji importuje '@/lib/x' i './db' bez rozszerzenia
// (to rozwiązuje Next.js), a sterownik Neon (HTTP) podmieniamy na zwykły `pg` z lokalnym PostgreSQL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');

export async function resolve(spec, ctx, next) {
  if (spec === '@neondatabase/serverless') return { url: pathToFileURL(path.join(HERE, 'neon-shim.mjs')).href, shortCircuit: true };
  if (spec === 'next/headers') return { url: pathToFileURL(path.join(HERE, 'headers-shim.mjs')).href, shortCircuit: true };
  if (spec === '@vercel/blob') return { url: pathToFileURL(path.join(HERE, 'blob-shim.mjs')).href, shortCircuit: true };
  if (spec === 'next/cache') return { url: pathToFileURL(path.join(HERE, 'cache-shim.mjs')).href, shortCircuit: true };
  if (spec === 'next/server') return next('next/server.js', ctx);
  let url = spec;
  if (spec.startsWith('@/')) url = pathToFileURL(path.join(ROOT, spec.slice(2))).href;
  else if (spec.startsWith('.') && ctx.parentURL) url = new URL(spec, ctx.parentURL).href;
  if (url.startsWith('file:')) {
    const p = fileURLToPath(url);
    for (const c of [p, p + '.js', path.join(p, 'index.js')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return next(pathToFileURL(c).href, ctx);
      }
    }
  }
  return next(spec, ctx);
}

// Kod aplikacji importuje JSON bez `with { type: 'json' }` (to obsługuje Next.js): podajemy go jako moduł ES
export async function load(url, ctx, next) {
  if (url.startsWith('file:') && url.endsWith('.json') && ctx.importAttributes?.type !== 'json') {
    return { format: 'module', source: `export default ${fs.readFileSync(fileURLToPath(url), 'utf8')};`, shortCircuit: true };
  }
  return next(url, ctx);
}
