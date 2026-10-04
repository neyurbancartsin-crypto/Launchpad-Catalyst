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

const { GET } = await import("../consented-emails/route");

const originalAdminEmails = process.env.ADMIN_EMAILS;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "owner@example.com";
  mockAuth.mockResolvedValue({ user: { email: "owner@example.com" } });
});

afterEach(() => {
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("GET /api/admin/feedback/consented-emails", () => {
  it("404s a non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { email: "someone-else@example.com" } });

    const response = await GET();

    expect(response.status).toBe(404);
    expect(prismaMocks.feedbackFindMany).not.toHaveBeenCalled();
  });

  it("queries only consented, distinct emails — never the non-consenting", async () => {
    prismaMocks.feedbackFindMany.mockResolvedValue([{ email: "a@example.com" }, { email: "b@example.com" }]);

    const response = await GET();
    const body = await response.text();

    expect(prismaMocks.feedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { consent: true },
        select: { email: true },
        distinct: ["email"],
      }),
    );
    expect(body).toContain("a@example.com");
    expect(body).toContain("b@example.com");
  });
});
