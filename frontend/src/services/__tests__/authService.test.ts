import { beforeEach, describe, expect, it, vi } from "vitest";

import { authService, TOKEN_KEY, USER_INFO_KEY } from "../authService";

const baseUser = {
  id: 1,
  username: "user",
  email: "user@example.com",
  firstName: "User",
  lastName: "Example",
  role: "admin",
};

const mockFetch = (options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  jsonData?: unknown;
  textData?: string;
}) => {
  const json = vi.fn().mockResolvedValue(options.jsonData ?? {});
  const text = vi.fn().mockResolvedValue(options.textData ?? "");
  const response = {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    statusText: options.statusText ?? "",
    json,
    text,
  };
  const fetchMock = vi.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe("authService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores token and user info on login success", async () => {
    mockFetch({
      ok: true,
      jsonData: {
        token: "token-123",
        user: baseUser,
      },
    });

    const result = await authService.login("user@example.com", "secret");

    expect(result.token).toBe("token-123");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("token-123");
    expect(localStorage.getItem(USER_INFO_KEY)).toContain("user@example.com");
  });

  it("throws on login failure", async () => {
    mockFetch({
      ok: false,
      jsonData: { error: "Invalid credentials" },
    });

    await expect(authService.login("user@example.com", "bad")).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("returns false when verifyToken has no token", async () => {
    const result = await authService.verifyToken();
    expect(result).toBe(false);
  });

  it("returns true when verifyToken succeeds", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { valid: true },
    });

    const result = await authService.verifyToken();
    expect(result).toBe(true);
  });

  it("returns false when verifyToken fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false });

    const result = await authService.verifyToken();
    expect(result).toBe(false);
  });

  it("returns false when verifyToken throws", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("boom")) as unknown as typeof fetch;

    const result = await authService.verifyToken();
    expect(result).toBe(false);
  });

  it("logout clears stored auth data", () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(baseUser));

    authService.logout();

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_INFO_KEY)).toBeNull();
  });

  it("getUserInfo and role helpers read stored user", () => {
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(baseUser));

    expect(authService.getUserInfo()?.email).toBe("user@example.com");
    expect(authService.hasRole("admin")).toBe(true);
    expect(authService.hasAnyRole()).toBe(true);
  });

  it("createUser sends auth header and returns response", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({
      ok: true,
      jsonData: { token: "new-token", user: baseUser },
    });

    const result = await authService.createUser({
      email: "new@example.com",
      password: "secret",
      firstName: "New",
      lastName: "User",
      role: "admin",
    });

    expect(result.token).toBe("new-token");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("createUser throws on error response", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "create failed" },
    });

    await expect(
      authService.createUser({
        email: "new@example.com",
        password: "secret",
        firstName: "New",
        lastName: "User",
        role: "admin",
      }),
    ).rejects.toThrow("create failed");
  });

  it("editUser sends payload and returns user data", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({
      ok: true,
      jsonData: { user: baseUser },
    });

    const result = await authService.editUser(1, {
      firstName: "New",
      lastName: "Name",
      email: "user@example.com",
      password: "secret",
      role: "admin",
    });

    expect(result.email).toBe("user@example.com");
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.password).toBe("secret");
  });

  it("editUser throws on error response", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "edit failed" },
    });

    await expect(
      authService.editUser(1, { firstName: "New" }),
    ).rejects.toThrow("edit failed");
  });

  it("deleteUser throws without token", async () => {
    await expect(authService.deleteUser(1)).rejects.toThrow(
      "No hay token de autenticaci",
    );
  });

  it("deleteUser throws on error response", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "delete failed" },
    });

    await expect(authService.deleteUser(1)).rejects.toThrow("delete failed");
  });

  it("refreshUserInfo stores updated user info", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: baseUser,
    });

    const result = await authService.refreshUserInfo();

    expect(result.email).toBe("user@example.com");
    expect(localStorage.getItem(USER_INFO_KEY)).toContain("user@example.com");
  });

  it("refreshUserInfo calls logout on 401 responses", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const logoutSpy = vi.spyOn(authService, "logout").mockImplementation(() => {});
    mockFetch({
      ok: false,
      status: 401,
      jsonData: { error: "unauthorized" },
    });

    await expect(authService.refreshUserInfo()).rejects.toThrow(
      "Error al obtener",
    );
    expect(logoutSpy).toHaveBeenCalledOnce();
  });

  it("getUsersWithRoles returns users list", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { users: [baseUser] },
    });

    const result = await authService.getUsersWithRoles();
    expect(result).toHaveLength(1);
  });

  it("getUsersWithRoles throws without token", async () => {
    await expect(authService.getUsersWithRoles()).rejects.toThrow(
      "No hay token de autenticaci",
    );
  });

  it("refreshToken stores new token and user info", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { token: "new-token", user: baseUser },
    });

    const result = await authService.refreshToken();
    expect(result.token).toBe("new-token");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("new-token");
  });

  it("refreshToken throws without token", async () => {
    await expect(authService.refreshToken()).rejects.toThrow(
      "No hay token de autenticaci",
    );
  });
});
