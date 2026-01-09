import { beforeEach, describe, expect, it, vi } from "vitest";

import { participantService } from "../participantService";
import { TOKEN_KEY } from "../authService";

class FormDataMock {
  private entries: Record<string, unknown> = {};

  append(key: string, value: unknown) {
    this.entries[key] = value;
  }
}

const mockFetch = (options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  jsonData?: unknown;
  textData?: string;
  blobData?: Blob;
}) => {
  const response = {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    statusText: options.statusText ?? "",
    json: vi.fn().mockResolvedValue(options.jsonData ?? {}),
    text: vi.fn().mockResolvedValue(options.textData ?? ""),
    blob: vi.fn().mockResolvedValue(
      options.blobData ?? new Blob(["data"], { type: "text/plain" }),
    ),
  };
  const fetchMock = vi.fn().mockResolvedValue(response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe("participantService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.FormData = FormDataMock as unknown as typeof FormData;
  });

  it("gets participants list", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({
      ok: true,
      jsonData: { participants: [{ id: "1", name: "P" }] },
    });

    const result = await participantService.getParticipants("test");
    expect(result).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain("search=test");
  });

  it("throws when getParticipants fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: false, jsonData: { error: "fetch failed" } });

    await expect(participantService.getParticipants()).rejects.toThrow(
      "fetch failed",
    );
  });

  it("creates participant successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { id: "1", name: "P" } });

    const result = await participantService.createParticipant({
      first_name: "P",
      last_name: "One",
      email: "p@example.com",
    });

    expect(result.id).toBe("1");
  });

  it("gets participant details", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { participant: { id: "1", first_name: "P" } },
    });

    const result = await participantService.getParticipantDetails("1");
    expect(result.id).toBe("1");
  });

  it("updates participant successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await participantService.updateParticipant("1", {
      first_name: "P",
      last_name: "One",
      email: "p@example.com",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("updates participant status", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { message: "ok", status: "done" } });

    const result = await participantService.updateParticipantStatus("1", "done");
    expect(result.status).toBe("done");
  });

  it("deletes participant successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { message: "ok" } });

    const result = await participantService.deleteParticipant("1");
    expect(result.message).toBe("ok");
  });

  it("exports participants", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const blob = new Blob(["data"], { type: "text/plain" });
    mockFetch({ ok: true, blobData: blob, jsonData: {} });

    const result = await participantService.exportParticipants();
    expect(result).toBeInstanceOf(Blob);
  });

  it("imports participants when response is ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { success: true, created: 1 } });

    const result = await participantService.importParticipants(
      { name: "file.xlsx" } as File,
    );
    expect(result.success).toBe(true);
  });

  it("returns rows when importParticipants gets 400", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      status: 400,
      jsonData: { success: false, rows: [{ row_number: 1 }] },
    });

    const result = await participantService.importParticipants(
      { name: "file.xlsx" } as File,
    );
    expect(result.success).toBe(false);
    expect(result.rows).toHaveLength(1);
  });

  it("throws when importParticipants fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      status: 500,
      jsonData: { error: "import failed" },
    });

    await expect(
      participantService.importParticipants({ name: "file.xlsx" } as File),
    ).rejects.toThrow("import failed");
  });
});
