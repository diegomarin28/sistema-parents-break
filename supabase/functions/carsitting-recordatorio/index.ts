import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// DESACTIVADA A PROPÓSITO el 13/09/2026 — Diego reportó que los mails automáticos de
// carsitting que manda el Apps Script (recordatorio_carsitting.gs, en la cuenta de Gmail
// de Pau) salían mal ("malísimos") varios días seguidos. Esta función es la que el Apps
// Script consulta cada día para saber a quién mandarle — mientras devuelva la lista vacía,
// no tiene a quién mandarle nada, así que los envíos quedan frenados en el origen.
// El código real (que sí arma la lista de pendientes) queda comentado más abajo para
// reactivarlo tal cual cuando se arregle el texto del mail en el Apps Script.

Deno.serve(async (req: Request) => {
  return new Response(
    JSON.stringify({ pendientes: [], deshabilitado: true, motivo: "Pausado a pedido de Diego el 13/09/2026 por mails con problemas de contenido" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

/* ---- Código original, para reactivar cuando corresponda ----
import { createClient } from "jsr:@supabase/supabase-js@2";

const DIAS_ENTRE_RECORDATORIOS = 5;

function normaliza(s: string): string {
  return (s || "").toString().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get("x-webhook-secret");
  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (req.method === "POST") {
    let body: any;
    try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "JSON invalido" }), { status: 400 }); }
    const items: { tipo: string; id: string }[] = body.items || [];
    const ahora = new Date().toISOString();
    for (const it of items) {
      const tabla = it.tipo === "ninera" ? "ninieras" : "candidatas";
      await supabase.from(tabla).update({ carsitting_mail_enviado_at: ahora }).eq("id", it.id);
    }
    return new Response(JSON.stringify({ ok: true, marcados: items.length }), { status: 200 });
  }

  if (req.method === "GET") {
    const [{ data: nins }, { data: cands }, { data: cd }] = await Promise.all([
      supabase.from("ninieras").select("id,nombre,carsitting_mail_enviado_at").in("tipo", ["Traslados", "Ambas"]),
      supabase.from("candidatas").select("id,nombre,apellido,mail,carsitting_mail_enviado_at").in("tipo", ["Traslados", "Ambas"]),
      supabase.from("carsitting_datos").select("ninera_nombre"),
    ]);
    const yaTiene = new Set((cd || []).map((r: any) => normaliza(r.ninera_nombre || "")));
    const limite = Date.now() - DIAS_ENTRE_RECORDATORIOS * 24 * 60 * 60 * 1000;
    const listoParaMandar = (enviado: string | null) => !enviado || new Date(enviado).getTime() < limite;

    const pendientes: any[] = [];
    for (const n of nins || []) {
      if (yaTiene.has(normaliza(n.nombre)) || !listoParaMandar(n.carsitting_mail_enviado_at)) continue;
      pendientes.push({ tipo: "ninera", id: n.id, nombre: n.nombre, mail: null });
    }
    for (const c of cands || []) {
      const nombreCompleto = `${c.nombre} ${c.apellido || ""}`.trim();
      if (yaTiene.has(normaliza(nombreCompleto)) || !listoParaMandar(c.carsitting_mail_enviado_at)) continue;
      if (!c.mail) continue;
      pendientes.push({ tipo: "candidata", id: c.id, nombre: nombreCompleto, mail: c.mail });
    }
    return new Response(JSON.stringify({ pendientes }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
});
*/
