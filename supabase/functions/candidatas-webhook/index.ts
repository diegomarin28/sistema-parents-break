import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parsearFechasPunta, parsearFechasPuntaGrilla, textoQuincenas } from "./fechas_punta.ts";
import { zonasNormalizadas } from "./zonas.ts";

const FICHA_CAMPOS: { key: string; headers: string[] }[] = [
  { key: "nombre", headers: ["Nombre y apellido"] },
  { key: "zona", headers: ["Zona donde vives:"] },
  { key: "zona_sitting", headers: [
    "Zonas en las que estarías dispuesta a hacer babysittings (puedes marcar más de uno)",
    "Zona donde estas dispuesta a realizar babysittings:",
  ] },
  { key: "disponibilidad", headers: ["Disponibilidad horaria (definir que días tienes libres y en qué horario)"] },
  { key: "bachillerato", headers: ["Dónde completaste bachillerato?"] },
  { key: "experiencia", headers: ["Experiencia previa cuidando niños: Edad de los niños, cantidad de veces que has realizado babysittings, conexión con la familia"] },
  { key: "universidad", headers: [
    "Estudios universitarios: especificar universidad ",
    "Estudios universitarios: especificar carrera",
  ] },
  { key: "cocina", headers: ["Tienes habilidades para cocinar? 1 siendo nulas, 5 siendo muy buenas"] },
  { key: "idiomas", headers: [
    "Hablas otro idioma?",
    "Tienes algún diploma o certificado de idioma?",
  ] },
  { key: "licencia", headers: ["Tienes licencia de conducir?"] },
  { key: "mail", headers: ["Déjanos tu mail:"] },
  { key: "telefono", headers: ["Déjanos un teléfono:"] },
  { key: "cambia_panales", headers: ["Cambias pañales?"] },
  { key: "dispone_traslados", headers: ["Estás dispuesta a realizar traslados?"] },
  { key: "disponible_tipo", headers: ["Estás disponible para realizar babysittings or carsittings?"] },
  { key: "fechas_punta", headers: ["En qué fechas te encuentras en Punta del Este?"] },
  { key: "trabaja_actualmente", headers: ["Trabajas actualmente?"] },
  { key: "capacitacion_extra", headers: [
    "Tienes algún certificado o experiencia en animación con niños? Campamentos, fiestas infantiles, etc",
    "Cursos",
  ] },
  { key: "primeros_auxilios", headers: ["Tienes alguna certificación en primeros auxilios, RCP, o algún curso de salud relacionado a la infancia?"] },
  { key: "comentarios", headers: ["Comentarios"] },
];
// Cuenta bancaria: el formulario la pide en 3 preguntas separadas. Se combinan en un solo
// string, mismo formato "Banco Número (Sucursal X)" que arma la app a mano.
const HEADER_BANCO = "Déjanos el nombre de tu banco de preferencia";
const HEADER_SUCURSAL = "Dejanos la sucursal, si es necesario";
const HEADER_NUMERO_CUENTA = "Dejanos el numero de tu cuenta bancaria para recibir tus ingresos";
// Fecha de nacimiento: la pregunta del form se llama asi, pero durante mucho tiempo la
// respuesta era solo la edad en numero ("19"). Ahora se les pide la fecha real -- si la
// respuesta es una fecha (con /, - o . como separador, o en formato ISO aaaa-mm-dd), va
// directo a fecha_nacimiento (la edad se calcula sola de ahi en mas). Si todavia viene como
// numero de edad, se guarda en el campo de texto viejo (candidata.edad) como respaldo, igual
// que antes. Antes solo se reconocia EXACTAMENTE dd/mm/aaaa con barra -- si alguien la
// escribia con guion o punto, se perdia como fecha y quedaba mal guardada como texto en
// "edad" (bug real encontrado el 17/09, corregido a mano en 7 candidatas viejas).
const HEADER_FECHA_NAC = "Fecha de nacimiento";
const HEADER_FOTO = "Adjunta una imagen de tu cara en fondo blanco estilo CV";
const HEADER_AUTORIZA = "Autorizo el uso de mi foto y datos para el proceso de selección";
// Temporada en Punta del Este (29/09/2026): la respuesta se traduce a quincenas del año
// (candidatas.temporada_quincenas) para que al contratarla ya quede su temporada cargada.
// Funciona tanto con la pregunta de hoy (opcion multiple / texto) como si se cambia a
// cuadricula de casillas (una fila por mes: "... [Enero]", columnas "1 al 15" / "16 a fin de mes").
const HEADER_FECHAS_PUNTA = "En qué fechas te encuentras en Punta del Este?";

function normaliza(s: string): string {
  return (s || "").toString().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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

// Foto de la candidata: solo imágenes, con la extensión que corresponde (antes la extensión
// salía de lo que dijera el pedido).
const FOTO_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

function esSi(raw: string): boolean {
  return normaliza(raw || "").startsWith("si");
}

// Convierte una respuesta de "Fecha de nacimiento" en fecha_nacimiento (ISO) si es una
// fecha real (dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, o aaaa-mm-dd), o en edad ("19 años")
// si todavia viene como el numero de edad de antes.
function parsearFechaNacOEdad(raw: string): { fecha_nacimiento?: string; edad?: string } {
  const v = (raw || "").trim();
  if (!v) return {};

  let m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const diaN = Number(dd), mesN = Number(mm);
    if (diaN >= 1 && diaN <= 31 && mesN >= 1 && mesN <= 12) {
      return { fecha_nacimiento: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` };
    }
  }

  m = v.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    const diaN = Number(dd), mesN = Number(mm);
    if (diaN >= 1 && diaN <= 31 && mesN >= 1 && mesN <= 12) {
      return { fecha_nacimiento: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` };
    }
  }

  const mEdad = v.match(/^(\d{1,2})\b/);
  if (mEdad) return { edad: `${mEdad[1]} años` };
  return {};
}

// A partir de "Estas disponible para realizar babysittings or carsittings?",
// "Estas dispuesta a realizar traslados?" y "Tienes licencia de conducir?"
// inferimos el campo tipo (Ninera / Traslados / Ambas) que usa el resto de
// la app para filtrar. IMPORTANTE (ajustado 02/09): marcar Traslados o Ambas
// requiere ADEMAS tener licencia de conducir -- decir que esta dispuesta a
// traslados sin tener licencia no alcanza, no podria hacerlos en la practica.
function inferirTipo(disponibleTipoRaw: string, disponeTrasladosRaw: string, licenciaRaw: string): string {
  const t = normaliza(disponibleTipoRaw || "");
  const tieneNinera = t.includes("babysitting");
  const dijoTraslado = t.includes("carsitting") || esSi(disponeTrasladosRaw);
  const tieneLicencia = esSi(licenciaRaw);
  const tieneTraslado = dijoTraslado && tieneLicencia;
  if (tieneNinera && tieneTraslado) return "Ambas";
  if (tieneTraslado && !tieneNinera) return "Traslados";
  return "Niñera";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  if (!mismoSecreto(req.headers.get("x-webhook-secret"), Deno.env.get("WEBHOOK_SECRET"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Tope de tamaño (la foto viene en base64 y una foto de celular pesa unos 5 MB): un pedido gigante no llega a procesarse.
  const texto = await req.text();
  if (texto.length > 20 * 1024 * 1024) {
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

  const candidata: Record<string, any> = { estado: "intake", origen: "Form (auto)" };
  for (const campo of FICHA_CAMPOS) {
    const normalizadosVistos = new Set<string>();
    for (const headerEsperado of campo.headers) {
      const hn = normaliza(headerEsperado);
      if (normalizadosVistos.has(hn)) continue;
      normalizadosVistos.add(hn);
      const val = porNormalizado[hn];
      if (val) {
        candidata[campo.key] = candidata[campo.key] ? candidata[campo.key] + " / " + val : val;
      }
    }
  }

  if (candidata.cocina && /^\d+$/.test(String(candidata.cocina).trim())) {
    candidata.cocina = `${String(candidata.cocina).trim()}/5`;
  }

  // Temporada en Punta del Este -> quincenas. null = no se pudo leer (se le pregunta despues).
  // Para la version cuadricula se miran TODAS las filas, tambien las vacias: si llego la
  // pregunta y no marco ninguna quincena, es que no va (se lee como "No veraneo").
  const todosLosHeaders: Record<string, string> = {};
  for (const [header, arr] of Object.entries(rowData)) {
    const val = Array.isArray(arr) ? arr[0] : arr;
    todosLosHeaders[normaliza(header)] = String(val ?? "").trim();
  }
  const deGrilla = parsearFechasPuntaGrilla(todosLosHeaders, normaliza(HEADER_FECHAS_PUNTA));
  if (deGrilla !== null) {
    candidata.temporada_quincenas = deGrilla;
    if (!candidata.fechas_punta) candidata.fechas_punta = textoQuincenas(deGrilla);
  } else if (candidata.fechas_punta) {
    const qs = parsearFechasPunta(candidata.fechas_punta);
    if (qs !== null) candidata.temporada_quincenas = qs;
  }

  const banco = porNormalizado[normaliza(HEADER_BANCO)];
  const numeroCuenta = porNormalizado[normaliza(HEADER_NUMERO_CUENTA)];
  const sucursal = porNormalizado[normaliza(HEADER_SUCURSAL)];
  if (banco && numeroCuenta) {
    candidata.cuenta_bancaria = `${banco} ${numeroCuenta}` + (sucursal ? ` (Sucursal ${sucursal})` : "");
  }

  const fechaNacRaw = porNormalizado[normaliza(HEADER_FECHA_NAC)];
  Object.assign(candidata, parsearFechaNacOEdad(fechaNacRaw));

  candidata.tipo = inferirTipo(candidata.disponible_tipo, candidata.dispone_traslados, candidata.licencia);

  const autorizaRaw = porNormalizado[normaliza(HEADER_AUTORIZA)];
  const autorizaNorm = normaliza(autorizaRaw || "");
  let autoriza: boolean;
  if (!autorizaNorm) {
    autoriza = false;
  } else if (autorizaNorm.includes("no autorizo") || autorizaNorm.startsWith("no")) {
    autoriza = false;
  } else {
    autoriza = true;
  }
  candidata.autoriza_foto = autoriza;

  if (!candidata.nombre) {
    return new Response(
      JSON.stringify({ error: "No se encontro respuesta de nombre", headersRecibidos: Object.keys(rowData) }),
      { status: 400 },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Zonas (30/09/2026): todo el sistema trabaja por zona. Lo que marca o escribe como barrio
  // se guarda ya traducido ("Olivos, San Nicolás" -> "Carrasco"). Si fallara la lectura de
  // las zonas, se guarda el texto original tal cual (no se pierde nada).
  try {
    const { data: zonasDef, error: zErr } = await supabase.from("zona_grupos").select("id,nombre,zonas,orden");
    if (!zErr && zonasDef && zonasDef.length) {
      for (const campo of ["zona", "zona_sitting"]) {
        if (!candidata[campo]) continue;
        // El barrio exacto que marcó se guarda aparte (zona_barrios / zona_sitting_barrios):
        // todo se busca por zona, pero en la ficha se ve el detalle ("Carrasco (Olivos)").
        const barrios = String(candidata[campo]).split(/[/,]/).map((x) => x.trim().replace(/\.+$/, "")).filter(Boolean);
        if (barrios.length) candidata[campo + "_barrios"] = [...new Map(barrios.map((b) => [b.toLowerCase(), b])).values()].join("/");
        const traducidas = zonasNormalizadas(candidata[campo], zonasDef);
        if (traducidas.length) candidata[campo] = traducidas.join("/");
      }
    }
  } catch (e) {
    console.log("ZONAS no se pudieron traducir: " + String(e));
  }

  const fotoMime = String(body.foto_mime || "image/jpeg").toLowerCase();
  if (body.foto_base64 && candidata.autoriza_foto === true && !FOTO_EXT[fotoMime]) {
    console.log("FOTO descartada: no es una imagen (" + fotoMime.slice(0, 40) + ")");
  } else if (body.foto_base64 && candidata.autoriza_foto === true) {
    try {
      const bytes = Uint8Array.from(atob(body.foto_base64), (c) => c.charCodeAt(0));
      const ext = FOTO_EXT[fotoMime];
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("candidatas-fotos")
        .upload(path, bytes, { contentType: fotoMime, upsert: false });
      if (upErr) {
        console.log("FOTO error de upload: " + upErr.message);
      } else {
        const { data: pub } = supabase.storage.from("candidatas-fotos").getPublicUrl(path);
        candidata.foto_url = pub.publicUrl;
      }
    } catch (e) {
      console.log("FOTO excepcion: " + String(e));
    }
  } else if (body.foto_error) {
    console.log("FOTO no se pudo traer desde Apps Script: " + body.foto_error);
  }

  const { error } = await supabase.from("candidatas").insert(candidata);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, nombre: candidata.nombre, tipo: candidata.tipo, autoriza: candidata.autoriza_foto, foto: !!candidata.foto_url, temporada: candidata.temporada_quincenas ?? null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
