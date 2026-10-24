import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Regenerates the lucide icon assets from the installed lucide-static package:
 * - ../json/lucide-icon-nodes.json: name -> svg child elements, rendered inline by NamedIcon
 * - src/modules/label/lucide-icons.gen.json: name -> tags search index for the picker
 * - ../json/lucide-icon-names.json: valid icon names, used by backend schema validation
 * Run `pnpm --filter frontend gen:icons` after upgrading lucide-static (keep the version
 * aligned with lucide-react so picker, icons and validation share one icon set).
 */
const root = path.resolve(import.meta.dirname, '..');
const lucidePkg = path.join(root, 'node_modules', 'lucide-static');

const iconNodes: Record<string, unknown> = JSON.parse(readFileSync(path.join(lucidePkg, 'icon-nodes.json'), 'utf8'));
const names = Object.keys(iconNodes).sort();
if (names.length < 1000) throw new Error(`[gen:icons] suspiciously few icons (${names.length}); icon-nodes.json format changed?`);

const nodes = Object.fromEntries(names.map((name) => [name, iconNodes[name]]));

const tags: Record<string, string[]> = JSON.parse(readFileSync(path.join(lucidePkg, 'tags.json'), 'utf8'));
const searchIndex = Object.fromEntries(names.map((n) => [n, tags[n] ?? []]));

writeFileSync(path.join(root, '..', 'json', 'lucide-icon-nodes.json'), `${JSON.stringify(nodes)}\n`);
writeFileSync(path.join(root, 'src', 'modules', 'label', 'lucide-icons.gen.json'), JSON.stringify(searchIndex));
writeFileSync(path.join(root, '..', 'json', 'lucide-icon-names.json'), `${JSON.stringify(names, null, 2)}\n`);

console.info(`[gen:icons] icon nodes + search index + names written for ${names.length} icons`);
