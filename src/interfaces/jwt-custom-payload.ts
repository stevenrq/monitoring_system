import { JwtPayload } from "jsonwebtoken";

export interface JwtCustomPayload extends JwtPayload {
  userId: string;
  name: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
}
