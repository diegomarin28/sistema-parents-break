// Traduce la respuesta del formulario de postulantes sobre las fechas en Punta del Este
// a quincenas del año (0 = 1-15 de enero, 1 = 16-31 de enero, ... 23 = 16-31 de diciembre).
// Devuelve:
//   number[]  -> quincenas en que está afuera ([] = no va nunca, 0..23 = todo el año)
//   null      -> la respuesta no alcanza para saberlo ("a definir", "fines de semana"...)
// Acepta tanto el texto libre / opción múltiple de hoy como la versión en cuadrícula
// (una fila por mes, columnas "1 al 15" / "16 a fin de mes"), por si se cambia la pregunta.
const MESES_TEMP: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7,
  setiembre: 8, septiembre: 8, set: 8, octubre: 9, noviembre: 10, diciembre: 11,
};
const RE_MES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|set|octubre|noviembre|diciembre)";

function normTemp(s: string): string {
  return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function parsearFechasPunta(textoRaw: string): number[] | null {
  const t = normTemp(textoRaw);
  if (!t) return null;
  const todas = Array.from({ length: 24 }, (_, i) => i);
  // Respuestas que no se pueden traducir a fechas concretas: mejor preguntar que adivinar.
  if (/fin(es)? de semana|finde|a definir|no se\b|no lo se|inexact|depende|todavia no|capaz|quizas|a confirmar|no estoy segura/.test(t)) return null;
  if (/no veraneo|no voy|no estoy en punta|nunca|^no\b|no viajo/.test(t)) return [];
  if (/todo el ano|vivo (en )?(punta|maldonado|la barra|jose ignacio|pde|alla|aca)|resido en|siempre estoy|todo el tiempo|permanente/.test(t)) return todas;

  const qs = new Set<number>();
  let resto = t;
  const quincena = (m: number, cual: "1" | "2" | "ambas") => {
    if (cual !== "2") qs.add(m * 2);
    if (cual !== "1") qs.add(m * 2 + 1);
  };
  const cualPorDia = (dia: number | null, esInicio: boolean): "1" | "2" | "ambas" => {
    if (dia === null) return "ambas";
    if (esInicio) return dia > 15 ? "2" : "ambas";
    return dia <= 15 ? "1" : "ambas";
  };

  // 1) "primera/segunda quincena de enero"
  resto = resto.replace(new RegExp(`(primer[ao]?|1r?a|1era|1ª|1°|segunda|2da|2ª|2°) quincena (?:de |del mes de )?${RE_MES}`, "g"), (_m, cual, mes) => {
    quincena(MESES_TEMP[mes], /^(primer|1)/.test(cual) ? "1" : "2");
    return " ";
  });
  // 2) rangos: "desde noviembre a marzo", "del 15 de diciembre al 28 de febrero"
  resto = resto.replace(new RegExp(`(?:(\\d{1,2}) de )?${RE_MES} (?:a|al|hasta|hasta el|-) (?:(?:fines de|principios de|mediados de) )?(?:(\\d{1,2}) de )?${RE_MES}`, "g"), (_m, d1, m1, d2, m2) => {
    const a = MESES_TEMP[m1], b = MESES_TEMP[m2];
    const n = ((b - a + 12) % 12) + 1;
    for (let i = 0; i < n; i++) {
      const mes = (a + i) % 12;
      if (i === 0 && n === 1) { quincena(mes, "ambas"); continue; }
      if (i === 0) quincena(mes, cualPorDia(d1 ? Number(d1) : null, true));
      else if (i === n - 1) quincena(mes, cualPorDia(d2 ? Number(d2) : null, false));
      else quincena(mes, "ambas");
    }
    return " ";
  });
  // 3) meses sueltos ("todo enero y febrero", "febrero") -> mes completo
  resto.replace(new RegExp(`\\b${RE_MES}\\b`, "g"), (_m, mes) => { quincena(MESES_TEMP[mes], "ambas"); return " "; });

  if (qs.size) return [...qs].sort((a, b) => a - b);
  // "en verano", "temporada" sin fechas: no alcanza para saber cuándo
  return null;
}

// Versión cuadrícula del formulario: headers tipo "En qué fechas te encuentras en Punta del Este? [Enero]"
// con respuestas "1 al 15", "16 a fin de mes" (o ambas, separadas por coma).
export function parsearFechasPuntaGrilla(porHeaderNormalizado: Record<string, string>, baseNormalizada: string): number[] | null {
  const qs = new Set<number>();
  let vistas = 0;
  for (const [h, val] of Object.entries(porHeaderNormalizado)) {
    if (!h.startsWith(baseNormalizada)) continue;
    const m = h.match(/\[([^\]]+)\]\s*$/);
    if (!m) continue;
    const mes = MESES_TEMP[normTemp(m[1])];
    if (mes === undefined) continue;
    vistas++;
    const v = normTemp(val);
    if (/todo|complet|ambas/.test(v)) { qs.add(mes * 2); qs.add(mes * 2 + 1); continue; }
    if (/(^|\D)1(\D|$)|primer|1ra|1 al 15/.test(v)) qs.add(mes * 2);
    if (/16|segund|2da|fin de mes/.test(v)) qs.add(mes * 2 + 1);
  }
  if (!vistas) return null;
  return [...qs].sort((a, b) => a - b);
}

const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
// Texto legible para guardar en candidatas.fechas_punta cuando la respuesta vino de la cuadrícula.
export function textoQuincenas(qsArr: number[]): string {
  const set = new Set(qsArr);
  if (!set.size) return "No veraneo en Punta del Este";
  if (set.size === 24) return "Todo el año";
  const partes: string[] = [];
  let m = 0;
  while (m < 12) {
    if (set.has(m * 2) && set.has(m * 2 + 1)) {
      let fin = m;
      while (fin + 1 < 12 && set.has((fin + 1) * 2) && set.has((fin + 1) * 2 + 1)) fin++;
      partes.push(fin === m ? `todo ${MESES_LARGO[m]}` : `de ${MESES_LARGO[m]} a ${MESES_LARGO[fin]}`);
      m = fin + 1;
    } else {
      if (set.has(m * 2)) partes.push(`1ra quincena de ${MESES_LARGO[m]}`);
      if (set.has(m * 2 + 1)) partes.push(`2da quincena de ${MESES_LARGO[m]}`);
      m++;
    }
  }
  return partes.join(", ");
}
