# Sistema de Monitoreo Ambiental (Backend)

Backend en TypeScript/Express que recibe lecturas de sensores (ESP32), calcula agregados históricos y expone APIs, WebSockets y notificaciones para monitorear un umbráculo tanto en interior como exterior.

## Índice

1. [Visión general](#visión-general)
2. [Características clave](#características-clave)
3. [Arquitectura y flujo de datos](#arquitectura-y-flujo-de-datos)
4. [API REST y documentación](#api-rest-y-documentación)
5. [WebSocket y streaming en tiempo real](#websocket-y-streaming-en-tiempo-real)
6. [Alertas y notificaciones](#alertas-y-notificaciones)
7. [Reportes y agregaciones históricas](#reportes-y-agregaciones-históricas)
8. [Modelos y persistencia](#modelos-y-persistencia)
9. [Requisitos previos](#requisitos-previos)
10. [Variables de entorno](#variables-de-entorno)
11. [Instalación y ejecución](#instalación-y-ejecución)
12. [Scripts útiles](#scripts-útiles)
13. [Pruebas automatizadas](#pruebas-automatizadas)
14. [Estructura del proyecto](#estructura-del-proyecto)
15. [Resolución de problemas](#resolución-de-problemas)
16. [Recursos adicionales](#recursos-adicionales)

## Visión general

El sistema recibe lecturas de sensores (temperatura, humedad, humedad de suelo y radiación solar) instalados en múltiples ESP32, almacena los datos crudos en MongoDB y genera promedios horarios, diarios y mensuales. Los usuarios autenticados pueden gestionar plantas, usuarios, umbrales y recibir alertas vía WebSocket o Firebase Cloud Messaging (FCM). La autenticación usa JWT (access + refresh tokens en cookie httpOnly) y el correo transaccional se envía con SendGrid.

## Características clave

- API REST en Express 5 con tipado estricto, validaciones Zod y documentación OpenAPI (Swagger UI en `/api/docs`).
- Autenticación JWT con roles (`admin`, `user`), recuperación y rotación segura de contraseñas.
- Ingesta de datos en tiempo real mediante WebSocket y propagación inmediata a clientes web suscritos.
- Gestión de plantas y umbrales que alimenta el motor de alertas (WebSocket + FCM).
- Reportes horarios/días/meses sobre lecturas crudas y agregadas, con recalculo bajo demanda.
- Cron job (node-cron) que recalcula cada 5 minutos los promedios del último bloque horario.
- Integración con Firebase Admin para notificaciones push y SendGrid para correos.
- Suite de pruebas con Jest + ts-jest para servicios, controladores y lógica de alertas.

## Arquitectura y flujo de datos

```text
[ESP32 / Simulador] --WS--> [Socket Handler] --MongoDB--> [sensor_data]
                                                   |
                                                   v
                                         [node-cron job]
                                                   |
                                                   v
                                          [sensor_hourly_averages]
                                                   |
    REST / WebSocket / FCM  <-----------------------+
```

- **Express API (`src/app.ts`)**: maneja CORS, cookies, JSON y expone `/health` para monitoreo.
- **WebSocket (`src/socket/socket.handler.ts`)**: recibe arrays de lecturas, valida payloads, inserta en `SensorData` y distribuye eventos (`newSensorData`, `sensorAlert`, `thresholdsUpdated`, `ack`, `dataError`).
- **Servicios de reportes**: usan agregaciones Mongo + `luxon` para producir métricas y recalcular promedios horarios.
- **Motor de alertas** (`notification.service`): evalúa umbrales configurables por planta y despacha alertas con cooldown de 5 min.
- **FCM + SendGrid**: Push notifications (`push-notification.service`) y recuperación de contraseña (`email.service`).
- **Jobs** (`hourly-aggregator.job.ts`): cada 5 minutos recalcula el último bloque horario (configurable vía `HOURLY_AGGREGATION_JOB_ENABLED`).

## API REST y documentación

- Todas las rutas viven bajo `/api`.
- Swagger UI: `GET /api/docs` (JSON en `/api/docs/openapi.json`; archivo base `openapi.json`).
- Salud: `GET /health` responde `{ ok: true }`.

| Módulo | Endpoint principal | Método(s) | Descripción | Auth |
| --- | --- | --- | --- | --- |
| Autenticación | `/api/auth/login` | `POST` | Genera accessToken + refreshToken (cookie). | Público |
| | `/api/auth/refresh` | `POST` | Regenera tokens usando la cookie `refreshToken`. | Refresh cookie |
| | `/api/auth/forgot-password` | `POST` | Envía contraseña temporal vía SendGrid. | Público |
| | `/api/auth/change-password` | `POST` | Cambia la contraseña y revoca refresh tokens. | Bearer |
| | `/api/auth/authenticated-user` | `GET` | Devuelve el usuario autenticado. | Bearer |
| | `/api/auth/create-admin` | `POST` | Alta de administradores desde la API. | Bearer + `admin` |
| Usuarios | `/api/users` | `GET/POST` | Listar/crear usuarios. | Bearer + `admin` |
| | `/api/users/:id` | `GET/PUT/DELETE` | CRUD puntual de usuarios. | Bearer + `admin` |
| Plantas | `/api/plants` | `GET/POST` | Gestiona plantas y sus umbrales. | Bearer + `admin` |
| | `/api/plants/:id` | `GET/PUT/DELETE` | CRUD puntual y recálculo de umbrales. | Bearer + `admin` |
| | `/api/plants/count` | `GET` | Conteo global de plantas registradas. | Bearer + `admin` |
| Sensores | `/api/sensor-data/latest` | `GET` | Últimas lecturas por dispositivo/sensor. | Público |
| | `/api/sensor-data/report` | `GET` | Estadísticos (min/max/promedio) filtrables. | Público |
| | `/api/sensor-data/raw` | `GET` | Lecturas crudas acotadas por rango/limit. | Público |
| Reportes | `/api/reports/hourly` | `GET` | Métricas horarias paginadas (filtrables). | Bearer (configurable) |
| | `/api/reports/daily` | `GET` | 24 filas del día + extremos T/H/Rad. | Bearer (configurable) |
| | `/api/reports/monthly` | `GET` | Resumen por día del mes. | Bearer (configurable) |
| | `/api/reports/hourly/recalculate` | `POST` | Recalcula promedios horarios. | Bearer + `admin` (o público si `REPORTS_AUTH_DISABLED=true`) |
| Notificaciones | `/api/notifications/tokens` | `POST` | Registra tokens FCM asociados al usuario actual. | Bearer |

> **Nota**: La autenticación sobre `/api/reports/*` se puede desactivar para integraciones de BI estableciendo `REPORTS_AUTH_DISABLED=true`.

## WebSocket y streaming en tiempo real

- URL: el mismo host/puerto del backend (ej. `ws://localhost:3000`).
- Eventos admitidos:
  - `registerDevice`: `{ "event": "registerDevice", "deviceId": "ESP32_1" }` (marcar socket como dispositivo).
  - `subscribeToDevice`: `{ "event": "subscribeToDevice", "deviceId": "ESP32_1" }` (cliente web recibe `newSensorData` y `sensorAlert`).
  - `updateThresholds`: `{ "event": "updateThresholds", "deviceId": "ESP32_1", "sensorType": "temperature", "min": 18, "max": 32 }`.
  - Payloads de sensores: arreglo de objetos `SensorPayload` (`deviceId`, `sensorType`, `value`, `unit`). Cada elemento se almacena en Mongo y se retransmite a clientes suscritos.
  - Respuestas: `ack`, `newSensorData`, `sensorAlert`, `thresholdsUpdated`, `thresholdUpdateError`, `dataError`.
- Cliente de ejemplo: `src/web-client.html` (formulario Bootstrap para suscribirse y ajustar umbrales, útil para pruebas rápidas).
- Simulador ESP32: `src/esp32-simulator.ts` envía lecturas cada 5 minutos usando `BACKEND_URL`.

## Alertas y notificaciones

- Los umbrales viven en Mongo (`Plant.thresholds`). Al arrancar el servidor (`initializePlantThresholds`) se cargan al motor de alertas.
- Solo los dispositivos contenidos en `ALERT_ENABLED_DEVICE_IDS` (por defecto `["ESP32_1"]`) disparan alertas.
- Se soportan umbrales `min`/`max` por sensor. Para `soil_humidity` siempre se fuerza `min = 20`.
- Cooldown de 5 minutos evita spam (`ALERT_COOLDOWN_MS = 300000`).
- Cada alerta se difunde vía:
  - WebSocket (`event: "sensorAlert"`) para clientes suscritos.
  - Firebase Cloud Messaging (`push-notification.service`) ya sea por `topic` (default `sensor-alerts`) o tokens específicos registrados en `/api/notifications/tokens`.
- Correo: `POST /api/auth/forgot-password` genera una contraseña de 12 caracteres y la envía con SendGrid (`email.service.ts`).

## Reportes y agregaciones históricas

- Los datos crudos residen en `sensor_data`. El job `startHourlyAggregationJob` (node-cron) corre cada 5 minutos y procesa el último bloque horario completo.
- Resultado: colección `sensor_hourly_averages` con `avg/min/max/samples` por `deviceId + sensorType + hour`.
- Servicios disponibles:
  - `getHourlyReport`: filtros por dispositivo, sensor y rango (`from/to` o `date`), paginación y resultados en ISO UTC.
  - `getDailyReport`: 24 filas con promedios horarios, + métricas `tmax/tmin/tpro`, `hpro`, `radTot/radPro/radMax`.
  - `getMonthlyReport`: agrega por día (temperatura, humedad, radiación).
  - `upsertHourlyAverages`: recalcula un rango arbitrario; expuesto vía `POST /api/reports/hourly/recalculate`.

## Modelos y persistencia

- `User`: credenciales, rol, `refreshToken`, validaciones de contraseña/teléfono y `comparePassword`.
- `Plant`: nombre único, `deviceId` (default `ESP32_1`) y umbrales por sensor, con validaciones personalizadas.
- `SensorData`: lecturas crudas (índices por dispositivo, sensor y timestamp).
- `SensorHourlyAverage`: promedios horarios (índice único `{ deviceId, sensorType, hour }`).
- `FcmToken`: tokens por usuario/dispositivo/plataforma, con `lastUsedAt`.
- `Device`: metadata básica del hardware (placeholder para extensiones futuras).

## Requisitos previos

- Node.js 20 LTS (recomendado) y npm 10+.
- MongoDB 6.x o superior.
- Cuenta SendGrid con API Key válida y un remitente verificado.
- Proyecto Firebase habilitado para Cloud Messaging + credenciales de servicio (las variables `FIREBASE_*` o el archivo `monitoring-system-*.json`).
- Opcional: PM2 para despliegue (`run.sh` lo usa).
- Para ejecutar el simulador, definir `BACKEND_URL` apuntando al backend http (ej. `http://localhost:3000`).

## Variables de entorno

| Variable | Obligatoria | Valor por defecto / ejemplo | Descripción |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | Puerto HTTP y WebSocket. |
| `MONGO_URI` | Sí | `mongodb://localhost:27017/monitoring` | Cadena de conexión a MongoDB. |
| `ACCESS_TOKEN_SECRET` | Sí | — | Clave JWT para access tokens. |
| `REFRESH_TOKEN_SECRET` | Sí | — | Clave JWT para refresh tokens (cookie httpOnly). |
| `ACCESS_TOKEN_EXPIRES_IN` | No | `15m` | Duración del access token (formato `ms`). |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `30d` | Duración del refresh token. |
| `SENDGRID_API_KEY` | Sí | — | API Key para enviar correos. |
| `EMAIL_USER` | Sí | `alertas@dominio.com` | Remitente usado en `forgot-password`. |
| `FIREBASE_PROJECT_ID` | Sí* | — | ID del proyecto Firebase (obligatorio si se envían notificaciones push). |
| `FIREBASE_CLIENT_EMAIL` | Sí* | — | Email del servicio Firebase. |
| `FIREBASE_PRIVATE_KEY` | Sí* | `"-----BEGIN PRIVATE KEY-----\\n..."` | Clave privada (escapar saltos `\n`). |
| `FIREBASE_ALERTS_TOPIC` | No | `sensor-alerts` | Tópico default para FCM. |
| `BACKEND_URL` | No | `http://localhost:3000` | Usado por el simulador ESP32 y en `openapi.json`. |
| `HOURLY_AGGREGATION_JOB_ENABLED` | No | `true` | Colocar `false` para desactivar el cron job. |
| `REPORTS_AUTH_DISABLED` | No | `false` | `true` expone `/api/reports/*` sin autenticación. |
| `NODE_ENV` | No | `development` | Ajusta cookies (secure) y logs. |

`*` Variables requeridas cuando se habilitan las notificaciones push. Si no se definen se lanzará un error en `config/firebase-admin.ts`.

## Instalación y ejecución

1. Clonar el repositorio y entrar a la carpeta:

   ```bash
   git clone <repo-url>
   cd monitoring_system
   ```

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Configurar `.env` (puedes copiar el bloque anterior como referencia).

4. Ejecutar en desarrollo (recarga automática con `ts-node-dev`):

   ```bash
   npm run dev
   ```

5. Compilar y arrancar en modo producción (Express + WebSocket):

   ```bash
   npm run build
   npm start
   ```

6. Flujo sugerido para servidores:

   ```bash
   npm run build
   npm run start:prod   # ejecuta dist/create-admin.js y luego node dist/server.js
   ```

7. Despliegue con PM2 (`run.sh`):

   ```bash
   ./run.sh
   # Logs en tiempo real:
   pm2 logs monitoring_system
   ```

8. Simulador de dispositivos:

   ```bash
   BACKEND_URL=http://localhost:3000 npx ts-node src/esp32-simulator.ts
   ```

   (Requiere tener `ts-node` disponible; alternativamente compila el archivo y ejecútalo con Node).

### Crear un administrador desde CLI

```bash
npm run build
node dist/create-admin.js
```

El script `src/create-admin.ts` usa los datos definidos en el propio archivo (actualízalos antes de compilar). También puedes crear administradores vía `POST /api/auth/create-admin` autenticado.

## Scripts útiles

- `npm run dev`: servidor Express + WebSocket con recarga.
- `npm run build`: compila TypeScript a `dist/`.
- `npm start`: ejecuta `node dist/server.js`.
- `npm run start:prod`: corre `dist/create-admin.js` y luego `npm start`.
- `npm test`: suite Jest completa.
- `npm run test:watch`: modo observador.
- `node dist/create-admin.js`: crea un admin (requiere `npm run build` previo).

## Pruebas automatizadas

- Framework: Jest + ts-jest (`jest.config.ts`).
- Cobertura recolectada sobre controladores, servicios, rutas y modelos.
- Carpeta de pruebas: `tests/` (ejemplos notables: lógica de reportes, notificaciones y registro de tokens FCM).

```bash
npm test
# Resultados y cobertura en ./coverage
```

## Estructura del proyecto

```text
├── src
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── jobs/
│   ├── socket/
│   ├── interfaces/
│   ├── esp32-simulator.ts
│   └── web-client.html
├── tests/
│   ├── controllers/
│   ├── reports/
│   └── services/
├── openapi.json
├── jest.config.ts
├── tsconfig.json
├── package.json
└── run.sh
```

## Resolución de problemas

- **Errores de conexión MongoDB**: verifica `MONGO_URI`, accesos de red y credenciales; el servidor se detiene (`process.exit(1)`) si no puede conectar.
- **Tokens JWT inválidos**: asegúrate de que `ACCESS_TOKEN_SECRET` y `REFRESH_TOKEN_SECRET` coincidan entre servidores y que la hora del sistema sea correcta.
- **FCM deshabilitado**: si faltan variables `FIREBASE_*`, el inicializador lanza un error al primer envío; verifica que `FIREBASE_PRIVATE_KEY` conserve los saltos de línea (`\n`).
- **Alertas no disparan**: confirma que el dispositivo esté en `ALERT_ENABLED_DEVICE_IDS`, que existan umbrales (`Plant.thresholds`) y que haya pasado el cooldown.
- **Reportes vacíos**: ejecuta manualmente `POST /api/reports/hourly/recalculate` con un rango `from/to` válido o espera a que el cron job calcule promedios.

## Recursos adicionales

- `openapi.json`: contrato OpenAPI 3.1 que alimenta Swagger UI.
- `src/web-client.html`: dashboard minimalista para consumo WebSocket.
- `monitoring-system-f50e6-*.json`: credencial Firebase de referencia (no subir a repositorios públicos).
- `tests/`: ejemplos claros de cómo mockear modelos y servicios.
- `run.sh`: helper para compilar y desplegar con PM2.

---

Cualquier mejora o duda puede documentarse en este README para mantener alineado al equipo de desarrollo, operaciones y hardware.
