---
name: proyecto-grande
description: Visión a largo plazo de Parents Break (19/10/2026) - apps de App Store (admin y niñeras), cuentas de niñeras y RLS, flujo de pedidos con WhatsApp Business y agente, control automático de cobros, lote de pagos, entrevistas con Meet, alta de familias online, reseñas y resumen a las madres. Leer antes de proponer, planear o construir cualquiera de esas funciones, o al tocar algo que las afecte.
---

# Proyecto grande: apps y flujo de pedidos (19/10/2026, visión, sin fecha)

Es parte de los Pendientes de `CLAUDE.md`: las mismas reglas de esa sección valen acá (sumar
con fecha, borrar lo que se hace, en el mismo PR).

Es la dirección a largo plazo del sistema. No se construye de una: primero una propuesta
por etapas (qué se hace primero, costos, riesgos, qué cambia en la base y en la seguridad),
y Diego decide.
- Dos apps en el App Store (Diego ya tiene la cuenta de Apple Developer: no suma costo):
  - Admin: el mismo sistema de hoy, para las tres administradoras (Paulina, Delfina y Fede),
    empaquetado como app. No se rehace: se reutiliza este código (por ejemplo con
    Capacitor). Ojo: Apple rechaza apps que son solo una web envuelta; sumar lo nativo que
    aporte (push, cámara para tickets, Face ID). Con la migración, aprovechar para mejorarla:
    que se vea más profesional, mejores métricas, componentes reutilizables en vez de
    repetidos, rehacer las consultas que sobran o son lentas, y simplificar las tareas que hoy
    llevan más pasos de los necesarios.
  - Niñeras (lo nuevo): cada una con su usuario y sus registros. Aceptan o rechazan los
    sittings ahí; marcan cuándo llegaron y cuándo se fueron, si se quedaron más tiempo, si
    pagaron algo extra (con la foto del ticket) y si pasó algo (incidente); hacen los
    reportes que haya que hacer y una reseña final del sitting. Ven lo que se les debe y lo
    que ya cobraron. Tiene un chat con las admin (para lo que no entra en un botón), así no
    hace falta WhatsApp.
- Seguridad: hoy RLS solo deja entrar a `usuarias_autorizadas` (las admin). Las niñeras
  necesitan cuentas propias que vean y escriban solo lo suyo. Es el cambio más delicado de
  todo el proyecto. Ojo: Fede es admin y también hace sittings como niñera.
- Las horas reales que marca la niñera (llegada y salida) alimentan el cálculo de cobro y
  pago que ya existe; las admin confirman antes de que cuente.
- Pagos a niñeras: siguen siendo manuales (decisión del 19/10/2026: el pago automático
  queda descartado, no proponerlo de nuevo). Lo que sí: que el sistema arme el lote de pagos
  de la semana (quién, cuánto y a qué cuenta, listo para copiar) y quede marcado como pagado
  al confirmar.
- Control automático de cobros: que el sistema sepa solo qué madres pagaron y si pagaron lo
  correcto, cruzando los movimientos de la cuenta con lo que cada familia debe, y avise lo
  que no cierra (no pagó, pagó de menos o de más, pagó dos veces). Hoy existe la
  conciliación subiendo el extracto a mano (está en pausa). Con Itaú se sigue subiendo el
  extracto una vez por mes; si se pasan a Mercado Pago, verificar su API de reportes para
  traer los movimientos solos, sin subir nada.
- Flujo de pedidos con WhatsApp Business:
  - Con las madres se sigue por WhatsApp. Con las niñeras la idea es sacar los mensajes:
    todo pasa por su app (con notificaciones push, que son gratis), y por teléfono solo si
    es algo urgente.
  - Lo ideal: un agente (Claude Haiku) lee el mensaje de la madre, entiende el pedido (día,
    horario, cantidad de chicos, zona) y arma el "ticket". Las admin eligen a qué niñeras
    mandarlo (con sugerencias según zona, temporada, fijos y disponibilidad). El precio sale
    según la familia y la niñera, y la que acepta queda asignada. Nada sale hacia una madre
    o una niñera sin que una admin lo confirme.
  - El agente no se "entrena" como un modelo propio: trabaja con instrucciones, los datos del
    sistema y ejemplos. Para sugerir qué niñeras mandar a cada familia usa el historial
    (quién fue antes y cómo le fue, reseñas, zona, disponibilidad, rechazos) y aprende de lo
    que eligen las admin: cada elección queda guardada y se usa como ejemplo.
  - Si una niñera escribe al WhatsApp en vez de usar la app, el agente la reconoce por su
    número y lo pasa al chat de su app, en vez de tratarlo como un pedido.
  - API de WhatsApp (Meta, octubre de 2026): recibir mensajes es gratis; desde el 01/10/2026
    las respuestas tienen 1.000 gratis por mes por número y después se cobran, igual que las
    plantillas. Con Coexistence se sigue usando la app de WhatsApp Business en el celular con
    el mismo número, pero los grupos no pasan a la API, se pierden las listas de difusión de
    la app y puede desvincular dispositivos vinculados. Verificar todo esto con la
    documentación de Meta antes de conectar el número real.
- Entrevistas a niñeras nuevas, más simples: agendarla desde la app y que se cree sola la
  reunión de Google Meet con el link para la candidata; que de la entrevista salgan los
  apuntes solos, ordenados según las preguntas que ya tiene la pantalla de Entrevista (ficha
  y competencias), y que la admin solo revise y corrija. Antes de construir: verificar si
  la transcripción de Meet está disponible en el plan de Google que usan o si hace falta
  grabar el audio y transcribirlo aparte (y cuánto cuesta), y pedirle a la candidata permiso
  para grabar.
- Alta de familias online: un link donde la familia nueva carga sola sus datos, los chicos
  (edades, alergias, lo que haya que saber), la dirección y cómo prefiere que la contacten.
  Entra al sistema como "familia nueva para revisar" y una admin la aprueba.
- Reseñas automáticas de las madres: después de cada sitting (o una vez por semana a las
  que tienen fijos) se le pide a la madre una reseña corta de la niñera. Alimenta la ficha y
  la sugerencia de niñeras del agente, y las que la madre autorice pueden ir a la web.
- Resumen automático a las madres: cuánto les costó el servicio, con el detalle en PDF (el
  que ya existe, con gastos y tickets). Si fue puntual, después del sitting; si tienen varios
  o fijos, uno por mes. Lo confirma una admin antes de que salga (por WhatsApp o mail). No
  hace falta factura electrónica: alcanza con un PDF claro y detallado.
