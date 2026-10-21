// Lectura de una respuesta del formulario de car sitting ("Carsitters datos"), sin red: de los
// namedValues que manda el Apps Script de la planilla de respuestas a la fila de
// carsitting_datos. index.ts la guarda; campos_test.ts la prueba con respuestas inventadas.
//
// Cada columna acepta varios títulos de pregunta: se comparan sin tildes, mayúsculas ni
// espacios de más, así un cambio chico en el formulario no hace perder el dato.
// 21/10/2026: celular y mail, para que la base la una sola con la niñera (vincular_carsitting).
// El mail lo agrega Google solo si el formulario recopila correos ("Dirección de correo
// electrónico"); el celular, si se agrega la pregunta "Celular".
export const CAMPOS: { key: string; headers: string[] }[] = [
  { key: "nombre_completo", headers: ["Nombre completo"] },
  { key: "telefono", headers: ["Celular", "Celular (WhatsApp)", "Teléfono", "Teléfono celular", "Número de celular"] },
  { key: "mail", headers: ["Dirección de correo electrónico", "Correo electrónico", "Email Address", "Email", "Mail"] },
  { key: "cedula", headers: ["Cédula de Identidad"] },
  { key: "modelo_auto", headers: ["Modelo de auto"] },
  { key: "padron", headers: ["Padrón"] },
  { key: "compania_seguro", headers: ["Compañía de seguro"] },
  { key: "tipo_seguro", headers: ["Tipo de seguro (frente a terceros...)", "Tipo de seguro (frente a terceros…)"] },
  { key: "cantidad_asientos", headers: ["Cantidad de asientos"] },
  { key: "cantidad_cinturones", headers: ["Cantidad de cinturones"] },
  { key: "anio_fabricacion", headers: ["Año de fabricación"] },
  { key: "color_auto", headers: ["Color del auto"] },
  { key: "matricula", headers: ["Matrícula"] },
  { key: "numero_licencia", headers: ["Número de licencia de conducir"] },
  { key: "anio_licencia", headers: ["Año de obtenida la licencia de conducir"] },
  { key: "libreta_propiedad", headers: ["Libreta de propiedad (Número)"] },
  { key: "foto_licencia_url", headers: ["Subir foto licencia de conducir ambos lados"] },
  { key: "foto_libreta_url", headers: ["Subir foto libreta de propiedad ambos lados"] },
  { key: "foto_asientos_url", headers: ["Foto de los asientos de atrás del auto"] },
];

// Ningún dato del formulario necesita más que esto; lo que venga más largo se corta.
const MAX_VALOR = 1000;

export function normaliza(s: string): string {
  return (s || "").toString().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toLowerCase();
}

export type Lectura =
  | { ok: true; registro: Record<string, string> }
  | { ok: false; error: string; headersRecibidos: string[] };

export function leerRespuesta(namedValues: unknown): Lectura {
  const filas = namedValues && typeof namedValues === "object" ? namedValues as Record<string, unknown> : {};
  const porNormalizado: Record<string, string> = {};
  for (const [header, valor] of Object.entries(filas)) {
    const v = Array.isArray(valor) ? valor[0] : valor;
    if (v != null && String(v).trim()) porNormalizado[normaliza(header)] = String(v).trim().slice(0, MAX_VALOR);
  }
  const registro: Record<string, string> = {};
  for (const campo of CAMPOS) {
    for (const h of campo.headers) {
      const v = porNormalizado[normaliza(h)];
      if (v) { registro[campo.key] = v; break; }
    }
  }
  if (!registro.nombre_completo) {
    return { ok: false, error: "No se encontro respuesta de nombre completo", headersRecibidos: Object.keys(filas) };
  }
  // ninera_nombre: lo que escribió ella (la ficha puede decir otra cosa); la niñera la pone la base.
  registro.ninera_nombre = registro.nombre_completo;
  return { ok: true, registro };
}
