# Reports

Servicio responsable de materializar promedios horarios y exponer reportes diarios/mensuales para los dispositivos IoT. Todas las agregaciones respetan la zona horaria `America/Bogota` y se basan en los documentos de la colección `sensor_readings`.

## Colecciones derivadas

- `sensor_hourly_averages`: upsert por `{ deviceId, sensorType, hour }` con métricas `avg`, `min`, `max`, `samples` y unidad.

> **Radiación solar**: se asume que el promedio horario en `W/m²` durante una hora equivale a `Wh/m²`. Si la fuente cambiase a energía acumulada, este factor deberá ajustarse.

## Endpoints

Base path: `/api/reports`

- `GET /hourly`: métricas horarias filtrables por `deviceId`, `sensorType`, `date` (YYYY-MM-DD) o `from`/`to` (ISO). Respuesta paginada:
  ```json
  {
    "data": [
      {
        "deviceId": "ESP32_1",
        "sensorType": "temperature",
        "hour": "2025-11-02T09:00:00-05:00",
        "avg": 22.1,
        "min": 20.9,
        "max": 23.4,
        "samples": 12,
        "units": "°C"
      }
    ],
    "pagination": { "total": 120, "limit": 50, "page": 1, "pages": 3 }
  }
  ```

- `GET /daily`: requiere `deviceId` y `date` (YYYY-MM-DD). Devuelve 24 filas y resumen:
  ```json
  {
    "deviceId": "ESP32_1",
    "date": "2025-11-02",
    "rows": [
      {
        "hour": 0,
        "solar_radiation_avg": 420,
        "humidity_avg": 58,
        "temperature_avg": 21.6
      },
      {
        "hour": 13,
        "temperature_avg": 29.4,
        "isTmax": true
      }
    ],
    "temperature": { "tmax": 29.4, "tmin": 18.1, "tpro": 23.7 },
    "humidity": { "hpro": 61.5 },
    "radiation": { "radTot": 4650, "radPro": 387.5, "radMax": 710 }
  }
  ```

- `GET /monthly`: requiere `deviceId`, `year`, `month`. Devuelve una fila por día con las métricas agregadas (`Tmax`, `Tmin`, `Tpro`, `HR`, `RadTot`, `RadPro`, `RadMax`).

- `POST /hourly/recalculate`: recalcula promedios horarios para un rango `[from, to)` con filtros opcionales `deviceId` y/o `sensorType`. Protegido por defecto con `protect + authorize("admin")`; se puede desactivar en desarrollo con `REPORTS_AUTH_DISABLED=true`.

## Cron de agregaciones

- Archivo: `src/jobs/hourly-aggregator.job.ts`
- Programa: `*/5 * * * *` ejecuta `upsertHourlyAverages` sobre la última hora completa.
- Control por env: `HOURLY_AGGREGATION_JOB_ENABLED=false` deshabilita el job; `REPORTS_AUTH_DISABLED=true` libera las rutas (útil en local).

## Ejemplos `curl`

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/reports/hourly?deviceId=ESP32_1&sensorType=temperature&date=2025-11-02"

curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/reports/daily?deviceId=ESP32_1&date=2025-11-02"

curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/reports/monthly?deviceId=ESP32_2&year=2025&month=11"
```

> Sustituye `<TOKEN>` por un JWT válido o exporta `REPORTS_AUTH_DISABLED=true` en local.
