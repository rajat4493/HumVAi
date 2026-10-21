// Fails if anything provider- or key-shaped is present in the production web bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../apps/web/dist/', import.meta.url).pathname;
const forbidden = [
  /api\.anthropic\.com/i, /api\.openai\.com/i, /x-api-key/i, /ANTHROPIC_API_KEY/, /OPENAI_API_KEY/, /anthropic-version/i,
  /sk-ant-[A-Za-z0-9_-]{10,}/, /sk-[A-Za-z0-9]{20,}/, /Bearer\s+[A-Za-z0-9._-]{20,}/,
];
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let bad = 0;
const files = walk(root).filter((f) => /\.(js|css|html|map)$/.test(f));
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const re of forbidden) if (re.test(text)) { console.error(`FORBIDDEN ${re} in ${f}`); bad++; }
}
console.log(`scanned ${files.length} bundle files: ${bad === 0 ? 'clean' : `${bad} problem(s)`}`);
process.exit(bad === 0 ? 0 : 1);
