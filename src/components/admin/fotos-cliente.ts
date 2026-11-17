/**
 * Lista de "Mis fotos" compartida por las pestañas del panel (Fotos, Novedades
 * y Newsletter): se pide una vez a /api/admin/fotos y, cuando Ceci sube, renombra
 * o borra una, la pestaña Fotos avisa con el evento `cg:fotos` para que los
 * selectores de las otras pestañas se actualicen sin recargar.
 */
export type FotoSubida = { id: string; etiqueta: string; ref: string; miniatura: string };

let pedido: Promise<FotoSubida[]> | null = null;

/** Las fotos subidas. Rechaza si no se pudieron leer (quien llama decide qué hacer). */
export function fotosSubidas(): Promise<FotoSubida[]> {
  if (!pedido) {
    pedido = fetch('/api/admin/fotos')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw new Error(d.error || 'No se pudieron leer tus fotos.');
        return d.fotos as FotoSubida[];
      })
      .catch((e) => {
        pedido = null;
        throw e;
      });
  }
  return pedido;
}

export function avisarCambioFotos(fotos: FotoSubida[]) {
  pedido = Promise.resolve(fotos);
  window.dispatchEvent(new CustomEvent('cg:fotos', { detail: fotos }));
}

export function alCambiarFotos(cb: (fotos: FotoSubida[]) => void) {
  window.addEventListener('cg:fotos', (ev) => cb((ev as CustomEvent).detail));
}

/** Lleva a la pestaña Fotos (para el botón "Subir una foto tuya" de los selectores). */
export function irAFotos() {
  const tab = document.querySelector<HTMLButtonElement>('.tab[data-ir="fotos"]');
  tab?.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
