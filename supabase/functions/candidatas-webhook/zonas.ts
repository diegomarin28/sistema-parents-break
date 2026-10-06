// Traduce lo que la postulante escribe o marca como barrio ("Olivos", "La barra.", "centro y
// pocitos") a las zonas del sistema (tabla zona_grupos), igual que zonasNormalizadas() en
// js/core.js de la app. Lo que no pertenece a ninguna zona se conserva tal cual al final, para
// no perder el dato (en la app aparece como "sin zona" para asignarlo).
export type Zona = { id: string; nombre: string; zonas: string[] | null; orden: number | null };

function clave(s: string): string {
  return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}
function soloPalabras(s: string): string {
  return clave(s).replace(/[^a-z0-9ñ]+/g, " ").trim();
}

export function zonasNormalizadas(texto: string | null | undefined, zonasDef: Zona[]): string[] {
  const lista = [...zonasDef].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const grupoDe = (t: string) => {
    const k = clave(t);
    if (!k) return null;
    return lista.find((g) => clave(g.nombre) === k) || lista.find((g) => (g.zonas || []).some((z) => clave(z) === k)) || null;
  };
  const mencionadas = (t: string) => {
    const txt = " " + soloPalabras(t) + " ";
    return lista.filter((g) => [g.nombre, ...(g.zonas || [])].some((b) => {
      const kb = soloPalabras(b);
      return kb && txt.includes(" " + kb + " ");
    }));
  };
  const conocidas = new Map<string, Zona>();
  const desconocidas = new Map<string, string>();
  for (const p of (texto || "").split(/[/,]/).map((x) => x.trim()).filter(Boolean)) {
    const g = grupoDe(p);
    if (g) { conocidas.set(g.id, g); continue; }
    const m = mencionadas(p);
    if (m.length) { m.forEach((x) => conocidas.set(x.id, x)); continue; }
    const k = clave(p);
    if (k && !desconocidas.has(k)) desconocidas.set(k, p);
  }
  const orden = lista.map((g) => g.id);
  return [
    ...[...conocidas.values()].sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id)).map((g) => g.nombre),
    ...desconocidas.values(),
  ];
}
