import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Mapeo pregunta del form "Carsitters datos" -> columna de carsitting_datos
const CAMPOS: { key: string; headers: string[] }[] = [
  { key: "nombre_completo", headers: ["Nombre completo"] },
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

function normaliza(s: string): string {
  return (s || "").toString().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const secret = req.headers.get("x-webhook-secret");
  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400 });
  }

  const rowData: Record<string, string[]> = body.namedValues || {};
  const porNormalizado: Record<string, string> = {};
  for (const [header, arr] of Object.entries(rowData)) {
    const val = Array.isArray(arr) ? arr[0] : arr;
    if (val && String(val).trim()) porNormalizado[normaliza(header)] = String(val).trim();
  }

  const registro: Record<string, any> = {};
  for (const campo of CAMPOS) {
    for (const headerEsperado of campo.headers) {
      const val = porNormalizado[normaliza(headerEsperado)];
      if (val) { registro[campo.key] = val; break; }
    }
  }

  if (!registro.nombre_completo) {
    return new Response(
      JSON.stringify({ error: "No se encontro respuesta de nombre completo", headersRecibidos: Object.keys(rowData) }),
      { status: 400 },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Intentamos vincular con una ninera real del equipo por coincidencia de nombre
  // (sin acentos/mayusculas), igual que en resenas-webhook -- no adivinamos apodos.
  registro.ninera_nombre = registro.nombre_completo;
  const nombreNorm = normaliza(registro.nombre_completo);
  const { data: ninieras } = await supabase.from("ninieras").select("id, nombre");
  const match = (ninieras || []).find((n: any) => normaliza(n.nombre) === nombreNorm);
  if (match) registro.ninera_id = match.id;

  const { error } = await supabase.from("carsitting_datos").insert(registro);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, nombre: registro.nombre_completo, vinculada: !!registro.ninera_id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
