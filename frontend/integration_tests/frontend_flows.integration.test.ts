import { beforeEach, describe, expect, it, vi } from "vitest";

import { authService, API_URL, TOKEN_KEY } from "../src/services/authService";
import behaviorAnalysisService from "../src/services/behaviorAnalysisService";
import blockedPagesService from "../src/services/blockedPagesService";
import eventService from "../src/services/eventService";
import evaluatorService from "../src/services/evaluatorService";
import evaluationService from "../src/services/evaluationService";
import monitoringService from "../src/services/monitoringService";
import { participantService } from "../src/services/participantService";
import { profileService } from "../src/services/profileService";

type FetchConfig = {
  ok: boolean;
  status?: number;
  statusText?: string;
  jsonData?: unknown;
  textData?: string;
  blobData?: Blob;
};

type RouteMap = Record<string, FetchConfig | FetchConfig[]>;

const buildResponse = (config: FetchConfig) => {
  const defaultBlob =
    typeof Blob !== "undefined"
      ? new Blob(["data"], { type: "text/plain" })
      : ({} as Blob);
  return {
    ok: config.ok,
    status: config.status ?? (config.ok ? 200 : 500),
    statusText: config.statusText ?? "",
    json: vi.fn().mockResolvedValue(config.jsonData ?? {}),
    text: vi.fn().mockResolvedValue(config.textData ?? ""),
    blob: vi.fn().mockResolvedValue(config.blobData ?? defaultBlob),
  };
};

const createFetchMock = (routes: RouteMap) => {
  const fetchMock = vi.fn().mockImplementation((input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input.toString();
    const key = `${method} ${url}`;
    const route = routes[key];
    if (!route) {
      throw new Error(`No mock for ${key}`);
    }
    const config = Array.isArray(route) ? route.shift() : route;
    if (!config) {
      throw new Error(`No mock configured for ${key}`);
    }
    return Promise.resolve(buildResponse(config));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const findCall = (fetchMock: ReturnType<typeof vi.fn>, method: string, url: string) =>
  fetchMock.mock.calls.find((call) => {
    const [input, init] = call;
    const callMethod = (init?.method ?? "GET").toUpperCase();
    const callUrl = typeof input === "string" ? input : input.toString();
    return callMethod === method && callUrl === url;
  });

const getAuthHeader = (init?: { headers?: Record<string, string> }) => {
  const headers = init?.headers;
  if (!headers) {
    return undefined;
  }
  return headers.Authorization ?? headers.authorization;
};

class FormDataMock {
  private entries: Record<string, unknown> = {};

  append(key: string, value: unknown) {
    this.entries[key] = value;
  }
}

describe("frontend integration flows", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.FormData = FormDataMock as unknown as typeof FormData;
  });

  it("runs auth + events + evaluations flow", async () => {
    const token = "token-123";
    const baseUser = {
      id: 1,
      username: "admin",
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    };
    const routes: RouteMap = {
      [`POST ${API_URL}/auth/login/`]: {
        ok: true,
        jsonData: { token, user: baseUser },
      },
      [`POST ${API_URL}/events/api/events`]: {
        ok: true,
        jsonData: { id: "evt-1" },
      },
      [`GET ${API_URL}/events/api/events`]: {
        ok: true,
        jsonData: { events: [{ id: "evt-1", name: "Evento 1" }] },
      },
      [`GET ${API_URL}/events/api/events/evt-1`]: {
        ok: true,
        jsonData: { event: { id: "evt-1", blockedWebsites: [] } },
      },
      [`GET ${API_URL}/events/api/evaluations`]: {
        ok: true,
        jsonData: { evaluaciones: [{ id: "evt-1", name: "Eval 1" }] },
      },
      [`GET ${API_URL}/events/api/evaluations/evt-1`]: {
        ok: true,
        jsonData: { event: { id: "evt-1", participants: [] } },
      },
    };
    const fetchMock = createFetchMock(routes);

    const auth = await authService.login("admin@example.com", "secret");
    expect(auth.token).toBe(token);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);

    const eventPayload = {
      eventName: "Evento 1",
      description: "Descripcion de prueba",
      startDate: "2025-01-01",
      evaluator: "1",
      participants: [],
      timezone: "UTC",
      startTime: "09:00",
      closeTime: "10:00",
      duration: 60,
      blockedWebsites: [],
    };
    const created = await eventService.createEvent(eventPayload);
    expect(created.id).toBe("evt-1");

    const events = await eventService.getEvents();
    expect(events).toHaveLength(1);

    const detail = await eventService.getEventDetails("evt-1");
    expect(detail).toEqual({ event: { id: "evt-1", blockedWebsites: [] } });

    const evaluations = await evaluationService.getEvaluations();
    expect(evaluations).toHaveLength(1);

    const evaluationDetail = await evaluationService.getEvaluationDetails("evt-1");
    expect(evaluationDetail?.id).toBe("evt-1");

    const createCall = findCall(fetchMock, "POST", `${API_URL}/events/api/events`);
    expect(getAuthHeader(createCall?.[1])).toBe(`Bearer ${token}`);

    const evaluationsCall = findCall(
      fetchMock,
      "GET",
      `${API_URL}/events/api/evaluations`,
    );
    expect(getAuthHeader(evaluationsCall?.[1])).toBe(`Bearer ${token}`);
  });

  it("runs monitoring + behavior analysis flow", async () => {
    const token = "token-456";
    const routes: RouteMap = {
      [`POST ${API_URL}/auth/login/`]: {
        ok: true,
        jsonData: {
          token,
          user: {
            id: 2,
            username: "monitor",
            email: "monitor@example.com",
            firstName: "Monitor",
            lastName: "User",
            role: "admin",
          },
        },
      },
      [`GET ${API_URL}/events/api/events/evt-9/participants/pt-1/logs/`]: {
        ok: true,
        jsonData: {
          event: { id: 9, name: "Evento 9" },
          logs: [{ id: 1, name: "screen", message: "ok" }],
          total: 1,
        },
      },
      [`GET ${API_URL}/events/api/events/evt-9/participants/pt-1/connection-stats/`]: {
        ok: true,
        jsonData: {
          participant: { id: 1, name: "P1", email: "p1@example.com" },
          total_time_seconds: 615,
          monitoring_is_active: true,
          monitoring_last_change: null,
          monitoring_sessions_count: 2,
        },
      },
      [`GET ${API_URL}/analysis/status/evt-9/participants/pt-1/`]: {
        ok: true,
        jsonData: {
          event: { id: 9, name: "Evento 9" },
          participant: { id: 1, name: "P1", email: "p1@example.com" },
          analysis: { id: 10, status: "completado", video_link: "key", fecha_procesamiento: null },
        },
      },
      [`GET ${API_URL}/analysis/report/evt-9/participants/pt-1/`]: {
        ok: true,
        jsonData: {
          event: { id: 9, name: "Evento 9", duration: 30 },
          participant: { id: 1, name: "P1", email: "p1@example.com" },
          analysis: { id: 10, status: "completado", video_link: "key", fecha_procesamiento: "now" },
          statistics: {
            total_rostros_detectados: 1,
            total_gestos: 0,
            total_anomalias_iluminacion: 0,
            total_anomalias_voz: 0,
            total_hablantes: 0,
            total_anomalias_lipsync: 0,
            total_ausencias: 0,
            tiempo_total_ausencia_segundos: 0,
            total_screenshots: 1,
            total_videos: 1,
            total_blocked_requests: 0,
            total_proxy_disconnections: 0,
          },
          registros: {
            rostros: [],
            gestos: [],
            iluminacion: [],
            voz: [],
            lipsync: [],
            ausencias: [],
          },
          activity_logs: { screenshots: [], blocked_requests: [] },
          monitoring: { total_duration_seconds: 600, sessions_count: 2, last_change: null },
        },
      },
    };
    const fetchMock = createFetchMock(routes);

    await authService.login("monitor@example.com", "secret");

    const logs = await monitoringService.getEventLogs("evt-9", "pt-1");
    expect(logs.total).toBe(1);

    const stats = await monitoringService.getParticipantConnectionStats("evt-9", "pt-1");
    expect(stats.monitoring_is_active).toBe(true);

    const status = await behaviorAnalysisService.getAnalysisStatus("evt-9", "pt-1");
    expect(status.analysis.status).toBe("completado");

    const report = await behaviorAnalysisService.getAnalysisReport("evt-9", "pt-1");
    expect(report.statistics.total_videos).toBe(1);

    const logsCall = findCall(
      fetchMock,
      "GET",
      `${API_URL}/events/api/events/evt-9/participants/pt-1/logs/`,
    );
    expect(getAuthHeader(logsCall?.[1])).toBe(`Bearer ${token}`);
  });

  it("runs blocked pages + participant actions flow", async () => {
    const token = "token-789";
    const routes: RouteMap = {
      [`POST ${API_URL}/auth/login/`]: {
        ok: true,
        jsonData: {
          token,
          user: {
            id: 3,
            username: "blocks",
            email: "blocks@example.com",
            firstName: "Blocks",
            lastName: "User",
            role: "admin",
          },
        },
      },
      [`POST ${API_URL}/events/api/websites/`]: {
        ok: true,
        jsonData: { id: "site-1", hostname: "example.com" },
      },
      [`GET ${API_URL}/events/api/websites/`]: {
        ok: true,
        jsonData: { websites: [{ id: "site-1", hostname: "example.com" }] },
      },
      [`GET ${API_URL}/events/api/evt-1/blocked-hosts/`]: {
        ok: true,
        jsonData: { blocked_website_ids: ["site-1"] },
      },
      [`POST ${API_URL}/events/api/evt-1/notify-proxy-update/`]: {
        ok: true,
        jsonData: { success: true },
      },
      [`POST ${API_URL}/events/api/events/evt-1/participants/block`]: {
        ok: true,
        jsonData: { success: true },
      },
      [`POST ${API_URL}/events/api/events/evt-1/participants/unblock`]: {
        ok: true,
        jsonData: { success: true },
      },
    };
    const fetchMock = createFetchMock(routes);

    await authService.login("blocks@example.com", "secret");

    const created = await blockedPagesService.createWebsite("example.com");
    expect(created.id).toBe("site-1");

    const websites = await blockedPagesService.getWebsites();
    expect(websites).toHaveLength(1);

    const blocked = await blockedPagesService.getEventBlockedHosts("evt-1");
    expect(blocked).toEqual(["site-1"]);

    await blockedPagesService.notifyProxyUpdate("evt-1");

    await eventService.blockParticipants("evt-1", ["p1"]);
    await eventService.unblockParticipants("evt-1", ["p1"]);

    const blockCall = findCall(
      fetchMock,
      "POST",
      `${API_URL}/events/api/events/evt-1/participants/block`,
    );
    const blockBody = JSON.parse(blockCall?.[1]?.body as string);
    expect(blockBody.participant_ids).toEqual(["p1"]);

    const unblockCall = findCall(
      fetchMock,
      "POST",
      `${API_URL}/events/api/events/evt-1/participants/unblock`,
    );
    const unblockBody = JSON.parse(unblockCall?.[1]?.body as string);
    expect(unblockBody.participant_ids).toEqual(["p1"]);
  });

  it("runs user profile + participants management flow", async () => {
    const token = "token-999";
    const routes: RouteMap = {
      [`POST ${API_URL}/auth/login/`]: {
        ok: true,
        jsonData: {
          token,
          user: {
            id: 10,
            username: "admin",
            email: "admin@example.com",
            firstName: "Admin",
            lastName: "User",
            role: "admin",
          },
        },
      },
      [`POST ${API_URL}/auth/update-profile/`]: {
        ok: true,
        jsonData: { success: true },
      },
      [`GET ${API_URL}/auth/roles/`]: {
        ok: true,
        jsonData: { users: [{ id: 20, email: "user@example.com", role: "admin" }] },
      },
      [`POST ${API_URL}/auth/create-user/`]: {
        ok: true,
        jsonData: {
          token: "created-token",
          user: { id: 20, email: "user@example.com", role: "admin" },
        },
      },
      [`POST ${API_URL}/auth/edit-user/20/`]: {
        ok: true,
        jsonData: { user: { id: 20, email: "user@example.com", role: "admin" } },
      },
      [`DELETE ${API_URL}/auth/delete-user/20/`]: {
        ok: true,
        jsonData: { success: true },
      },
      [`GET ${API_URL}/auth/users`]: {
        ok: true,
        jsonData: { users: [{ id: "2", name: "Evaluator" }] },
      },
      [`POST ${API_URL}/events/api/participants`]: {
        ok: true,
        jsonData: { id: "p1", name: "Participant One" },
      },
      [`GET ${API_URL}/events/api/participants?search=ana`]: {
        ok: true,
        jsonData: {
          participants: [{ id: "p1", name: "Participant One", email: "ana@example.com" }],
        },
      },
      [`GET ${API_URL}/events/api/participants/p1`]: {
        ok: true,
        jsonData: { participant: { id: "p1", first_name: "Ana" } },
      },
      [`PUT ${API_URL}/events/api/participants/p1`]: {
        ok: true,
        jsonData: { success: true },
      },
      [`PUT ${API_URL}/events/api/participants/p1/status`]: {
        ok: true,
        jsonData: { message: "ok", status: "active" },
      },
      [`DELETE ${API_URL}/events/api/participants/p1`]: {
        ok: true,
        jsonData: { message: "deleted" },
      },
      [`GET ${API_URL}/events/api/participants/export`]: {
        ok: true,
      },
      [`POST ${API_URL}/events/api/participants/import`]: {
        ok: true,
        jsonData: { success: true, created: 1 },
      },
    };
    const fetchMock = createFetchMock(routes);

    await authService.login("admin@example.com", "secret");

    await profileService.updateProfile({
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
    });

    const users = await authService.getUsersWithRoles();
    expect(users).toHaveLength(1);

    await authService.createUser({
      email: "user@example.com",
      password: "secret",
      firstName: "User",
      lastName: "Example",
      role: "admin",
    });

    const edited = await authService.editUser(20, { firstName: "User" });
    expect(edited.id).toBe(20);

    await authService.deleteUser(20);

    const evaluators = await evaluatorService.getEvaluators();
    expect(evaluators).toHaveLength(1);

    const createdParticipant = await participantService.createParticipant({
      first_name: "Ana",
      last_name: "One",
      email: "ana@example.com",
    });
    expect(createdParticipant.id).toBe("p1");

    const participants = await participantService.getParticipants("ana");
    expect(participants).toHaveLength(1);

    const detail = await participantService.getParticipantDetails("p1");
    expect(detail.id).toBe("p1");

    await participantService.updateParticipant("p1", {
      first_name: "Ana",
      last_name: "One",
      email: "ana@example.com",
    });

    const status = await participantService.updateParticipantStatus("p1", "active");
    expect(status.status).toBe("active");

    const exported = await participantService.exportParticipants();
    expect(exported).toBeInstanceOf(Blob);

    const imported = await participantService.importParticipants(
      { name: "participants.xlsx" } as File,
    );
    expect(imported.success).toBe(true);

    const deleted = await participantService.deleteParticipant("p1");
    expect(deleted.message).toBe("deleted");

    const profileCall = findCall(fetchMock, "POST", `${API_URL}/auth/update-profile/`);
    expect(getAuthHeader(profileCall?.[1])).toBe(`Bearer ${token}`);
  });
});
