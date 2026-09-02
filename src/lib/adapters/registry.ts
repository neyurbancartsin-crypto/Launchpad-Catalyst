import type { Platform } from "@prisma/client";
import type { ConnectionStatus, PlatformAdapter } from "./types";
import { MockRedditAdapter } from "./reddit/mock-reddit-adapter";
import { RedditAdapter } from "./reddit/reddit-adapter";
import { MockXAdapter } from "./x/mock-x-adapter";
import { MockLinkedInAdapter } from "./linkedin/mock-linkedin-adapter";

export const SUPPORTED_PLATFORMS: Platform[] = ["REDDIT", "X", "LINKEDIN"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  REDDIT: "Reddit",
  X: "X",
  LINKEDIN: "LinkedIn",
};

const ADAPTER_ENV: Record<Platform, string> = {
  REDDIT: "REDDIT_ADAPTER",
  X: "X_ADAPTER",
  LINKEDIN: "LINKEDIN_ADAPTER",
};

function mode(platform: Platform): string {
  return (process.env[ADAPTER_ENV[platform]] ?? "mock").toLowerCase();
}

/**
 * Resolves the adapter for a platform, honouring the per-platform env var so
 * Reddit can run live while X and LinkedIn stay on demo data.
 *
 * X and LinkedIn have no live implementation yet: their APIs require paid or
 * partner-approved access. Requesting one fails loudly rather than silently
 * serving demo data to an operator who believes they are connected.
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
  }

  throw new Error(
    `${ADAPTER_ENV[platform]}="${configured}" is not supported. ` +
      (platform === "REDDIT"
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
