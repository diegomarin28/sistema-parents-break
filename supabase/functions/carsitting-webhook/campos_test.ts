// Tests de la lectura del formulario de car sitting (campos.ts), sin red ni base. Respuestas
// inventadas. Se corren desde una carpeta fuera del repo (el package.json de la raíz confunde a
// Deno): npx deno@2 test <carpeta>/carsitting-webhook/
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { leerRespuesta } from "./campos.ts";

// Como llega del Apps Script: e.namedValues, cada pregunta con una lista de respuestas.
const RESPUESTA = {
  "Marca temporal": ["21/10/2026 10:15:00"],
  "Dirección de correo electrónico": ["ana.ficticia@ejemplo.test"],
  "Nombre completo": ["  Ana Ficticia "],
  "Celular": ["098 000 001"],
  "Cédula de Identidad": ["1.234.567-8"],
  "Modelo de auto": ["Auto Inventado 1.0"],
  "Tipo de seguro (frente a terceros…)": ["Total"],
  "Foto de los asientos de atrás del auto": ["https://drive.google.com/open?id=ficticio"],
};

Deno.test("una respuesta completa: cada pregunta en su columna, con celular y mail", () => {
  const r = leerRespuesta(RESPUESTA);
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.registro.nombre_completo, "Ana Ficticia");
  assertEquals(r.registro.ninera_nombre, "Ana Ficticia");
  assertEquals(r.registro.telefono, "098 000 001");
  assertEquals(r.registro.mail, "ana.ficticia@ejemplo.test");
  assertEquals(r.registro.cedula, "1.234.567-8");
  assertEquals(r.registro.tipo_seguro, "Total");
  assertEquals(r.registro.foto_asientos_url, "https://drive.google.com/open?id=ficticio");
  assertEquals("Marca temporal" in r.registro, false);
  assertEquals("ninera_id" in r.registro, false); // la niñera la pone la base
});

Deno.test("los títulos se comparan sin tildes, mayúsculas ni espacios de más", () => {
  const r = leerRespuesta({ "NOMBRE  COMPLETO": ["Bruno"], "telefono celular ": ["099111222"], "Email Address": ["b@ejemplo.test"], "cedula de identidad": ["2"] });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals([r.registro.telefono, r.registro.mail, r.registro.cedula], ["099111222", "b@ejemplo.test", "2"]);
});

Deno.test("sin celular ni mail en el formulario (como hoy) igual se guarda", () => {
  const r = leerRespuesta({ "Nombre completo": ["Carla Ejemplo"], "Modelo de auto": ["X"] });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals("telefono" in r.registro, false);
  assertEquals("mail" in r.registro, false);
});

Deno.test("sin el nombre: no se guarda y dice qué preguntas llegaron", () => {
  const r = leerRespuesta({ "Nombre y apellido": ["Dora"], "Celular": ["098"] });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.headersRecibidos, ["Nombre y apellido", "Celular"]);
});

Deno.test("respuestas vacías, raras o que no son una lista", () => {
  assertEquals(leerRespuesta(undefined).ok, false);
  assertEquals(leerRespuesta("texto").ok, false);
  assertEquals(leerRespuesta({ "Nombre completo": ["   "] }).ok, false);
  const r = leerRespuesta({ "Nombre completo": "Elena", "Celular": [null], "Matrícula": [12345] });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.registro.nombre_completo, "Elena");
  assertEquals("telefono" in r.registro, false);
  assertEquals(r.registro.matricula, "12345");
});

Deno.test("un valor gigante se corta a 1.000 caracteres", () => {
  const r = leerRespuesta({ "Nombre completo": ["x".repeat(5000)] });
  assert(r.ok);
  if (r.ok) assertEquals(r.registro.nombre_completo.length, 1000);
});
