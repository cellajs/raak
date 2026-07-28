import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Regenerates the lucide icon assets from the installed lucide-static package:
 * - public/static/icons/lucide-sprite.svg: precached symbol sprite rendered via SpriteIcon
 * - src/modules/common/icons/lucide-icons.gen.json: name -> tags search index for the picker
 * - ../json/lucide-icon-names.json: valid icon names, used by backend schema validation
 * Run `pnpm --filter frontend gen:icons` after upgrading lucide-static (keep the version
 * aligned with lucide-react so picker, sprite and validation share one icon set).
 */
const root = path.resolve(import.meta.dirname, '..');
const lucidePkg = path.join(root, 'node_modules', 'lucide-static');

const sprite = readFileSync(path.join(lucidePkg, 'sprite.svg'), 'utf8');
const names = [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]).sort();
if (names.length < 1000) throw new Error(`[gen:icons] suspiciously few symbols (${names.length}); sprite format changed?`);

const tags: Record<string, string[]> = JSON.parse(readFileSync(path.join(lucidePkg, 'tags.json'), 'utf8'));
const searchIndex = Object.fromEntries(names.map((n) => [n, tags[n] ?? []]));

const spriteOut = path.join(root, 'public', 'static', 'icons');
mkdirSync(spriteOut, { recursive: true });
copyFileSync(path.join(lucidePkg, 'sprite.svg'), path.join(spriteOut, 'lucide-sprite.svg'));

writeFileSync(path.join(root, 'src', 'modules', 'common', 'icons', 'lucide-icons.gen.json'), JSON.stringify(searchIndex));
writeFileSync(path.join(root, '..', 'json', 'lucide-icon-names.json'), `${JSON.stringify(names, null, 2)}\n`);

console.info(`[gen:icons] sprite + search index + names written for ${names.length} icons`);
