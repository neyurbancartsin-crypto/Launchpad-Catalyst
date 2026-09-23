import type { Platform } from "@prisma/client";

/**
 * DTOs mirror the shape of the real platform APIs (Reddit `ups`/`permalink`,
 * comment `depth`/`parent_id`, etc.) so a live adapter maps 1:1 onto them
 * without any downstream change.
 */

export type AdapterConnectionState = "DEMO" | "CONNECTED" | "ERROR";

/**
 * Thrown by an adapter when the underlying platform's API rate limit has
 * been hit. Discovery treats this as recoverable: it stops issuing further
 * requests to that platform for the rest of the current sync instead of
 * letting the exception abort the whole run and discard work already done,
 * and surfaces `retryAt` (when the platform reports one) so the reason is
 * diagnosable rather than a generic failure.
 */
export class PlatformRateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAt: Date | null = null,
  ) {
    super(message);
    this.name = "PlatformRateLimitError";
  }
}

export interface ConnectionStatus {
  platform: Platform;
  status: AdapterConnectionState;
  /** Founder-facing explanation. Never claims a live connection that isn't there. */
  message: string;
  /** True when results originate from bundled demo fixtures rather than a live API. */
  isDemoData: boolean;
}

export interface CommunityDTO {
  /** Platform-native identifier: subreddit name, X topic id, LinkedIn group id. */
  externalId: string;
  name: string;
  url: string;
  description: string;
  memberCount: number | null;
  /** How strictly the community polices self-promotion. Feeds promotion-risk scoring. */
  selfPromoRules: "strict" | "moderate" | "lenient";
  /** Topics/keywords this community is known for; used for relevance matching. */
  topics: string[];
  isDemoData: boolean;
}

export interface PostDTO {
  externalId: string;
  communityExternalId: string;
  title: string;
  body: string;
  author: string;
  url: string;
  upvotes: number;
  commentCount: number;
  createdAt: Date;
  isDemoData: boolean;
}

export interface CommentDTO {
  externalId: string;
  parentExternalId: string | null;
  postExternalId: string;
  author: string;
  body: string;
  upvotes: number;
  depth: number;
  isOp: boolean;
  createdAt: Date;
}

export interface ConversationContextDTO {
  post: PostDTO;
  comments: CommentDTO[];
}

export interface DiscoveryQuery {
  /** ICP-derived search topics. */
  keywords: string[];
  /** Phrases that signal buying/solution intent (PRD s6). */
  intentSignals?: string[];
  limit?: number;
}

/**
 * Every platform integration implements this interface. Application code only
 * ever talks to `PlatformAdapter` — never to a concrete Reddit/X/LinkedIn client.
 */
export interface PlatformAdapter {
  readonly platform: Platform;

  /**
   * Upper bound on how many discovered communities a sync should run
   * `searchPosts` against, for adapters whose search endpoint has a rate
   * limit too tight to query every discovered community (e.g. GitHub's
   * Search API). When set, discovery searches only the most ICP-relevant
   * communities up to this count. Adapters that leave it undefined have
   * every discovered community searched, as before.
   */
  readonly maxCommunitiesPerSync?: number;

  getConnectionStatus(): Promise<ConnectionStatus>;

  discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]>;

  searchPosts(
    communityExternalId: string,
    query: DiscoveryQuery,
  ): Promise<PostDTO[]>;

  getPostDetails(externalPostId: string): Promise<PostDTO | null>;

  /**
   * Retrieving comments is a core P0 requirement (PRD s32), not an optional
   * extra — the conversation-analysis layer depends on it.
   */
  getComments(externalPostId: string): Promise<CommentDTO[]>;

  getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null>;
}
