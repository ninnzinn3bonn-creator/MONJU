import { ApiError } from "./errors";

const MAX_JSON_BODY_BYTES = 64 * 1024;

export const COMMON_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "DELETE, GET, OPTIONS, PATCH, POST, PUT",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
} as const;

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(COMMON_HEADERS)) {
    headers.set(name, value);
  }
  return Response.json(data, { ...init, headers });
}

export function empty(status = 204): Response {
  return new Response(null, { status, headers: COMMON_HEADERS });
}

export function optionsResponse(): Response {
  return empty(204);
}

export async function readJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "JSON body is too large");
  }

  if (!request.body) {
    throw new ApiError(400, "INVALID_JSON", "A JSON body is required");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_JSON_BODY_BYTES) {
        await reader.cancel("JSON body is too large");
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "JSON body is too large");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body is not valid JSON");
  }
}

export function matchPath(
  pathname: string,
  template: string,
): Record<string, string> | null {
  const actualParts = pathname.split("/").filter(Boolean);
  const templateParts = template.split("/").filter(Boolean);
  if (actualParts.length !== templateParts.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < templateParts.length; index += 1) {
    const expected = templateParts[index];
    const actual = actualParts[index];
    if (!expected || !actual) return null;
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }

  return params;
}

export function requiredParam(
  params: Record<string, string>,
  name: string,
): string {
  const value = params[name];
  if (!value) {
    throw new ApiError(400, "INVALID_PATH", `Missing path parameter: ${name}`);
  }
  return value;
}

export function errorResponse(error: unknown, request: Request): Response {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      message: "unhandled request error",
      error: message,
      method: request.method,
      path: new URL(request.url).pathname,
    }),
  );
  return json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    { status: 500 },
  );
}
