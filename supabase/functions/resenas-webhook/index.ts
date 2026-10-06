import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HEADER_NINERA = "Nombre de  babysitter:";
const HEADER_PRESENTACION = "Presentación y aspecto:";
const HEADER_PUNTUALIDAD = "Puntualidad:";
const HEADER_TRATO = "Trato con los niños:";
const HEADER_CONFORMIDAD = "Conformidad:";
const HEADER_PUNTUACION = "Puntuación total del 1 al 5: (siendo 1 el peor y 5 el mejor)";

// Compara el secreto sin cortar en el primer carácter distinto: así el tiempo de respuesta
// no da pistas de cuántos caracteres acertó quien prueba claves (06/10/2026).
function mismoSecreto(recibido: string | null, esperado: string | undefined): boolean {
  if (!esperado || !recibido) return false;
  const a = new TextEncoder().encode(recibido), b = new TextEncoder().encode(esperado);
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

// "Hoy" en Montevideo: toISOString() es UTC y de 21:00 a 24:00 ya da mañana (06/10/2026).
function hoyMontevideo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normaliza(s: string): string {
  return (s || "").toString().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  if (!mismoSecreto(req.headers.get("x-webhook-secret"), Deno.env.get("WEBHOOK_SECRET"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Tope de tamaño (el formulario manda solo texto): un pedido gigante no llega a procesarse.
  const texto = await req.text();
  if (texto.length > 1 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "Pedido demasiado grande" }), { status: 413 });
  }
  let body: any;
  try {
    body = JSON.parse(texto);
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
  // (sin forzar coincidencias ambiguas tipo apodos o nombres sueltos). Los comodines de
  // ilike (% y _) se escapan: un nombre con "%" no tiene que matchear a cualquiera. Con dos
  // niñeras del mismo nombre no se vincula a ninguna (antes maybeSingle daba error y se
  // perdía el vínculo igual, sin avisar).
  let ninera_id: string | null = null;
  const literal = ninera_nombre.replace(/[\\%_]/g, (c) => "\\" + c);
  const { data: matches } = await supabase
    .from("ninieras")
    .select("id, nombre")
    .ilike("nombre", literal)
    .limit(2);
  if (matches && matches.length === 1) ninera_id = matches[0].id;

  const resena = {
    ninera_nombre,
    ninera_id,
    presentacion: porNormalizado[normaliza(HEADER_PRESENTACION)] || null,
    puntualidad: porNormalizado[normaliza(HEADER_PUNTUALIDAD)] || null,
    trato_ninos: porNormalizado[normaliza(HEADER_TRATO)] || null,
    conformidad: porNormalizado[normaliza(HEADER_CONFORMIDAD)] || null,
    puntuacion,
    fecha: hoyMontevideo(),
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
