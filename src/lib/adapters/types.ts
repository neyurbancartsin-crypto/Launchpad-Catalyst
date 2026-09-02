import type { Platform } from "@prisma/client";

/**
 * DTOs mirror the shape of the real platform APIs (Reddit `ups`/`permalink`,
 * comment `depth`/`parent_id`, etc.) so a live adapter maps 1:1 onto them
 * without any downstream change.
 */

export type AdapterConnectionState = "DEMO" | "CONNECTED" | "ERROR";

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
