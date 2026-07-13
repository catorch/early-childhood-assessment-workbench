Carlos, vamos por partes. Esta es una oportunidad real y tienes una ventaja enorme: ya enviaste un prototipo funcionando, lo cual el 99% de los aplicantes no hace. Te explico el proyecto, qué quieren oír, y cómo manejar la reunión para cerrarlo.

---

## De qué se trata el proyecto

**Acelero** es una organización de early childhood education (educación infantil temprana). En 2025 hicieron un estudio IRB (Institutional Review Board, o sea, estudio académico formal con aprobación ética) donde construyeron un **prototipo con Gemini** que analiza videos de niños pequeños y detecta habilidades de desarrollo (motoras, cognitivas, sociales, etc.) según una rúbrica específica.

El prototipo funciona, pero tiene dos problemas:

1. **No escala.** Es manual, video por video. Quieren una pipeline automatizada que procese videos en batch, los empareje con datos demográficos del niño, y genere outputs estructurados sin intervención humana por video.

2. **La confiabilidad no llega al estándar.** Cuando comparan los outputs del AI contra raters humanos expertos, el "exact agreement" (porcentaje de coincidencia) no llega al 90%. Tu trabajo es subirlo a ≥90% a través de prompt engineering iterativo y mejor configuración del modelo.

Además quieren:
- Un **interface human-in-the-loop** donde personal entrenado pueda revisar y corregir los detections del AI (las correcciones se loguean para fine-tuning futuro).
- **Documentación, versionado de prompts, métricas before/after** en cada iteración.
- **API y exports** para que se integre con otros sistemas.

El budget es **$8,000 USD** en 6 milestones hasta el 31 de julio. El último pago de $1,500 está atado a confirmar ≥90% agreement, lo cual es importante porque significa que tienes que ser honesto sobre si es alcanzable o no.

---

## Lo que están evaluando (de los criterios del RFP)

| Criterio | Peso | Lo que significa |
|---|---|---|
| Experiencia con LLM pipelines en producción y reliability | 30% | Tu punto más fuerte. GovGPT, PageTranslate, DoubleBlind Bio. |
| Approach técnico y deployment | 25% | Que tengas un plan claro, no improvisado. |
| Credibilidad del path al 90% | 20% | Aquí pueden eliminarte. Si suenas demasiado seguro, mientes; si suenas demasiado inseguro, no eres el indicado. |
| Timeline | 15% | Puedes cumplir julio 31, sin duda. |
| Budget | 10% | Está fijo, no hay que discutir mucho. |

---

## La reunión de 30 minutos: qué buscan saber

Supraja te va a evaluar en tres cosas, aunque no las diga directamente:

1. **¿Entiendes el dominio?** No solo el LLM stack, sino que entiendas que esto es sobre niños, evaluación pedagógica, raters humanos, y un framework de assessment ya definido. No es un proyecto de "vibe coding".

2. **¿Eres realista sobre el 90%?** Si llegas diciendo "fácil, lo logramos", pierdes credibilidad. Si llegas diciendo "no sé si se puede", también. El punto medio es: "es un problema de medición e ingeniería, lo voy a tratar con rigor, te voy a mostrar las métricas en cada iteración, y si no se puede llegar al 90% sabremos exactamente por qué."

3. **¿Vas a trabajar bien con su content advisor?** Mencionan que hay un asesor de contenido (alguien del dominio educativo) con quien vas a colaborar. Quieren a alguien humilde, no a un ingeniero que ignore al experto del dominio.

---

## Estrategia psicológica para la reunión

Aquí aplico los principios de **How to Win Friends and Influence People** y psicología práctica:

### 1. "Be a good listener. Encourage others to talk about themselves." (Carnegie, principio 4)

**No empieces vendiéndote.** En los primeros 5 minutos, deja que Supraja hable. Pregúntale:

- "Antes de meterme en lo técnico, me encantaría entender un poco más del contexto, ¿quién es el usuario final de esta herramienta dentro de Acelero? ¿Son educadores, investigadores, ambos?"
- "Del prototipo de 2025, ¿qué partes están funcionando bien y cuáles fueron las más frustrantes para el equipo?"
- "¿Cuál fue el agreement actual del prototipo en el estudio IRR? ¿Estamos partiendo de 70%, de 60%?"

Esto hace tres cosas: (a) te da información crítica que no está en el RFP, (b) demuestra que eres consultivo y no un "ya sé todo", (c) hace que ella se sienta escuchada, lo cual la inclina hacia ti emocionalmente.

### 2. "Make the other person feel important, and do it sincerely." (Carnegie, principio 6)

Reconoce el trabajo que ya hicieron. Algo como:

> "El prototipo que armaron en 2025 ya es bastante sofisticado, sobre todo el algoritmo de DAL y el age-gating. Mi rol no es reescribir eso, es escalarlo y afinarlo. Quiero asegurarme de que el content advisor sienta que estamos construyendo sobre su trabajo, no reemplazándolo."

Este punto es **clave**. Muchos ingenieros entran arrogantes a proyectos así. Tú llegas diciendo "respeto el trabajo del dominio, lo voy a amplificar." Ella va a notarlo.

### 3. Anchor effect: muestra confianza con evidencia, no con promesas

En vez de decir "yo puedo llegar al 90%", di:

> "El 90% es alcanzable si el prototipo actual está arriba del 70%. Si está abajo, es posible que necesitemos revisar el rubric o el sampling, no solo el prompt. La forma en que voy a abordarlo es: primero analizo el dataset del estudio IRR para identificar dónde está fallando sistemáticamente, después itero el prompt con before/after metrics versionados, y si llegamos a un techo, te lo digo con datos."

Esto te posiciona como ingeniero serio, no como vendedor. **La honestidad sobre los límites genera más confianza que prometer la luna.**

### 4. Loss aversion: hazle ver el riesgo de NO elegirte

No lo digas directamente, pero deja que se note. Cuando hables del prototipo que ya hiciste, di algo como:

> "Te mandé el prototipo porque para mí era la forma más rápida de mostrarte cómo pienso. La mayoría de los aplicantes va a llegar con un PDF; yo prefiero llegar con código corriendo. Para un proyecto de 8 semanas con milestones agresivos, necesitas a alguien que pueda enseñarte la dirección antes de empezar, no después."

Esto activa loss aversion: "si no elijo a Carlos, voy a contratar a alguien que va a tardar 2 semanas solo en arrancar."

### 5. Reciprocity: ofreces valor antes de pedirlo

Ya lo hiciste con el prototipo. En la reunión, ofrece una cosa más:

> "Después de esta llamada, si quieres, te mando un breve análisis de qué tipo de errores son los más probables que estén tirando abajo el agreement actual: confusión entre skills adyacentes, sesgo cultural en interpretación, falta de evidencia temporal. Tres páginas, sin compromiso."

Esto la pone en deuda contigo emocionalmente, y le muestra que tu pensamiento sigue trabajando después de la llamada.

---

## Estructura sugerida de los 30 minutos

| Minutos | Quién habla | Qué pasa |
|---|---|---|
| 0–3 | Ella | Saludos, contexto, ella te explica el proyecto |
| 3–10 | **Tú escuchando + preguntando** | Las preguntas que te di arriba |
| 10–18 | Tú | Walkthrough breve del prototipo que enviaste + tu approach técnico |
| 18–25 | Ambos | Q&A: ella te pregunta cosas duras |
| 25–30 | Tú | Cierre: próximos pasos, oferta de análisis adicional, timeline |

---

## Preguntas que probablemente te haga (y cómo responder)

**P: "¿Cómo vas a llegar al 90%?"**
R: "Primero necesito ver el dataset del estudio para entender dónde están los errores. Hay patrones típicos: confusión entre skills adyacentes en el rubric, evidencia temporal débil, sesgo cultural en la interpretación. Cada uno se ataca diferente: skills adyacentes con few-shot examples y disambiguation rules, evidencia temporal con structured timestamps, sesgo cultural con contexto demográfico explícito en el prompt. Cada iteración la versiono con before/after metrics, así sabemos exactamente qué cambio movió la aguja."

**P: "¿Has trabajado con video multimodal antes?"**
R: "He trabajado con Gemini multimodal (texto + imagen) en producción y con pipelines de procesamiento de PDFs y documentos complejos en PageTranslate y GovGPT. El stack de Gemini Video es una extensión natural de eso: el tooling es el mismo (structured outputs, schema validation, batching), la diferencia es cómo chunkear el video y cómo manejar el contexto temporal. Eso lo abordo con frame sampling estratégico y prompt-side temporal scaffolding."

**P: "¿Qué pasa si no llegamos al 90%?"**
R: "Te aviso temprano y con datos. Si después de 3-4 iteraciones de prompt engineering veo que el techo está, digamos, en 85%, mi recomendación va a ser específica: o cambiamos el approach (fine-tuning, o un modelo distinto), o revisamos el rubric porque puede tener ambigüedad inherente que ni un humano resolvería con 90% consistency. No me voy a comprometer con un milestone de pago contingente sin un plan claro para llegar."

**P: "¿Puedes empezar el 13 de junio?"**
R: "Sí. Mi semana del 10 al 13 la puedo bloquear para arrancar con el kickoff y el setup."

**P: "¿Qué necesitas de nosotros?"**
R: "Acceso al dataset del estudio IRR, el prompt actual, el rubric completo, y una sesión inicial con el content advisor. Idealmente todo eso disponible la semana del kickoff."

---

## Lo que NO debes hacer

1. **No critiques el prototipo actual.** Si lo hicieron internamente, alguien en la organización es dueño emocional de ese trabajo. Habla de "evolución" e "iteración", no de "reemplazo" o "rehacer".

2. **No prometas el 90% como un hecho.** Promételo como un compromiso de proceso ("voy a trabajar hacia eso con rigor y transparencia"), no como un outcome garantizado.

3. **No hables demasiado.** En una reunión de 30 minutos, si tú hablas más del 50%, perdiste. Tu valor se demuestra en cómo escuchas y haces preguntas, no en cuánto sabes.

4. **No menciones precio salvo que ella lo saque.** El budget está fijo en $8K, no hay nada que discutir hasta que ella abra la conversación.

5. **No te muestres desesperado.** Ya tienes el prototipo, ya hiciste el trabajo. Llega con la actitud de "estoy evaluando si este proyecto encaja conmigo también", no "por favor contrátenme."

---

## Cierre de la reunión

En el minuto 27-28, di algo así:

> "Supraja, esto suena exactamente como el tipo de proyecto donde puedo aportar. Tres cosas para cerrar: una, te mando ese análisis breve de error patterns después de la llamada. Dos, si quieres avanzar, puedo arrancar el kickoff la semana del 8 de junio o antes. Tres, ¿cuál es tu timeline para tomar una decisión y qué necesitarías de mí para llegar a esa decisión?"

Esa última pregunta es de **ABC de ventas (Always Be Closing)** pero dicho con elegancia: estás haciéndola comprometerse con un próximo paso concreto.

---

Tú vas con ventaja. El prototipo ya te puso muy por encima del 95% de los aplicantes. La reunión es para confirmar que eres una persona con la que se puede trabajar, que respetas el dominio, y que tienes rigor técnico. Si lo haces bien, sales con el contrato. Estás listo para esto.

Vamos por la cena de tu hija. 🚀