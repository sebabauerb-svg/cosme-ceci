/**
 * Editor de novedades del panel: lee y escribe los .md de src/content/blog/
 * a través de la API de GitHub. Cada guardado es un commit a `main`, que
 * dispara un deploy en Vercel (1–2 min). Así el blog sigue siendo estático y
 * los .md siguen siendo la única fuente: lo que se sube a mano y lo que se
 * carga desde el panel conviven sin distinción.
 *
 * Variables de entorno:
 *   GITHUB_TOKEN   token fine-grained con "Contents: read and write" solo sobre este repo.
 *   GITHUB_REPO    opcional, "dueño/repo" (por defecto sebabauerb-svg/cosme-ceci).
 *   GITHUB_BRANCH  opcional (por defecto main).
 */

export const TIPOS = ['novedad', 'tip', 'nota'] as const;
export type Tipo = (typeof TIPOS)[number];

export interface Entrada {
  slug: string;
  titulo: string;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  autora: string;
  tipo: Tipo;
  publicado: boolean;
  cuerpo: string;
}

const CARPETA = 'src/content/blog';

export function githubConfigurado(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

const repo = () => process.env.GITHUB_REPO || 'sebabauerb-svg/cosme-ceci';
const rama = () => process.env.GITHUB_BRANCH || 'main';

export class GithubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function gh(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo()}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'cosme-ceci-admin',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const d: any = await res.json().catch(() => ({}));
    throw new GithubError(d?.message || `GitHub respondió ${res.status}`, res.status);
  }
  return res.json();
}

// ---------- Frontmatter ----------
// Parser mínimo para los campos conocidos (los .md los escribimos nosotros o
// siguen la plantilla de PUBLICAR-NOVEDADES.md). No pretende ser YAML completo.

function valorYaml(v: string): string {
  v = v.trim();
  if (v.startsWith('"')) {
    try { return JSON.parse(v); } catch { return v.slice(1, -1); }
  }
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v.replace(/\s+#.*$/, '');
}

export function parsear(slug: string, texto: string): Entrada {
  texto = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const datos: Record<string, string> = {};
  if (m) {
    for (const linea of m[1].split('\n')) {
      const kv = linea.match(/^([a-zA-Z_]+):\s*(.*)$/);
      if (kv) datos[kv[1]] = valorYaml(kv[2]);
    }
  }
  const tipo = (TIPOS as readonly string[]).includes(datos.tipo) ? (datos.tipo as Tipo) : 'nota';
  return {
    slug,
    titulo: datos.titulo || slug,
    descripcion: datos.descripcion || '',
    fecha: /^\d{4}-\d{2}-\d{2}/.test(datos.fecha || '') ? datos.fecha.slice(0, 10) : '',
    autora: datos.autora || 'Ceci',
    tipo,
    publicado: datos.publicado !== 'false',
    cuerpo: (m ? m[2] : texto).replace(/^\s*\n/, '').replace(/\s+$/, ''),
  };
}

export function serializar(e: Entrada): string {
  // JSON.stringify da un string con comillas dobles que también es YAML válido.
  return [
    '---',
    `titulo: ${JSON.stringify(e.titulo)}`,
    `descripcion: ${JSON.stringify(e.descripcion)}`,
    `fecha: ${e.fecha}`,
    `autora: ${JSON.stringify(e.autora)}`,
    `tipo: ${e.tipo}`,
    `publicado: ${e.publicado}`,
    '---',
    '',
    e.cuerpo.replace(/\r\n/g, '\n').trim(),
    '',
  ].join('\n');
}

// ---------- Slugs ----------

export function slugDe(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');
}

export const slugValido = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

// ---------- Lectura / escritura ----------

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const deB64 = (s: string) => Buffer.from(s, 'base64').toString('utf8');

export async function leerEntrada(slug: string): Promise<{ entrada: Entrada; sha: string } | null> {
  const d: any = await gh(`/contents/${CARPETA}/${slug}.md?ref=${rama()}`);
  if (!d || d.type !== 'file') return null;
  return { entrada: parsear(slug, deB64(d.content)), sha: d.sha };
}

export async function listarEntradas(): Promise<(Entrada & { sha: string })[]> {
  const lista: any[] = (await gh(`/contents/${CARPETA}?ref=${rama()}`)) || [];
  const archivos = lista.filter((f) => f.type === 'file' && f.name.endsWith('.md'));
  const entradas = await Promise.all(
    archivos.map(async (f) => {
      const r = await leerEntrada(f.name.replace(/\.md$/, ''));
      return r ? { ...r.entrada, sha: r.sha } : null;
    })
  );
  return entradas
    .filter((e): e is Entrada & { sha: string } => !!e)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Crea (sin sha) o reemplaza (con el sha que se leyó) el archivo de la entrada. */
export async function guardarEntrada(e: Entrada, sha: string | null, mensaje: string): Promise<string> {
  const d: any = await gh(`/contents/${CARPETA}/${e.slug}.md`, {
    method: 'PUT',
    body: JSON.stringify({
      message: mensaje,
      content: b64(serializar(e)),
      branch: rama(),
      ...(sha ? { sha } : {}),
    }),
  });
  return d?.content?.sha;
}
