import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Webhook de WhatsApp Cloud API (Coexistence) para Parents Break.
//
// GET  -> handshake de verificacion que pide Meta al configurar el webhook
//         (Configurar Webhooks en developers.facebook.com).
// POST -> eventos reales (mensajes entrantes, cambios de estado). Por ahora
//         solo los guardamos crudos en whatsapp_eventos_raw para poder
//         revisarlos; la logica de negocio (identificar familia/ninera,
//         actualizar solicitud_ninieras, etc.) se suma en un paso siguiente.
//
// Firma (06/10/2026, S5): Meta firma cada POST con el "App Secret" de la app
// (X-Hub-Signature-256 = sha256=HMAC del cuerpo). Sin esa firma, cualquiera podía meter filas
// en whatsapp_eventos_raw. Ahora se rechaza todo POST sin firma válida; si el secreto
// WHATSAPP_APP_SECRET no está cargado en las Edge Functions, se rechaza todo (hoy la tabla
// está vacía: Meta no está mandando nada). Tampoco se escribe el contenido en el log: trae
// teléfonos y mensajes.

async function firmaValida(cuerpo: string, firma: string | null, secreto: string | undefined): Promise<boolean> {
  if (!secreto || !firma || !firma.startsWith("sha256=")) return false;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(cuerpo)));
  const esperada = "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (esperada.length !== firma.length) return false;
  let dif = 0;
  for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
  return dif === 0;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expected = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && expected && token === expected) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const cuerpo = await req.text();
  if (cuerpo.length > 1024 * 1024) {
    return new Response(JSON.stringify({ error: "Pedido demasiado grande" }), { status: 413 });
  }
  if (!(await firmaValida(cuerpo, req.headers.get("x-hub-signature-256"), Deno.env.get("WHATSAPP_APP_SECRET")))) {
    console.log("WHATSAPP WEBHOOK rechazado: firma ausente o inválida");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(cuerpo);
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400 });
  }

  console.log("WHATSAPP WEBHOOK evento recibido (" + cuerpo.length + " bytes)");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.from("whatsapp_eventos_raw").insert({ payload: body });
    if (error) {
      console.log("WHATSAPP WEBHOOK error guardando raw: " + error.message);
    }
  } catch (e) {
    console.log("WHATSAPP WEBHOOK excepcion guardando raw: " + String(e));
  }

  // Meta espera un 200 rapido pase lo que pase con el procesamiento.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
