import { describe, expect, it } from "vitest";
import {
  assessContentQuality,
  isJobPosting,
  isPromotionalPitch,
} from "../content-signals";

describe("isPromotionalPitch", () => {
  it("recognises explicit self-promotion", () => {
    expect(isPromotionalPitch("Check out our new product, it solves this exact problem!")).toBe(
      true,
    );
    expect(isPromotionalPitch("Introducing Workbass — the fastest way to invoice clients")).toBe(
      true,
    );
    expect(isPromotionalPitch("Use code LAUNCH20 for 20% off our tool")).toBe(true);
  });

  it("does not fire on a genuine question", () => {
    expect(
      isPromotionalPitch(
        "I've sent an invoice to my client three weeks ago and still haven't been paid. How do you guys track overdue invoices?",
      ),
    ).toBe(false);
  });
});

describe("isJobPosting", () => {
  it("recognises hiring posts", () => {
    expect(isJobPosting("We're hiring a senior support engineer, apply now")).toBe(true);
    expect(isJobPosting("Job opening: customer success manager")).toBe(true);
  });

  it("does not fire on a genuine question", () => {
    expect(isJobPosting("How do you track overdue invoices?")).toBe(false);
  });
});

describe("assessContentQuality", () => {
  it("flags a promotional pitch regardless of a genuine ask nearby", () => {
    const result = assessContentQuality("Check out our new invoicing tool!", false);
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toContain("promotional");
  });

  it("flags a job posting", () => {
    const result = assessContentQuality("We are hiring a support engineer", false);
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toContain("job posting");
  });

  it("flags a generic listicle with no genuine ask attached", () => {
    const result = assessContentQuality(
      "Best free invoice generator for small teams",
      false,
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toContain("listicle");
  });

  it("does not flag a listicle-style phrase when a genuine ask is present", () => {
    const result = assessContentQuality(
      "What's the best free invoice tool? I'm struggling with overdue payments.",
      true,
    );
    expect(result.isLowQuality).toBe(false);
  });

  it("does not flag an ordinary genuine question", () => {
    const result = assessContentQuality(
      "How do you guys track overdue invoices? I'm three weeks behind on one client.",
      true,
    );
    expect(result.isLowQuality).toBe(false);
    expect(result.reason).toBeNull();
  });
});
