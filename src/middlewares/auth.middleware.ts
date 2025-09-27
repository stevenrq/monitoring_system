import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

/**
 * Extiende la interfaz JwtPayload para incluir el rol del usuario
 */
interface CustomPayload extends JwtPayload {
  role?: string;
}

/**
 * Extiende la interfaz Request para incluir el usuario autenticado
 */
export interface RequestWithUser extends Request {
  user?: CustomPayload;
}

export const protect = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) => {
  let accessToken: string | undefined;

  if (req.headers?.authorization?.startsWith("Bearer")) {
    try {
      accessToken = req.headers.authorization.split(" ")[1];

      req.user = jwt.verify(
        accessToken,
        process.env.ACCESS_TOKEN_SECRET as string,
      ) as CustomPayload;

      return next();
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error en la verificación del token:", error.message);
      }
      return res.status(401).send({ error: "No autorizado, token inválido" });
    }
  }

  if (!accessToken) {
    return res.status(401).send({ error: "No autorizado, no hay token" });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (
      req.user &&
      typeof req.user.role === "string" &&
      !roles.includes(req.user.role)
    ) {
      return res.status(403).send({
        error: `El rol '${req.user.role}' no tiene permiso para acceder a este recurso`,
      });
    }
    return next();
  };
};
