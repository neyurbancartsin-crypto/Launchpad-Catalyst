import { describe, expect, it } from "vitest";
import {
  formatCooldown,
  manualDiscoveryAvailableAt,
  MANUAL_DISCOVERY_COOLDOWN_HOURS,
} from "../discovery-cooldown";

describe("manualDiscoveryAvailableAt", () => {
  it("is available immediately for a project that has never been synced", () => {
    expect(manualDiscoveryAvailableAt(null)).toBeNull();
  });

  it("is in cooldown right after a sync", () => {
    const availableAt = manualDiscoveryAvailableAt(new Date());
    expect(availableAt).not.toBeNull();
    expect(availableAt!.getTime()).toBeGreaterThan(Date.now());
  });

  // Test 4: a discovery becomes eligible again after exactly the cooldown window.
  it("is available again once the full cooldown window has elapsed", () => {
    const justOverSixHoursAgo = new Date(
      Date.now() - (MANUAL_DISCOVERY_COOLDOWN_HOURS * 60 * 60 * 1000 + 1000),
    );
    expect(manualDiscoveryAvailableAt(justOverSixHoursAgo)).toBeNull();
  });

  it("is still in cooldown one second before the window elapses", () => {
    const justUnderSixHoursAgo = new Date(
      Date.now() - (MANUAL_DISCOVERY_COOLDOWN_HOURS * 60 * 60 * 1000 - 1000),
    );
    expect(manualDiscoveryAvailableAt(justUnderSixHoursAgo)).not.toBeNull();
  });

  it("is independent of discoveryIntervalHours — a fixed product constant", () => {
    // There is no `discoveryIntervalHours` parameter at all: this function's
    // signature only takes `lastSyncedAt`, so a project's separate
    // auto-discovery interval setting cannot affect it even indirectly.
    expect(MANUAL_DISCOVERY_COOLDOWN_HOURS).toBe(6);
  });
});

describe("formatCooldown", () => {
  it("formats hours and minutes", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const availableAt = new Date("2026-01-01T05:42:00Z");
    expect(formatCooldown(availableAt, now)).toBe("5h 42m");
  });

  it("omits hours once under an hour remains", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const availableAt = new Date("2026-01-01T00:42:00Z");
    expect(formatCooldown(availableAt, now)).toBe("42m");
  });

  it("never goes negative for a past availableAt", () => {
    const now = new Date("2026-01-01T06:00:00Z");
    const availableAt = new Date("2026-01-01T00:00:00Z");
    expect(formatCooldown(availableAt, now)).toBe("0m");
  });
});
