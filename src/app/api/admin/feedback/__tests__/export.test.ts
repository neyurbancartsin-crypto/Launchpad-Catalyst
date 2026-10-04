import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, prismaMocks } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMocks: {
    feedbackFindMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { feedback: { findMany: prismaMocks.feedbackFindMany } },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET } = await import("../export/route");

const originalAdminEmails = process.env.ADMIN_EMAILS;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "owner@example.com";
  prismaMocks.feedbackFindMany.mockResolvedValue([
    {
      createdAt: new Date("2026-01-01T00:00:00Z"),
      name: "Jamie",
      email: "jamie@example.com",
      type: "BUG_REPORT",
      status: "NEW",
      consent: true,
      message: "Line one\nLine two, with a comma",
    },
  ]);
});

afterEach(() => {
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("GET /api/admin/feedback/export", () => {
  it("404s a non-admin without querying the database", async () => {
    mockAuth.mockResolvedValue({ user: { email: "someone-else@example.com" } });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(prismaMocks.feedbackFindMany).not.toHaveBeenCalled();
  });

  it("404s an unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("returns a CSV attachment for an admin, with values safely escaped", async () => {
    mockAuth.mockResolvedValue({ user: { email: "owner@example.com" } });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(body).toContain("Jamie");
    expect(body).toContain('"Line one\nLine two, with a comma"');
  });
});
