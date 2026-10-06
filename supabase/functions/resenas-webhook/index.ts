import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HEADER_NINERA = "Nombre de  babysitter:";
const HEADER_PRESENTACION = "Presentación y aspecto:";
const HEADER_PUNTUALIDAD = "Puntualidad:";
const HEADER_TRATO = "Trato con los niños:";
const HEADER_CONFORMIDAD = "Conformidad:";
const HEADER_PUNTUACION = "Puntuación total del 1 al 5: (siendo 1 el peor y 5 el mejor)";

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

  const ninera_nombre = porNormalizado[normaliza(HEADER_NINERA)];
  if (!ninera_nombre) {
    return new Response(JSON.stringify({ error: "No se encontro el nombre de la ninera en la resena" }), { status: 400 });
  }

  const puntuacionRaw = porNormalizado[normaliza(HEADER_PUNTUACION)];
  const puntuacion = puntuacionRaw ? parseInt(puntuacionRaw, 10) : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Intentamos vincular con una ninera real del equipo por nombre exacto
  // (sin forzar coincidencias ambiguas tipo apodos o nombres sueltos).
  let ninera_id: string | null = null;
  const { data: match } = await supabase
    .from("ninieras")
    .select("id, nombre")
    .ilike("nombre", ninera_nombre)
    .maybeSingle();
  if (match) ninera_id = match.id;

  const resena = {
    ninera_nombre,
    ninera_id,
    presentacion: porNormalizado[normaliza(HEADER_PRESENTACION)] || null,
    puntualidad: porNormalizado[normaliza(HEADER_PUNTUALIDAD)] || null,
    trato_ninos: porNormalizado[normaliza(HEADER_TRATO)] || null,
    conformidad: porNormalizado[normaliza(HEADER_CONFORMIDAD)] || null,
    puntuacion,
    fecha: new Date().toISOString().slice(0, 10),
    origen: "Form (auto)",
  };

  const { error } = await supabase.from("resenas_ninieras").insert(resena);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, ninera_nombre, vinculada: !!ninera_id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
