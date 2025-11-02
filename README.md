# Sistema de Monitoreo Ambiental

Este proyecto es el backend para un sistema de monitoreo ambiental. Ha sido desarrollado con Node.js y Express,
utilizando TypeScript para un código más robusto y mantenible. La base de datos utilizada es MongoDB con Mongoose como
ODM. El sistema se encarga de la gestión de usuarios, la autenticación y la autorización para una aplicación que recibe
datos de sensores programados con Arduino y los visualiza en un frontend desarrollado con Flutter.

## Características Principales

- **Gestión de Usuarios**: Sistema de registro y administración de usuarios con diferentes roles (administrador y
  usuario).

- **Autenticación Segura**: Implementación de autenticación basada en JSON Web Tokens (JWT), con tokens de acceso y de
  refresco para mantener la sesión segura.

- **Autorización por Roles**: Rutas protegidas que solo permiten el acceso a usuarios con roles específicos (por
  ejemplo, solo los administradores pueden crear, ver, actualizar o eliminar otros usuarios).

- **Base de Datos NoSQL**: Uso de MongoDB para almacenar la información, ofreciendo flexibilidad y escalabilidad.

- **Estructura Escalable**: El código está organizado en controladores, servicios, modelos y rutas, siguiendo un patrón
  que facilita el mantenimiento y la expansión del proyecto.

## Tecnologías Utilizadas

- **Backend**: Node.js, Express, TypeScript
- **Base de Datos**: MongoDB, Mongoose
- **Autenticación**: JSON Web Token (JWT), bcryptjs
- **Manejo de dependencias**: npm
- **Entorno de desarrollo**: ts-node-dev, dotenv

## Estructura del Proyecto

```
monitoring_system/
├── dist/                     # Código transpilado a JavaScript
├── node_modules/             # Dependencias del proyecto
├── src/
│   ├── config/               # Configuración de la base de datos y variables de entorno
│   ├── controllers/          # Lógica para manejar las peticiones y respuestas
│   ├── middlewares/          # Middlewares para autenticación y autorización
│   ├── models/               # Esquemas de la base de datos (Mongoose)
│   ├── routes/               # Definición de las rutas de la API
│   └── services/             # Lógica de negocio y comunicación con la base de datos
│   └── create-admin.ts       # Script para crear un usuario administrador
├── .env                      # Variables de entorno (no versionado)
├── .gitignore                # Archivos y carpetas ignorados por Git
├── create-admin.ts           # Script para crear un usuario administrador
├── package.json              # Metadatos y dependencias del proyecto
└── tsconfig.json             # Configuración del compilador de TypeScript
```

## Documentación con DeepWiki

Para más información sobre el proyecto, puedes preguntarle a DeepWiki:

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/stevenrq/monitoring_system)

## Empezando

Sigue estas instrucciones para tener una copia del proyecto corriendo en tu máquina local para desarrollo y pruebas.

### Prerrequisitos

Asegúrate de tener instalado lo siguiente:

- Node.js (v18 o superior recomendado)
- npm
- MongoDB

### Instalación

1. **Clona el repositorio:**

   ```bash
   git clone https://URL-DE-TU-REPOSITORIO.git
   cd monitoring_system
   ```

2. **Instala las dependencias:**

   ```bash
   npm install
   ```

3. **Configura las variables de entorno:**

   Crea un archivo `.env` en la raíz del proyecto y añade las siguientes variables, personalizando los valores según tu
   configuración:

   ```env
   # Puerto para el servidor
   PORT=3000

   # URI de conexión a MongoDB
   MONGO_URI="mongodb://localhost:27017/monitoring_system_db"

   # Secretos y tiempos de expiración para JWT
   ACCESS_TOKEN_SECRET="TU_SECRETO_DE_ACCESO_SUPER_SEGURO"
   ACCESS_TOKEN_EXPIRES_IN="15m"

   REFRESH_TOKEN_SECRET="TU_SECRETO_DE_REFRESCO_AUN_MAS_SEGURO"
   REFRESH_TOKEN_EXPIRES_IN="30d"

   # Entorno de la aplicación (development o production)
   NODE_ENV="development"
   ```

## Ejecutando la Aplicación

### Modo de desarrollo (con recarga automática)

```bash
npm run dev
```

### Modo de producción

1. Primero, construye el proyecto (transpilar de TypeScript a JavaScript):

   ```bash
   npm run build
   ```

2. Luego, inicia el servidor:

   ```bash
   npm start
   ```

## Scripts Adicionales

### Crear Usuario Administrador

El proyecto incluye un script independiente (create-admin.ts) para crear un usuario administrador inicial en la base de datos. Esto es especialmente útil para la configuración inicial del sistema, ya que permite registrar al primer administrador sin necesidad de una API pública.

### ¿Cómo funciona?

El script se conecta a la base de datos MongoDB utilizando la MONGO_URI de tu archivo .env, verifica si ya existe un administrador con el correo o nombre de usuario especificados y, si no existe, crea uno nuevo con los datos definidos en el propio script, hasheando la contraseña antes de guardarla.

### Para ejecutarlo

Asegúrate de que tu base de datos MongoDB esté corriendo y que la `MONGO_URI` en tu archivo `.env` sea
correcta. Luego, ejecuta:

```bash
npx ts-node src/create-admin.ts
```

## API Endpoints

A continuación se detallan los endpoints disponibles en la API. Todas las rutas están prefijadas con `/api`.

### Autenticación (`/api/auth`)

| Método | Endpoint        | Descripción                                                                        | Requiere Auth |
|--------|-----------------|------------------------------------------------------------------------------------|---------------|
| `POST` | `/login`        | Inicia sesión de un usuario. Devuelve un accessToken.                              | No            |
| `POST` | `/refresh`      | Refresca un accessToken expirado utilizando un refreshToken enviado en una cookie. | No            |
| `POST` | `/create-admin` | Crea un nuevo usuario con rol de administrador.                                    | Sí (Admin)    |

### Usuarios (`/api/users`)

Todas estas rutas requieren un `accessToken` válido y rol de admin.

| Método   | Endpoint | Descripción                               | Requiere Auth |
|----------|----------|-------------------------------------------|---------------|
| `GET`    | `/`      | Obtiene una lista de todos los usuarios.  | Sí (Admin)    |
| `GET`    | `/:id`   | Obtiene un usuario específico por su ID.  | Sí (Admin)    |
| `POST`   | `/`      | Crea un nuevo usuario.                    | Sí (Admin)    |
| `PUT`    | `/:id`   | Actualiza un usuario existente por su ID. | Sí (Admin)    |
| `DELETE` | `/:id`   | Elimina un usuario por su ID.             | Sí (Admin)    |

## Monitoreo en Tiempo Real con WebSockets

Además de la API REST para la gestión de usuarios, el proyecto incluye una funcionalidad de monitoreo en tiempo real utilizando WebSockets. Esto permite que dispositivos IoT (como un ESP32) envíen datos de sensores al servidor, y que clientes web se suscriban para visualizar estos datos en vivo.

### Arquitectura de WebSockets

La comunicación en tiempo real se gestiona con **Socket.IO**, que está organizado en dos *namespaces* para separar la lógica de los dispositivos y de los clientes web:

- **`/devices`**: Este namespace está dedicado a los dispositivos IoT.
  - **Eventos**:
    - `registerDevice(deviceId)`: Un dispositivo se une a una sala con su propio `deviceId` para identificarse.
    - `sensorData(payload)`: El dispositivo envía un array de datos de sus sensores. El servidor guarda estos datos en la base de datos y los retransmite a los clientes web suscritos.

- **`/web-clients`**: Este namespace es para los clientes web (dashboards).
  - **Eventos**:
    - `subscribeToDevice(deviceId)`: Un cliente web se une a la sala del `deviceId` especificado para empezar a recibir sus datos.
    - `unsubscribeFromDevice(deviceId)`: El cliente deja de recibir actualizaciones para ese dispositivo.
    - `newSensorData(data)`: Evento que recibe el cliente con los nuevos datos de un sensor del dispositivo al que está suscrito.

### Simulador de Dispositivos ESP32

Para facilitar las pruebas sin hardware físico, el proyecto incluye un simulador de dispositivos.

- **Archivo**: `src/esp32-simulator.ts`
- **Funcionalidad**: Simula dos dispositivos (`ESP32_1` y `ESP32_2`) que se conectan al servidor y envían datos de sensores cada 5 segundos.
  - `ESP32_1`: Envía datos de temperatura y humedad.
  - `ESP32_2`: Envía datos de calidad del aire y caudal hidrológico.

#### Para ejecutar el simulador

Asegúrate de que el servidor principal esté corriendo y luego ejecuta el siguiente comando en una nueva terminal:

```bash
npx ts-node src/esp32-simulator.ts
```

### Cliente Web de Monitoreo

Se proporciona un cliente web simple para visualizar los datos en tiempo real.

- **Archivo**: `src/web-client.html`
- **Funcionalidad**: Es una página HTML con JavaScript que se conecta al namespace `/web-clients`. Permite al usuario introducir el `deviceId` de un dispositivo para suscribirse y ver sus lecturas de sensores en tarjetas que se actualizan dinámicamente.

### Cómo Probar la Funcionalidad de Monitoreo

Sigue estos pasos para ver el sistema de monitoreo en acción:

1. **Inicia el servidor principal** (si aún no lo has hecho):

    ```bash
    npm run dev
    ```

2. **Ejecuta el simulador de dispositivos** en una terminal separada:

    ```bash
    npx ts-node src/esp32-simulator.ts
    ```

    Verás en la consola los logs de los dispositivos conectándose y enviando datos.

3. **Abre el cliente web**: Abre el archivo `src/web-client.html` directamente en tu navegador web.

4. **Suscríbete a un dispositivo**: En la página web, introduce `ESP32_1` o `ESP32_2` y haz clic en "Suscribirse". Inmediatamente, aparecerá una tarjeta para ese dispositivo y comenzarás a ver los datos del sensor actualizándose en tiempo real.
