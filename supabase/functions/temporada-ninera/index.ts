// Página pública temporada.html: cada niñera marca en qué quincenas del año está en las
// zonas de afuera de Montevideo/Canelones (Punta del Este y alrededores).
// Formas de identificarse (no tienen cuenta en el sistema, por eso verify_jwt=false):
//   ?t=<temporada_token>  link personal (botón "Pedirle por WhatsApp" de la app)
//   tel=<celular>         link general para difusión: se busca por los últimos 8 dígitos del
//                         teléfono cargado en su ficha
//   nombre (POST accion)  si su celular no está cargado: pone nombre y apellido (se tolera
//                         mayúsculas, tildes y una letra mal). Si no tenía celular, se guarda el
//                         que puso. Si tenía otro, NO se muestra entero (solo los últimos 3
//                         números) y el nuevo queda pendiente hasta que Pau o Delfi lo aceptan.
// La temporada que manda se guarda DIRECTO (sin aprobación) y, si marcó alguna quincena y su
// zona no incluye esa zona de afuera, se le agrega -- si no, nunca aparecería al buscarla.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function normaliza(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function zonasDe(z: string | null) {
  return (z || "").split(/[/,]/).map((x) => x.trim()).filter(Boolean);
}
function ultimos8(tel: string | null) {
  const d = (tel || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
}
// ---- Nombre casi exacto ----
function palabras(s: string) {
  return normaliza(s).replace(/[^a-zñ ]+/g, " ").split(/\s+/).filter((w) => w.length >= 2);
}
function distancia(a: string, b: string) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}
function palabraParecida(a: string, b: string) {
  if (a === b) return true;
  const tol = Math.min(a.length, b.length) >= 8 ? 2 : Math.min(a.length, b.length) >= 4 ? 1 : 0;
  return tol > 0 && distancia(a, b) <= tol;
}
// Casi exacto: el primer nombre tiene que coincidir y además al menos un apellido (o segundo
// nombre de 3+ letras). Si escribe un apellido de más ("Rodríguez Pérez") igual entra. También
// se compara todo junto sin espacios, por "De León" / "Deleón".
function coincideNombre(escrito: string, real: string) {
  const e = palabras(escrito), r = palabras(real);
  if (e.length < 2 || !r.length) return false;
  if (palabraParecida(e.join(""), r.join(""))) return true;
  if (!palabraParecida(e[0], r[0])) return false;
  const restoR = r.slice(1), restoRJunto = restoR.join("");
  if (palabraParecida(e.slice(1).join(""), restoRJunto)) return true;
  return e.slice(1).some((w) => w.length >= 3 && restoR.some((x) => x.length >= 3 && palabraParecida(w, x)));
}

// Desempate: el nombre completo coincide palabra por palabra (para las dos "María Belén").
function coincideCompleto(escrito: string, real: string) {
  const e = palabras(escrito), r = palabras(real);
  return e.length === r.length && e.every((w, i) => palabraParecida(w, r[i]));
}

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const CAMPOS = "id,nombre,zona,activa,telefono,temporada,temporada_token";

type Resultado = { n: any; grupos: any[] } | { error: string; status: number };

async function gruposDe(n: any) {
  const { data: grupos } = await sb.from("zona_grupos").select("id,nombre,zonas,fuera_de_montevideo").eq("fuera_de_montevideo", true).order("orden");
  const zonas = zonasDe(n.zona).map(normaliza);
  const suyos = (grupos || []).filter((g: any) => [g.nombre, ...(g.zonas || [])].some((z: string) => zonas.includes(normaliza(z))));
  // Si no tiene ninguna zona de afuera (ej. vive en Pocitos), igual se le preguntan todas:
  // justamente queremos saber si veranea allá.
  return suyos.length ? suyos : (grupos || []);
}

async function cargar(token: string | null, tel: string | null): Promise<Resultado> {
  let n: any = null;
  if (token) {
    if (!UUID_RE.test(token)) return { error: "link_invalido", status: 404 };
    const { data } = await sb.from("ninieras").select(CAMPOS).eq("temporada_token", token).maybeSingle();
    n = data;
    if (!n || n.activa === false) return { error: "link_invalido", status: 404 };
  } else {
    const u8 = ultimos8(tel);
    if (!u8) return { error: "telefono_invalido", status: 400 };
    const { data } = await sb.from("ninieras").select(CAMPOS).eq("activa", true);
    const matches = (data || []).filter((x: any) => ultimos8(x.telefono) === u8);
    if (matches.length !== 1) return { error: matches.length ? "telefono_repetido" : "telefono_no_encontrado", status: 404 };
    n = matches[0];
  }
  return { n, grupos: await gruposDe(n) };
}

function datosPara(n: any, grupos: any[]) {
  const base = n.temporada || {};
  return {
    nombre: (n.nombre || "").split(" ")[0],
    t: n.temporada_token,
    grupos: grupos.map((g: any) => ({ id: g.id, nombre: g.nombre, quincenas: Array.isArray(base[g.id]) ? base[g.id] : [] })),
  };
}

// Entró con nombre porque su celular no está en el sistema.
async function porNombre(body: any, confirmarCambio: boolean) {
  const nombre = typeof body.nombre === "string" ? body.nombre.trim().slice(0, 120) : "";
  const tel = typeof body.tel === "string" ? body.tel.trim().slice(0, 30) : "";
  const u8 = ultimos8(tel);
  if (!u8) return json({ error: "telefono_invalido" }, 400);
  if (palabras(nombre).length < 2) return json({ error: "falta_apellido" }, 400);
  const { data } = await sb.from("ninieras").select(CAMPOS).eq("activa", true);
  const activas = data || [];
  const conEseCel = activas.filter((x: any) => ultimos8(x.telefono) === u8);
  let matches = activas.filter((x: any) => coincideNombre(nombre, x.nombre || ""));
  if (matches.length > 1) {
    const completos = matches.filter((x: any) => coincideCompleto(nombre, x.nombre || ""));
    if (completos.length === 1) matches = completos;
  }
  if (!matches.length) return json({ error: "nombre_no_encontrado" }, 404);
  if (matches.length > 1) return json({ error: "nombre_ambiguo" }, 409);
  const n = matches[0];
  // El celular ya es de OTRA niñera: no se reasigna.
  if (conEseCel.some((x: any) => x.id !== n.id)) return json({ error: "telefono_de_otra" }, 409);
  const grupos = await gruposDe(n);
  if (!ultimos8(n.telefono)) {
    const { error } = await sb.from("ninieras").update({ telefono: tel }).eq("id", n.id);
    if (error) return json({ error: "no_se_pudo_guardar" }, 500);
    return json({ estado: "celular_guardado", ...datosPara(n, grupos) });
  }
  if (ultimos8(n.telefono) === u8) return json({ estado: "ok", ...datosPara(n, grupos) });
  if (!confirmarCambio) {
    return json({ estado: "tiene_otro", nombre: (n.nombre || "").split(" ")[0], termina: ultimos8(n.telefono).slice(-3) });
  }
  const { error } = await sb.from("ninieras").update({ telefono_pendiente: tel, telefono_pendiente_en: new Date().toISOString() }).eq("id", n.id);
  if (error) return json({ error: "no_se_pudo_guardar" }, 500);
  return json({ estado: "cambio_pedido", ...datosPara(n, grupos) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      const r = await cargar(u.searchParams.get("t"), u.searchParams.get("tel"));
      if ("error" in r) return json({ error: r.error }, r.status);
      return json(datosPara(r.n, r.grupos));
    }
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "datos_invalidos" }, 400);
      if (body.accion === "buscar_nombre") return await porNombre(body, false);
      if (body.accion === "confirmar_cambio") return await porNombre(body, true);
      if (typeof body.t !== "string" && typeof body.tel !== "string") return json({ error: "datos_invalidos" }, 400);
      const r = await cargar(typeof body.t === "string" ? body.t : null, typeof body.tel === "string" ? body.tel : null);
      if ("error" in r) return json({ error: r.error }, r.status);
      const temporada: Record<string, number[]> = { ...(r.n.temporada || {}) };
      let zona: string = r.n.zona || "";
      for (const g of r.grupos) {
        const qs = Array.isArray(body.temporada?.[g.id]) ? body.temporada[g.id] : [];
        temporada[g.id] = [...new Set(qs.map(Number).filter((q: number) => Number.isInteger(q) && q >= 0 && q < 24))].sort((a, b) => a - b) as number[];
        const tieneZona = zonasDe(zona).map(normaliza).some((z) => [g.nombre, ...(g.zonas || [])].some((gz: string) => normaliza(gz) === z));
        if (temporada[g.id].length && !tieneZona) zona = [zona.trim(), g.nombre].filter(Boolean).join("/");
      }
      const comentario = typeof body.comentario === "string" ? body.comentario.trim().slice(0, 500) : "";
      const { error } = await sb.from("ninieras").update({
        temporada,
        zona,
        temporada_actualizada_en: new Date().toISOString(),
        temporada_fuente: "ninera",
        temporada_comentario: comentario || null,
        temporada_propuesta: null,
        temporada_propuesta_en: null,
      }).eq("id", r.n.id);
      if (error) return json({ error: "no_se_pudo_guardar" }, 500);
      return json({ ok: true });
    }
    return json({ error: "metodo_no_permitido" }, 405);
  } catch (_e) {
    return json({ error: "error_interno" }, 500);
  }
});
