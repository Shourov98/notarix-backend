import crypto from "node:crypto";
import { config } from "./config.js";

const encodeBase64Url = (value) =>
  Buffer.from(value).toString("base64url");

const decodeBase64Url = (value) =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (value, secret) =>
  crypto.createHmac("sha256", secret).update(value).digest("base64url");

export const createToken = (payload, expiresInSeconds = 60 * 60 * 12) => {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  );
  const signature = sign(`${header}.${body}`, config.tokenSecret);
  return `${header}.${body}.${signature}`;
};

export const verifyToken = (token) => {
  if (!token) {
    return null;
  }

  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    return null;
  }

  const expected = sign(`${header}.${body}`, config.tokenSecret);

  if (expected !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body));

    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const createRefreshToken = () =>
  crypto.randomBytes(32).toString("hex");
