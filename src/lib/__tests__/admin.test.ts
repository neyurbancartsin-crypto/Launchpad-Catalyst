import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockNotFound } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/navigation", () => ({ notFound: mockNotFound }));

const { isAdminEmail, requireAdmin } = await import("../admin");

const originalAdminEmails = process.env.ADMIN_EMAILS;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "owner@example.com, Second@Example.com";
});

afterEach(() => {
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("isAdminEmail", () => {
  it("matches an email in the allowlist", () => {
    expect(isAdminEmail("owner@example.com")).toBe(true);
  });

  it("is case-insensitive on both sides", () => {
    expect(isAdminEmail("OWNER@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
  });

  it("rejects an email not in the allowlist", () => {
    expect(isAdminEmail("someone-else@example.com")).toBe(false);
  });

  it("rejects null/undefined/empty", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("treats an unset ADMIN_EMAILS as nobody being admin, not everybody", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("owner@example.com")).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns the user for an admin session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "owner@example.com" } });

    const result = await requireAdmin();

    expect(result).toEqual({ id: "user-1", email: "owner@example.com" });
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("404s a signed-in non-admin rather than redirecting (never confirms the route exists)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2", email: "someone-else@example.com" } });

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("404s when there is no session at all", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
