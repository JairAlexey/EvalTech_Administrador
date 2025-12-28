import { beforeEach, describe, expect, it, vi } from "vitest";

import { evaluationService } from "../evaluationService";
import { TOKEN_KEY } from "../authService";

const mockFetch = (options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  jsonData?: unknown;
  textData?: string;
}) => {
  const response = {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    statusText: options.statusText ?? "",
    json: vi.fn().mockResolvedValue(options.jsonData ?? {}),
    text: vi.fn().mockResolvedValue(options.textData ?? ""),
  };
  const fetchMock = vi.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe("evaluationService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns evaluations list", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { evaluaciones: [{ id: "1" }] } });

    const result = await evaluationService.getEvaluations();
    expect(result).toHaveLength(1);
  });

  it("returns empty list for invalid response shape", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { other: [] } });

    const result = await evaluationService.getEvaluations();
    expect(result).toEqual([]);
  });

  it("returns empty list when response is not ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, status: 500, statusText: "Server Error", textData: "fail" });

    const result = await evaluationService.getEvaluations();
    expect(result).toEqual([]);
  });

  it("returns null for evaluation details when response is not ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, status: 404, statusText: "Not Found", textData: "missing" });

    const result = await evaluationService.getEvaluationDetails("1");
    expect(result).toBeNull();
  });

  it("returns event details when response is ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { event: { id: "1", name: "Eval" } } });

    const result = await evaluationService.getEvaluationDetails("1");
    expect(result?.id).toBe("1");
  });
});
