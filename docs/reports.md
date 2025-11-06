# Reports

Servicio responsable de materializar promedios horarios y exponer reportes diarios/mensuales para los dispositivos IoT. Todas las agregaciones y respuestas operan en UTC y se basan en los documentos de la colección `sensor_readings`.

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
        "hour": "2025-11-02T09:00:00Z",
        "avg": 22.3,
        "min": 21.8,
        "max": 23.1,
        "samples": 12,
        "units": "°C"
      },
      {
        "deviceId": "ESP32_1",
        "sensorType": "humidity",
        "hour": "2025-11-02T09:00:00Z",
        "avg": 58.4,
        "min": 55.1,
        "max": 60.2,
        "samples": 12,
        "units": "%"
      }
    ],
    "pagination": { "total": 2, "limit": 500, "page": 1, "pages": 1 }
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
        "temperature_avg": 20,
        "humidity_avg": 60,
        "solar_radiation_avg": 450
      },
      {
        "hour": 1,
        "temperature_avg": 27,
        "solar_radiation_avg": 500,
        "isTmax": true
      },
      {
        "hour": 2,
        "temperature_avg": 18,
        "isTmin": true
      }
    ],
    "temperature": { "tmax": 27, "tmin": 18, "tpro": 21.67 },
    "humidity": { "hpro": 60 },
    "radiation": { "radTot": 950, "radPro": 475, "radMax": 500 }
  }
  ```

- `GET /monthly`: requiere `deviceId`, `year`, `month`. Devuelve una fila por día con las métricas agregadas (`Tmax`, `Tmin`, `Tpro`, `HR`, `RadTot`, `RadPro`, `RadMax`). Ejemplo:
  ```json
  {
    "deviceId": "ESP32_1",
    "year": 2025,
    "month": 11,
    "days": [
      { "day": 1, "RadTot": 480, "RadPro": 320, "RadMax": 520, "HR": 65, "Tmax": 22, "Tmin": 18, "Tpro": 20.5 },
      { "day": 2, "RadTot": 600, "RadPro": 600, "RadMax": 600, "HR": 70, "Tmax": 25, "Tmin": 21, "Tpro": 23.5 }
    ]
  }
  ```

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
  "http://localhost:3000/api/reports/monthly?deviceId=ESP32_1&year=2025&month=11"
```

> Sustituye `<TOKEN>` por un JWT válido o exporta `REPORTS_AUTH_DISABLED=true` en local.
