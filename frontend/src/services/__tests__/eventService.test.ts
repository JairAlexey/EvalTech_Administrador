import { beforeEach, describe, expect, it, vi } from "vitest";

import { eventService } from "../eventService";
import { TOKEN_KEY } from "../authService";

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

const baseEventData = {
  eventName: "Event",
  description: "Desc",
  startDate: "2025-01-01",
  evaluator: "1",
  participants: [],
  timezone: "UTC",
  startTime: "09:00",
  closeTime: "10:00",
  duration: 60,
  blockedWebsites: [],
};

describe("eventService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns empty list when no auth token", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await eventService.getEvents();

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns events when response is valid", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { events: [{ id: "1", name: "Event" }] },
    });

    const result = await eventService.getEvents();

    expect(result).toHaveLength(1);
  });

  it("returns empty list for invalid events shape", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({ ok: true, jsonData: { other: [] } });

    const result = await eventService.getEvents();

    expect(result).toEqual([]);
  });

  it("returns empty list when response is not ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      status: 500,
      statusText: "Server Error",
      textData: "fail",
    });

    const result = await eventService.getEvents();

    expect(result).toEqual([]);
  });

  it("creates event and returns id", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");

    const fetchMock = mockFetch({
      ok: true,
      jsonData: { id: "event-1" },
    });

    const result = await eventService.createEvent(baseEventData);

    expect(result.id).toBe("event-1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("creates event using fallback eventId field", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { eventId: "event-2" },
    });

    const result = await eventService.createEvent(baseEventData);

    expect(result.id).toBe("event-2");
  });

  it("throws when createEvent response is not ok", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "create failed" },
    });

    await expect(eventService.createEvent(baseEventData)).rejects.toThrow(
      "create failed",
    );
  });

  it("gets event details successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: true,
      jsonData: { event: { id: "1" } },
    });

    const result = await eventService.getEventDetails("1");
    expect(result).toEqual({ event: { id: "1" } });
  });

  it("throws when getEventDetails fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      status: 404,
      statusText: "Not Found",
      textData: "missing",
    });

    await expect(eventService.getEventDetails("404")).rejects.toThrow(
      "Error al obtener detalles del evento",
    );
  });

  it("updates event successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await eventService.updateEvent("1", baseEventData);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when updateEvent fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "update failed" },
    });

    await expect(eventService.updateEvent("1", baseEventData)).rejects.toThrow(
      "update failed",
    );
  });

  it("deletes event successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await eventService.deleteEvent("1");

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when deleteEvent fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "delete failed" },
    });

    await expect(eventService.deleteEvent("1")).rejects.toThrow(
      "delete failed",
    );
  });

  it("sends event emails with participants", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await eventService.sendEventEmails("1", ["p1"]);

    const body = fetchMock.mock.calls[0][1]?.body as string;
    expect(body).toContain("participantIds");
  });

  it("sends event emails without participant list", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await eventService.sendEventEmails("1", []);

    const body = fetchMock.mock.calls[0][1]?.body as string | undefined;
    expect(body).toBeUndefined();
  });

  it("throws when sendEventEmails fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "email failed" },
    });

    await expect(eventService.sendEventEmails("1", ["p1"])).rejects.toThrow(
      "email failed",
    );
  });

  it("blocks participants successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await eventService.blockParticipants("1", ["p1"]);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when blockParticipants fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "block failed" },
    });

    await expect(eventService.blockParticipants("1", ["p1"])).rejects.toThrow(
      "block failed",
    );
  });

  it("unblocks participants successfully", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    const fetchMock = mockFetch({ ok: true, jsonData: {} });

    await eventService.unblockParticipants("1", ["p1"]);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when unblockParticipants fails", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    mockFetch({
      ok: false,
      jsonData: { error: "unblock failed" },
    });

    await expect(eventService.unblockParticipants("1", ["p1"])).rejects.toThrow(
      "unblock failed",
    );
  });
});
