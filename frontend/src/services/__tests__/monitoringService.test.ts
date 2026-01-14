import { beforeEach, describe, expect, it, vi } from "vitest";

import monitoringService from "../monitoringService";
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

describe("monitoringService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("gets event logs successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { logs: [], total: 0 } });

    const result = await monitoringService.getEventLogs("1", "2");
    expect(result.total).toBe(0);
  });

  it("throws when getEventLogs fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, status: 500, statusText: "Server Error", textData: "fail" });

    await expect(monitoringService.getEventLogs("1", "2")).rejects.toThrow(
      "Error al obtener los logs del evento",
    );
  });

  it("throws when getEventLogs has no token", async () => {
    await expect(monitoringService.getEventLogs("1", "2")).rejects.toThrow(
      "No hay token de autenticaci",
    );
  });

  it("gets participant connection stats successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: {
        participant: { id: 1, name: "User", email: "u@example.com" },
        total_time_seconds: 615,
        monitoring_is_active: true,
        monitoring_last_change: null,
        monitoring_sessions_count: 1,
      },
    });

    const result = await monitoringService.getParticipantConnectionStats("1", "2");
    expect(result.total_time_seconds).toBe(615);
  });

  it("throws when getParticipantConnectionStats fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, status: 500, statusText: "Server Error", textData: "fail" });

    await expect(
      monitoringService.getParticipantConnectionStats("1", "2"),
    ).rejects.toThrow("Error al obtener estad");
  });
});
