import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { mockFindMany, mockRunDiscoverySync } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockRunDiscoverySync: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { saaSProject: { findMany: mockFindMany } },
}));

vi.mock("@/lib/discovery-run", () => ({
  runDiscoverySync: mockRunDiscoverySync,
}));

const { GET, POST } = await import("../route");

function fakeRequest(headers: Record<string, string> = {}): NextRequest {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
  } as unknown as NextRequest;
}

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    onboardingComplete: true,
    autoDiscoveryEnabled: true,
    discoveryIntervalHours: 6,
    lastAutoDiscoveryAt: null,
    icp: { id: "icp-1" },
    ...overrides,
  };
}

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  mockFindMany.mockResolvedValue([]);
  mockRunDiscoverySync.mockResolvedValue({
    ran: true,
    summary: { discovered: 0, updated: 0, perPlatform: [] },
  });
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("POST/GET /api/cron/discovery - authorization", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await POST(fakeRequest());
    expect(response.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await POST(fakeRequest({ authorization: "Bearer wrong-secret" }));
    expect(response.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("fails closed (503) when CRON_SECRET is not configured at all", async () => {
    delete process.env.CRON_SECRET;
    const response = await POST(fakeRequest({ authorization: "Bearer anything" }));
    expect(response.status).toBe(503);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("accepts a request with the correct secret", async () => {
    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    expect(response.status).toBe(200);
  });

  it("accepts the same secret on GET (Vercel's own cron invocation is a GET)", async () => {
    const response = await GET(fakeRequest({ authorization: "Bearer test-secret" }));
    expect(response.status).toBe(200);
  });

  it("never echoes the secret back in the response body", async () => {
    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("test-secret");
  });
});

describe("POST /api/cron/discovery - eligibility", () => {
  it("skips a project with autoDiscoveryEnabled=false (findMany already filters it out)", async () => {
    mockFindMany.mockResolvedValue([]); // the query itself excludes disabled projects
    await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    expect(mockFindMany.mock.calls[0][0].where.autoDiscoveryEnabled).toBe(true);
  });

  it("skips a project whose interval has not elapsed yet", async () => {
    mockFindMany.mockResolvedValue([
      project({ lastAutoDiscoveryAt: new Date(), discoveryIntervalHours: 6 }),
    ]);

    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(mockRunDiscoverySync).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("not-due");
  });

  it("runs discovery for an eligible project (never run automatically before)", async () => {
    mockFindMany.mockResolvedValue([project({ lastAutoDiscoveryAt: null })]);

    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
    const [, , options] = mockRunDiscoverySync.mock.calls[0];
    expect(options).toEqual({ isAuto: true });
    expect(body.results[0].status).toBe("ok");
  });

  it("runs discovery for a project whose interval has elapsed", async () => {
    const staleTime = new Date(Date.now() - 7 * 60 * 60 * 1000); // 7h ago, interval is 6h
    mockFindMany.mockResolvedValue([
      project({ lastAutoDiscoveryAt: staleTime, discoveryIntervalHours: 6 }),
    ]);

    await POST(fakeRequest({ authorization: "Bearer test-secret" }));

    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(1);
  });

  it("skips a project with no ICP yet without crashing", async () => {
    mockFindMany.mockResolvedValue([project({ icp: null })]);

    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(mockRunDiscoverySync).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("no-icp");
  });

  it("one project's failure does not stop the others from running", async () => {
    mockFindMany.mockResolvedValue([
      project({ id: "project-a" }),
      project({ id: "project-b" }),
    ]);
    mockRunDiscoverySync
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ran: true, summary: { discovered: 1, updated: 0, perPlatform: [] } });

    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(mockRunDiscoverySync).toHaveBeenCalledTimes(2);
    expect(body.results.find((r: { projectId: string }) => r.projectId === "project-a").status).toBe(
      "error",
    );
    expect(body.results.find((r: { projectId: string }) => r.projectId === "project-b").status).toBe(
      "ok",
    );
  });

  it("reports 'locked' when a project is already mid-run (concurrency protection)", async () => {
    mockFindMany.mockResolvedValue([project()]);
    mockRunDiscoverySync.mockResolvedValue({ ran: false, reason: "locked" });

    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = await response.json();

    expect(body.results[0].status).toBe("locked");
  });

  it("never exposes an internal error's stack trace to the response body", async () => {
    mockFindMany.mockResolvedValue([project()]);
    mockRunDiscoverySync.mockRejectedValue(new Error("secret db connection string leaked here"));

    const response = await POST(fakeRequest({ authorization: "Bearer test-secret" }));
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain("secret db connection string");
  });
});
