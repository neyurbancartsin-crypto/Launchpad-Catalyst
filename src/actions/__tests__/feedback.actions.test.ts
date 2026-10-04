import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockRequireAdmin, prismaMocks } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
  prismaMocks: {
    feedbackCreate: vi.fn(),
    feedbackUpdate: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    feedback: {
      create: prismaMocks.feedbackCreate,
      update: prismaMocks.feedbackUpdate,
    },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/admin", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { submitFeedbackAction, updateFeedbackStatusAction } = await import("../feedback.actions");

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validFields = {
  name: "Jamie Founder",
  email: "jamie@example.com",
  type: "SUGGESTION",
  message: "It would help to filter opportunities by community size.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
  prismaMocks.feedbackCreate.mockResolvedValue({ id: "fb-1" });
  prismaMocks.feedbackUpdate.mockResolvedValue({ id: "fb-1" });
});

describe("submitFeedbackAction", () => {
  it("stores valid feedback and reports success", async () => {
    const result = await submitFeedbackAction({}, formData(validFields));

    expect(result).toEqual({ ok: true });
    expect(prismaMocks.feedbackCreate).toHaveBeenCalledTimes(1);
    const data = prismaMocks.feedbackCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: null,
      name: "Jamie Founder",
      email: "jamie@example.com",
      type: "SUGGESTION",
      consent: false,
    });
  });

  it("attaches the signed-in user's id when a session exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-42", email: "jamie@example.com" } });

    await submitFeedbackAction({}, formData(validFields));

    expect(prismaMocks.feedbackCreate.mock.calls[0][0].data.userId).toBe("user-42");
  });

  it("records consent only when the checkbox was checked", async () => {
    await submitFeedbackAction({}, formData({ ...validFields, consent: "on" }));

    expect(prismaMocks.feedbackCreate.mock.calls[0][0].data.consent).toBe(true);
  });

  it("rejects a missing name without touching the database", async () => {
    const result = await submitFeedbackAction({}, formData({ ...validFields, name: "" }));

    expect(result.error).toBeTruthy();
    expect(prismaMocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    const result = await submitFeedbackAction({}, formData({ ...validFields, email: "not-an-email" }));

    expect(result.error).toMatch(/valid email/i);
    expect(prismaMocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown feedback type", async () => {
    const result = await submitFeedbackAction({}, formData({ ...validFields, type: "SPAM" }));

    expect(result.error).toBeTruthy();
    expect(prismaMocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects a too-short message", async () => {
    const result = await submitFeedbackAction({}, formData({ ...validFields, message: "hi" }));

    expect(result.error).toBeTruthy();
    expect(prismaMocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects a message over the length limit", async () => {
    const result = await submitFeedbackAction(
      {},
      formData({ ...validFields, message: "x".repeat(4001) }),
    );

    expect(result.error).toBeTruthy();
    expect(prismaMocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("lowercases the stored email", async () => {
    await submitFeedbackAction({}, formData({ ...validFields, email: "Jamie@Example.COM" }));

    expect(prismaMocks.feedbackCreate.mock.calls[0][0].data.email).toBe("jamie@example.com");
  });
});

describe("updateFeedbackStatusAction", () => {
  it("requires admin before touching the database", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(
      updateFeedbackStatusAction(formData({ feedbackId: "fb-1", status: "DONE" })),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(prismaMocks.feedbackUpdate).not.toHaveBeenCalled();
  });

  it("updates the status once admin access is confirmed", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "owner@example.com" });

    await updateFeedbackStatusAction(formData({ feedbackId: "fb-1", status: "PLANNED" }));

    expect(prismaMocks.feedbackUpdate).toHaveBeenCalledWith({
      where: { id: "fb-1" },
      data: { status: "PLANNED" },
    });
  });

  it("does nothing for an invalid status value", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "owner@example.com" });

    await updateFeedbackStatusAction(formData({ feedbackId: "fb-1", status: "ARCHIVED" }));

    expect(prismaMocks.feedbackUpdate).not.toHaveBeenCalled();
  });
});
