import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth, type AuthContextType } from "../AuthContext";
import { authService, TOKEN_KEY } from "../../services/authService";

const baseUser = {
  id: 1,
  username: "user",
  email: "user@example.com",
  firstName: "User",
  lastName: "Example",
  role: "admin",
};

const base64Url = (value: unknown) =>
  Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const makeToken = (expSeconds: number) => {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({ exp: expSeconds });
  return `${header}.${payload}.`;
};

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("throws when useAuth is called outside provider", () => {
    const Component = () => {
      useAuth();
      return null;
    };

    expect(() => renderToString(<Component />)).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });

  it("exposes auth actions from provider", async () => {
    let captured: AuthContextType | null = null;
    const Capture = () => {
      captured = useAuth();
      return null;
    };

    renderToString(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );

    expect(captured).not.toBeNull();
    expect(captured?.hasAnyRole()).toBe(false);

    const loginSpy = vi
      .spyOn(authService, "login")
      .mockResolvedValue({ token: "token-123", user: baseUser });

    const logoutSpy = vi
      .spyOn(authService, "logout")
      .mockImplementation(() => {});

    const refreshTokenSpy = vi
      .spyOn(authService, "refreshToken")
      .mockResolvedValue({ token: "token-456", user: baseUser });

    const refreshUserInfoSpy = vi
      .spyOn(authService, "refreshUserInfo")
      .mockResolvedValue(baseUser);

    const user = await captured!.login("user@example.com", "secret");
    expect(user?.email).toBe("user@example.com");
    expect(loginSpy).toHaveBeenCalledOnce();

    await captured!.logout();
    expect(logoutSpy).toHaveBeenCalledOnce();

    const exp = Math.floor((Date.now() + 60_000) / 1000);
    localStorage.setItem(TOKEN_KEY, makeToken(exp));

    const refreshed = await captured!.refreshUserInfo();
    expect(refreshed?.email).toBe("user@example.com");
    expect(refreshTokenSpy).toHaveBeenCalledOnce();
    expect(refreshUserInfoSpy).toHaveBeenCalledOnce();
  });
});
