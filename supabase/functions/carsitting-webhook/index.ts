import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { leerRespuesta } from "./campos.ts";

// Recibe cada respuesta del formulario de car sitting ("Carsitters datos") desde el Apps Script
// de la planilla de respuestas (onFormSubmit, con e.namedValues) y la guarda en carsitting_datos.
// Pide x-webhook-secret (WEBHOOK_SECRET) desde el 06/10/2026: un Apps Script que no lo mande
// recibe 401 y la respuesta no llega. Qué pregunta va a qué columna: campos.ts.
// v6 (21/10/2026): guarda celular y mail, y la unión con la niñera la hace la base. Se publica
// DESPUÉS de la migración 20261021_carsitting_union (sin las columnas nuevas, el insert falla).

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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  if (!mismoSecreto(req.headers.get("x-webhook-secret"), Deno.env.get("WEBHOOK_SECRET"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Tope de tamaño (el formulario manda solo texto y links): un pedido gigante no llega a procesarse.
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

  const lectura = leerRespuesta(body?.namedValues);
  if (!lectura.ok) {
    return new Response(JSON.stringify({ error: lectura.error, headersRecibidos: lectura.headersRecibidos }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // La niñera la pone la base al insertar (vincular_carsitting, 21/10/2026): por celular, mail o
  // nombre. Lo que no se pudo unir queda "Sin identificar" en Niñeras > Car sitting.
  const { data, error } = await supabase.from("carsitting_datos").insert(lectura.registro).select("ninera_id").single();
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, nombre: lectura.registro.nombre_completo, vinculada: !!data?.ninera_id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
