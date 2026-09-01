import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("MONJU Worker", () => {
  it("reports a healthy service without touching PostgreSQL", async () => {
    const response = await exports.default.fetch("https://monju.test/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "monju-api",
    });
  });

  it("requires authentication for private routes", async () => {
    const response = await exports.default.fetch("https://monju.test/groups");

    expect(response.status).toBe(401);
    await response.arrayBuffer();
  });
});
