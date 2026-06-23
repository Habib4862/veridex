# AXIOM CORE · KRYON

Panel de simulación de negocio (pipeline de ventas, agentes con XP, cartera de
inversión, generación de demos) con un "cerebro vivo" animado en canvas como
fondo. Esta es la versión modular del proyecto original de un solo archivo
HTML: misma UI, mismos colores de marca, mismas fuentes, cero pérdida de
funcionalidad — pero dividido en módulos independientes, con backend propio,
tests y soporte PWA.

## Estructura del proyecto

```
kryon-refactorizado/
├── index.html              # Punto de entrada del frontend
├── manifest.json           # Manifest PWA
├── sw.js                   # Service Worker (caché offline + push)
├── css/
│   └── style.css           # Todos los estilos (variables de marca, tema claro/oscuro, animaciones)
├── js/
│   ├── brain.js             # Animación de fondo (neuronas, venas, pulsos)
│   ├── supabase.js          # Cliente REST hacia Supabase (anon key, lado cliente)
│   ├── connections.js       # Registro de las 10 integraciones + cola de prioridad de API
│   ├── agents.js            # Agentes con XP/niveles
│   ├── healer.js            # Diagnóstico y auto-reparación de datos + métricas de salud
│   ├── pipeline.js          # Embudo de ventas y generación de oportunidades/clientes
│   ├── claude.js            # Generación de demos (proxy al backend, con caché y fallback local)
│   └── app.js               # Orquestador: DOM, render, autenticación, ciclos automáticos
├── server/                  # Backend Express (opcional — el frontend funciona sin él)
│   ├── server.js            # Punto de entrada
│   ├── package.json
│   ├── .env.example
│   ├── middleware/
│   │   ├── auth.js          # Contraseña maestra (x-admin-password)
│   │   └── rateLimit.js      # Límite de peticiones por IP
│   ├── lib/
│   │   └── supabase.js      # Cliente REST hacia Supabase (service role key, lado servidor)
│   └── routes/
│       ├── crud.js          # Factory de routers CRUD genéricos
│       ├── projects.js, clients.js, apps.js, opportunities.js, logs.js
│       ├── metrics.js       # Métricas agregadas por proyecto
│       ├── claude.js        # Proxy hacia la API de Anthropic
│       └── push.js          # Web Push (VAPID)
├── tests/                    # Tests Vitest (unitarios + integración)
├── package.json               # Dependencias de test del frontend
└── vercel.json                 # Configuración de despliegue (frontend + backend)
```

## Cómo usarlo

### Opción A — Sin servidor (modo local)

KRYON funciona abriendo `index.html` directamente en el navegador (doble
clic, o `file:///ruta/index.html`). No requiere build ni instalación. En este
modo:

- Los datos se guardan en `localStorage`.
- El Creador de demos usa una plantilla local (`<h1>Demo para Cliente</h1>`),
  exactamente igual que el archivo original.
- Las notificaciones push y el Service Worker se desactivan (no funcionan
  bajo `file://`).

### Opción B — Con backend (persistencia en la nube + Claude real + push)

1. Instala las dependencias del backend:

   ```bash
   cd server
   npm install
   cp .env.example .env
   ```

2. Completa `.env` con tus credenciales (todas son opcionales; cada una
   activa una funcionalidad concreta):

   | Variable | Activa |
   |---|---|
   | `ADMIN_CODE` | Contraseña maestra del panel (por defecto `kryon2026`) |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Persistencia de proyectos/clientes/oportunidades/apps |
   | `ANTHROPIC_API_KEY` | Generación real de demos con Claude (si falta, responde con plantilla simple) |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Notificaciones Web Push |

   Genera las claves VAPID con:

   ```bash
   npx web-push generate-vapid-keys
   ```

3. Arranca el backend:

   ```bash
   npm start        # producción
   npm run dev      # con --watch
   ```

   Por defecto escucha en `http://localhost:3001`.

4. Sirve el frontend (cualquier servidor estático funciona, por ejemplo):

   ```bash
   npx serve .
   ```

5. En el panel, entra a **Ajustes** (icono de engranaje) y configura tu
   `SUPABASE_URL`/`anon key` para que el frontend hable directamente con
   Supabase (lectura/escritura de datos). El backend usa su propia
   `SUPABASE_SERVICE_KEY` para los mismos datos vía `/api/*`, pensado para
   integraciones server-to-server o para servir el panel sin exponer la
   anon key.

### Tabla de endpoints del backend

Todas las rutas bajo `/api/*` (excepto `/api/health`) requieren la cabecera
`x-admin-password: <ADMIN_CODE>` o `Authorization: Bearer <ADMIN_CODE>`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Comprobación de vida (sin auth) |
| GET/POST/PATCH/DELETE | `/api/projects` | CRUD de proyectos |
| GET/POST/PATCH/DELETE | `/api/clients` | CRUD de clientes |
| GET/POST/PATCH/DELETE | `/api/apps` | CRUD de demos/apps |
| GET/POST/PATCH/DELETE | `/api/opportunities` | CRUD de oportunidades |
| GET/POST/PATCH/DELETE | `/api/logs` | CRUD de logs |
| GET | `/api/metrics?project_id=...` | Métricas agregadas del proyecto |
| POST | `/api/claude/generate` | Genera HTML de demo vía Claude |
| GET | `/api/push/vapid-public-key` | Clave pública VAPID |
| POST | `/api/push/subscribe` | Registra una suscripción push |
| POST | `/api/push/send` | Envía una notificación push |

## Despliegue en Vercel

El `vercel.json` incluido despliega el frontend como sitio estático y
`server/server.js` como función serverless de Node, ambos bajo el mismo
dominio (las llamadas a `/api/*` se enrutan automáticamente al backend).

```bash
npm install -g vercel   # si no lo tienes
vercel
```

Configura las variables de entorno del backend (`ADMIN_CODE`,
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) desde el panel de Vercel
(Project Settings → Environment Variables) antes de desplegar a producción.

## Tests

```bash
npm install
npm test          # ejecuta una vez
npm run test:watch
```

Los tests cubren los módulos puros (sin DOM real) cargándolos como scripts
clásicos sobre `jsdom` y leyendo las clases expuestas en `window`:

- `agents.test.js` — XP, niveles, persistencia por proyecto.
- `healer.test.js` — diagnóstico y reparación de datos corruptos, reporte de salud.
- `pipeline.test.js` — generación de clientes/oportunidades, las 5 etapas del embudo.
- `connections.test.js` — registro de conexiones, cola de prioridad de API.
- `claude.test.js` — compresión de prompts, caché LRU, fallback a plantilla local.
- `brain.test.js` — física de neuronas/pulsos del fondo animado.
- `pipeline.integration.test.js` — pipeline + agentes + sanación trabajando juntos en un ciclo completo.

## Reglas de diseño respetadas

- Sin frameworks (React/Vue/Angular) ni jQuery — JavaScript vanilla puro.
- Colores de marca exactos: fondo `#020510`, cian `#22d3ee`, hielo `#a5f0fc`,
  verde `#34d399`, oro `#e8c97a`, rojo `#f87171`.
- Fuentes originales: Outfit (títulos) y JetBrains Mono (monoespaciada).
- El fondo de "cerebro vivo" en canvas se conserva sin cambios de comportamiento.
- Cero pérdida de funcionalidad respecto al archivo original.
- Todas las librerías externas (Chart.js, html2pdf.js, fuentes) se cargan desde CDN.
- El frontend funciona abriendo `index.html` directamente, sin servidor.
