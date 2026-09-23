import type {
  CommentDTO,
  CommunityDTO,
  ConnectionStatus,
  ConversationContextDTO,
  DiscoveryQuery,
  PlatformAdapter,
  PostDTO,
} from "../types";
import { rankByKeywords } from "../ranking";
import {
  HACKERNEWS_STORIES,
  toHackerNewsCommentDTOs,
  toHackerNewsCommunityDTOs,
  toHackerNewsPostDTO,
} from "./fixtures";

/** Serves bundled demo fixtures. Never claims a live Hacker News connection. */
export class MockHackerNewsAdapter implements PlatformAdapter {
  readonly platform = "HACKERNEWS" as const;

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      platform: "HACKERNEWS",
      status: "DEMO",
      message:
        "Hacker News is not connected. Opportunities shown are demo data. Set HACKERNEWS_ADAPTER=live to discover live stories — no credentials are needed.",
      isDemoData: true,
    };
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    // Fixed categories, not keyword-searched — Hacker News has no community
    // list to search, only these three discovery surfaces.
    const communities = toHackerNewsCommunityDTOs();
    return communities.slice(0, query.limit ?? communities.length);
  }

  async searchPosts(
    communityExternalId: string,
    query: DiscoveryQuery,
  ): Promise<PostDTO[]> {
    const stories = HACKERNEWS_STORIES.filter(
      (story) => story.communityExternalId === communityExternalId,
    ).map(toHackerNewsPostDTO);

    const ranked = rankByKeywords(
      stories,
      (story) => `${story.title} ${story.body}`,
      [...query.keywords, ...(query.intentSignals ?? [])],
    );
    return ranked.slice(0, query.limit ?? stories.length);
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const story = HACKERNEWS_STORIES.find((s) => s.externalId === externalPostId);
    return story ? toHackerNewsPostDTO(story) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const story = HACKERNEWS_STORIES.find((s) => s.externalId === externalPostId);
    return story ? toHackerNewsCommentDTOs(story) : [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const story = HACKERNEWS_STORIES.find((s) => s.externalId === externalPostId);
    if (!story) return null;
    return { post: toHackerNewsPostDTO(story), comments: toHackerNewsCommentDTOs(story) };
  }
}
