import jwt, { Secret } from "jsonwebtoken";

export const generateToken = (
  payload: { id: string; email: string; role: string, purpose: string},
  secret: Secret,
  expiresIn: string
) => {
  const token = jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: expiresIn,
  });
  return token;
};


export const refreshToken = (
  payload: { id: string; email: string; role: string },
  secret: Secret,
  expiresIn: string
) => {
  const token = jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: expiresIn,
  });
  return token;
}