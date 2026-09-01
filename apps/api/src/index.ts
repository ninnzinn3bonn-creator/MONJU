import { getBearerToken, verifySessionToken } from "./auth";
import { withDatabase } from "./db";
import { ApiError } from "./errors";
import { errorResponse, json, optionsResponse } from "./http";
import { handleGoogleAuth, routeAuthenticated } from "./routes";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse();

      const url = new URL(request.url);
      console.log(
        JSON.stringify({
          message: "incoming request",
          method: request.method,
          path: url.pathname,
        }),
      );

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ status: "ok", service: "monju-api" });
      }

      if (request.method === "POST" && url.pathname === "/auth/google") {
        const authRateLimit = await env.AUTH_RATE_LIMITER.limit({
          key: request.headers.get("CF-Connecting-IP") ?? "unknown",
        });
        if (!authRateLimit.success) {
          throw new ApiError(429, "RATE_LIMITED", "Too many login attempts");
        }
        return await withDatabase(env, (client) =>
          handleGoogleAuth(request, env, client),
        );
      }

      const token = getBearerToken(request);
      const userId = await verifySessionToken(token, env.AUTH_SECRET);
      const userRateLimit = await env.USER_RATE_LIMITER.limit({ key: userId });
      if (!userRateLimit.success) {
        throw new ApiError(429, "RATE_LIMITED", "Too many requests");
      }
      return await withDatabase(env, (client) =>
        routeAuthenticated(request, env, ctx, client, userId),
      );
    } catch (error) {
      return errorResponse(error, request);
    }
  },
} satisfies ExportedHandler<Env>;
