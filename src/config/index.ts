import path from "node:path";
import dotenv from "dotenv";

/**
 * Carga el archivo `.env` desde la raíz del proyecto independientemente
 * del directorio desde el que se ejecute el proceso.
 */
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});
