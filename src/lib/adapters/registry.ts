import type { Platform } from "@prisma/client";
import type { ConnectionStatus, PlatformAdapter } from "./types";
import { MockRedditAdapter } from "./reddit/mock-reddit-adapter";
import { RedditAdapter } from "./reddit/reddit-adapter";
import { MockXAdapter } from "./x/mock-x-adapter";
import { MockLinkedInAdapter } from "./linkedin/mock-linkedin-adapter";
import { MockGitHubAdapter } from "./github/mock-github-adapter";
import { GitHubAdapter } from "./github/github-adapter";
import { MockHackerNewsAdapter } from "./hackernews/mock-hackernews-adapter";
import { HackerNewsAdapter } from "./hackernews/hackernews-adapter";
import { MockStackOverflowAdapter } from "./stackoverflow/mock-stackoverflow-adapter";
import { StackOverflowAdapter } from "./stackoverflow/stackoverflow-adapter";

/**
 * The platforms discovery actually runs against right now.
 *
 * Reddit, X and LinkedIn are deliberately DEFERRED, not removed: their code,
 * fixtures, Prisma enum values, and any existing Community/Opportunity rows
 * all stay intact (see DEFERRED_PLATFORMS below) so re-activating one later
 * is a one-line change here, not a rebuild.
 */
export const SUPPORTED_PLATFORMS: Platform[] = ["GITHUB", "HACKERNEWS", "STACKOVERFLOW"];

/** Kept for Settings to display honestly rather than pretending these never existed. */
export const DEFERRED_PLATFORMS: Platform[] = ["REDDIT", "X", "LINKEDIN"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  REDDIT: "Reddit",
  X: "X",
  LINKEDIN: "LinkedIn",
  GITHUB: "GitHub",
  HACKERNEWS: "Hacker News",
  STACKOVERFLOW: "Stack Overflow",
};

const ADAPTER_ENV: Record<Platform, string> = {
  REDDIT: "REDDIT_ADAPTER",
  X: "X_ADAPTER",
  LINKEDIN: "LINKEDIN_ADAPTER",
  GITHUB: "GITHUB_ADAPTER",
  HACKERNEWS: "HACKERNEWS_ADAPTER",
  STACKOVERFLOW: "STACKOVERFLOW_ADAPTER",
};

function mode(platform: Platform): string {
  return (process.env[ADAPTER_ENV[platform]] ?? "mock").toLowerCase();
}

/**
 * Resolves the adapter for a platform, honouring the per-platform env var.
 *
 * X and LinkedIn have no live implementation at all yet: their APIs require
 * paid or partner-approved access. Requesting one fails loudly rather than
 * silently serving demo data to an operator who believes they are connected.
 */
export function getAdapter(platform: Platform): PlatformAdapter {
  const configured = mode(platform);

  switch (platform) {
    case "REDDIT":
      if (configured === "mock") return new MockRedditAdapter();
      if (configured === "live") return new RedditAdapter();
      break;
    case "X":
      if (configured === "mock") return new MockXAdapter();
      break;
    case "LINKEDIN":
      if (configured === "mock") return new MockLinkedInAdapter();
      break;
    case "GITHUB":
      if (configured === "mock") return new MockGitHubAdapter();
      if (configured === "live") return new GitHubAdapter();
      break;
    case "HACKERNEWS":
      if (configured === "mock") return new MockHackerNewsAdapter();
      if (configured === "live") return new HackerNewsAdapter();
      break;
    case "STACKOVERFLOW":
      if (configured === "mock") return new MockStackOverflowAdapter();
      if (configured === "live") return new StackOverflowAdapter();
      break;
  }

  const liveCapable: Platform[] = ["REDDIT", "GITHUB", "HACKERNEWS", "STACKOVERFLOW"];
  throw new Error(
    `${ADAPTER_ENV[platform]}="${configured}" is not supported. ` +
      (liveCapable.includes(platform)
        ? 'Use "mock" or "live".'
        : `Only "mock" is available — a live ${PLATFORM_LABELS[platform]} adapter is not implemented yet.`),
  );
}

export function getAllAdapters(): PlatformAdapter[] {
  return SUPPORTED_PLATFORMS.map(getAdapter);
}

export async function getConnectionStatuses(): Promise<ConnectionStatus[]> {
  return Promise.all(
    SUPPORTED_PLATFORMS.map(async (platform) => {
      try {
        return await getAdapter(platform).getConnectionStatus();
      } catch (error) {
        return {
          platform,
          status: "ERROR" as const,
          message:
            error instanceof Error ? error.message : "Adapter is misconfigured.",
          isDemoData: false,
        };
      }
    }),
  );
}

/**
 * Platforms with a genuine, verified live connection right now — the same
 * check Settings uses to show "connected" rather than "Demo data". Pages
 * that display stored opportunities use this to keep bundled demo/mock
 * results out of the default view once at least one platform is actually
 * connected, without ever touching what mock adapters themselves return.
 */
export async function getLivePlatforms(): Promise<Platform[]> {
  const statuses = await getConnectionStatuses();
  return statuses
    .filter((status) => status.status === "CONNECTED")
    .map((status) => status.platform);
}

/**
 * Deferred platforms never run discovery, so their status is reported without
 * instantiating an adapter or touching any env var — purely informational.
 */
export function getDeferredPlatformInfo(): {
  platform: Platform;
  label: string;
}[] {
  return DEFERRED_PLATFORMS.map((platform) => ({
    platform,
    label: PLATFORM_LABELS[platform],
  }));
}
