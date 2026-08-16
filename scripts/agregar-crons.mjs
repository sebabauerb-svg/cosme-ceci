/**
 * Copia los `crons` de vercel.json al output del build.
 * =====================================================
 * El adaptador de Astro genera `.vercel/output/config.json` (Build Output API v3),
 * y ese archivo es el que Vercel lee para registrar los cron jobs. El adaptador
 * NO conoce los crons, así que lo que esté en vercel.json se pierde: el cron
 * queda definido en el repo pero nunca se registra ni corre. Nos pasó — el
 * recordatorio de turnos estuvo un día entero sin dispararse.
 *
 * Este script corre después de `astro build` (ver el script "build" del
 * package.json) y arrastra los crons al output. vercel.json sigue siendo el
 * único lugar donde editarlos.
 */

import { readFile, writeFile } from 'node:fs/promises';

const CONFIG = '.vercel/output/config.json';

const vercelJson = JSON.parse(await readFile('vercel.json', 'utf8'));
const crons = vercelJson.crons;

if (!Array.isArray(crons) || crons.length === 0) {
  console.log('crons: no hay ninguno definido en vercel.json, no hay nada que copiar.');
  process.exit(0);
}

let config;
try {
  config = JSON.parse(await readFile(CONFIG, 'utf8'));
} catch (e) {
  // Falla ruidosamente a propósito: si no podemos escribir los crons, el deploy
  // saldría con el recordatorio apagado y en silencio, que es justo el bug que
  // este script existe para evitar.
  console.error(`crons: no se pudo leer ${CONFIG} — ¿corrió el adaptador de Vercel?`);
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

config.crons = crons;
await writeFile(CONFIG, JSON.stringify(config, null, 2));
console.log(
  `crons: ${crons.length} registrado(s) en ${CONFIG} → ` +
    crons.map((c) => `${c.path} (${c.schedule})`).join(', ')
);
