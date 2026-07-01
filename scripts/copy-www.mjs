/**
 * Copie le client web (source unique) vers les cibles d'empaquetage :
 *  - desktop/www  (Electron)
 *  - mobile/www   (Capacitor)
 * Usage : node scripts/copy-www.mjs [desktop|mobile|all]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const client = path.join(root, 'client');
const target = process.argv[2] || 'all';

function copyTo(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(client, dest, { recursive: true });
  console.log(`client/ -> ${dest}`);
}

if (target === 'desktop' || target === 'all') copyTo(path.join(root, 'desktop', 'www'));
if (target === 'mobile' || target === 'all') copyTo(path.join(root, 'mobile', 'www'));
