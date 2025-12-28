import { beforeEach, describe, expect, it, vi } from "vitest";

import blockedPagesService from "../blockedPagesService";
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

describe("blockedPagesService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("throws when token is missing", async () => {
    await expect(blockedPagesService.getWebsites()).rejects.toThrow(
      "No hay token de autenticaci",
    );
  });

  it("gets websites list", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { websites: [{ id: "1", hostname: "a.com" }] } });

    const result = await blockedPagesService.getWebsites();
    expect(result).toHaveLength(1);
  });

  it("throws when getWebsites fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false });

    await expect(blockedPagesService.getWebsites()).rejects.toThrow(
      "Error al obtener sitios web",
    );
  });

  it("gets blocked hosts for event", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { blocked_website_ids: ["1"] } });

    const result = await blockedPagesService.getEventBlockedHosts("1");
    expect(result).toEqual(["1"]);
  });

  it("throws when getEventBlockedHosts fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false });

    await expect(blockedPagesService.getEventBlockedHosts("1")).rejects.toThrow(
      "Error al obtener hosts bloqueados del evento",
    );
  });

  it("creates website successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { id: "1", hostname: "a.com" } });

    const result = await blockedPagesService.createWebsite("a.com");
    expect(result.id).toBe("1");
  });

  it("throws when createWebsite fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, jsonData: { error: "create failed" } });

    await expect(blockedPagesService.createWebsite("a.com")).rejects.toThrow(
      "create failed",
    );
  });

  it("updates website successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { id: "1", hostname: "b.com" } });

    const result = await blockedPagesService.updateWebsite("1", "b.com");
    expect(result.hostname).toBe("b.com");
  });

  it("throws when updateWebsite fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, jsonData: { error: "update failed" } });

    await expect(blockedPagesService.updateWebsite("1", "b.com")).rejects.toThrow(
      "update failed",
    );
  });

  it("deletes website successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await blockedPagesService.deleteWebsite("1");

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when deleteWebsite fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, jsonData: { error: "delete failed" } });

    await expect(blockedPagesService.deleteWebsite("1")).rejects.toThrow(
      "delete failed",
    );
  });

  it("notifies proxy update", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await blockedPagesService.notifyProxyUpdate("1");

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when notifyProxyUpdate fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, jsonData: { error: "notify failed" } });

    await expect(blockedPagesService.notifyProxyUpdate("1")).rejects.toThrow(
      "notify failed",
    );
  });
});
