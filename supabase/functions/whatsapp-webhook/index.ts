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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400 });
  }

  console.log("WHATSAPP WEBHOOK payload: " + JSON.stringify(body));

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
