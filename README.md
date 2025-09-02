# Sistema de Monitoreo Ambiental 🌱

Este proyecto es el backend para un sistema de monitoreo ambiental. Ha sido desarrollado con Node.js y Express,
utilizando TypeScript para un código más robusto y mantenible. La base de datos utilizada es MongoDB con Mongoose como
ODM. El sistema se encarga de la gestión de usuarios, la autenticación y la autorización para una aplicación que recibe
datos de sensores programados con Arduino y los visualiza en un frontend desarrollado con Flutter.

## ✨ Características Principales

- **Gestión de Usuarios**: Sistema de registro y administración de usuarios con diferentes roles (administrador y
  usuario).

- **Autenticación Segura**: Implementación de autenticación basada en JSON Web Tokens (JWT), con tokens de acceso y de
  refresco para mantener la sesión segura.

- **Autorización por Roles**: Rutas protegidas que solo permiten el acceso a usuarios con roles específicos (por
  ejemplo, solo los administradores pueden crear, ver, actualizar o eliminar otros usuarios).

- **Base de Datos NoSQL**: Uso de MongoDB para almacenar la información, ofreciendo flexibilidad y escalabilidad.

- **Estructura Escalable**: El código está organizado en controladores, servicios, modelos y rutas, siguiendo un patrón
  que facilita el mantenimiento y la expansión del proyecto.

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express, TypeScript
- **Base de Datos**: MongoDB, Mongoose
- **Autenticación**: JSON Web Token (JWT), bcryptjs
- **Manejo de dependencias**: npm
- **Entorno de desarrollo**: ts-node-dev, dotenv

## 📂 Estructura del Proyecto

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
├── .env                      # Variables de entorno (no versionado)
├── .gitignore                # Archivos y carpetas ignorados por Git
├── create-admin.ts           # Script para crear un usuario administrador
├── package.json              # Metadatos y dependencias del proyecto
└── tsconfig.json             # Configuración del compilador de TypeScript
```

## 🚀 Empezando

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

## ▶️ Ejecutando la Aplicación

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

## 📜 Scripts Adicionales

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

## 📋 API Endpoints

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
