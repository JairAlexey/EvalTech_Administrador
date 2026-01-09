import { beforeEach, describe, expect, it, vi } from "vitest";

import { profileService } from "../profileService";
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

describe("profileService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("updates profile successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { ok: true } });

    const result = await profileService.updateProfile({
      firstName: "User",
      lastName: "Example",
      email: "user@example.com",
    });

    expect(result.ok).toBe(true);
  });

  it("throws when token is missing", async () => {
    await expect(
      profileService.updateProfile({
        firstName: "User",
        lastName: "Example",
        email: "user@example.com",
      }),
    ).rejects.toThrow("No hay token de autenticaci");
  });

  it("throws when updateProfile fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, jsonData: { error: "update failed" } });

    await expect(
      profileService.updateProfile({
        firstName: "User",
        lastName: "Example",
        email: "user@example.com",
      }),
    ).rejects.toThrow("update failed");
  });
});
