import { beforeEach, describe, expect, it, vi } from "vitest";

import evaluatorService from "../evaluatorService";
import { TOKEN_KEY } from "../authService";

const mockFetch = (options: { ok: boolean; jsonData?: unknown }) => {
  const response = {
    ok: options.ok,
    json: vi.fn().mockResolvedValue(options.jsonData ?? {}),
    status: options.ok ? 200 : 500,
  };
  const fetchMock = vi.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe("evaluatorService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns evaluators list", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { users: [{ id: "1", name: "Eva" }] } });

    const result = await evaluatorService.getEvaluators();
    expect(result).toHaveLength(1);
  });

  it("returns empty list when users is missing", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: {} });

    const result = await evaluatorService.getEvaluators();
    expect(result).toEqual([]);
  });

  it("throws when token is missing", async () => {
    await expect(evaluatorService.getEvaluators()).rejects.toThrow(
      "No hay token de autenticaci",
    );
  });

  it("throws when response is not ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false });

    await expect(evaluatorService.getEvaluators()).rejects.toThrow(
      "Error al obtener evaluadores",
    );
  });
});
