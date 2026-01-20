import { beforeEach, describe, expect, it, vi } from "vitest";

import behaviorAnalysisService from "../behaviorAnalysisService";
import { TOKEN_KEY } from "../authService";

const mockFetch = (options: { ok: boolean; jsonData?: unknown; textData?: string }) => {
  const response = {
    ok: options.ok,
    json: vi.fn().mockResolvedValue(options.jsonData ?? {}),
    text: vi.fn().mockResolvedValue(options.textData ?? ""),
    status: options.ok ? 200 : 500,
  };
  const fetchMock = vi.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe("behaviorAnalysisService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("gets analysis status when token exists", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { analysis: { status: "done" } },
    });

    const result = await behaviorAnalysisService.getAnalysisStatus("1", "2");
    expect(result.analysis.status).toBe("done");
  });

  it("throws when getAnalysisStatus response is not ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, textData: "fail" });

    await expect(
      behaviorAnalysisService.getAnalysisStatus("1", "2"),
    ).rejects.toThrow("No se pudo obtener");
  });

  it("gets analysis report when token exists", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { analysis: { status: "done" }, statistics: {} },
    });

    const result = await behaviorAnalysisService.getAnalysisReport("1", "2");
    expect(result.analysis.status).toBe("done");
  });

  it("throws when getAnalysisReport response is not ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, textData: "fail" });

    await expect(
      behaviorAnalysisService.getAnalysisReport("1", "2"),
    ).rejects.toThrow("No se pudo obtener");
  });
});
