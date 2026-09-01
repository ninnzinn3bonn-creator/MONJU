import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

import { ApiError } from "./errors";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const encoder = new TextEncoder();

export interface GoogleIdentity {
  providerUserId: string;
  displayName: string;
  profileImageUrl: string | null;
}

export async function verifyGoogleIdToken(
  idToken: string,
  audience: string,
): Promise<GoogleIdentity> {
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      audience,
      issuer: ["accounts.google.com", "https://accounts.google.com"],
    });

    if (!payload.sub) {
      throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google token has no subject");
    }

    return {
      providerUserId: payload.sub,
      displayName:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : "MONJU User",
      profileImageUrl: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google sign-in token is invalid");
  }
}

export async function createSessionToken(
  userId: string,
  secret: string,
): Promise<string> {
  return new SignJWT({ provider: "google" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("monju-api")
    .setAudience("monju-mobile")
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(encoder.encode(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ["HS256"],
      audience: "monju-mobile",
      issuer: "monju-api",
    });
    if (!payload.sub) {
      throw new ApiError(401, "INVALID_SESSION", "Session has no user subject");
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "INVALID_SESSION", "Session is missing or expired");
  }
}

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "AUTH_REQUIRED", "A bearer session is required");
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError(401, "AUTH_REQUIRED", "A bearer session is required");
  }
  return token;
}
