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
  REDDIT_COMMUNITIES,
  REDDIT_POSTS,
  toCommentDTOs,
  toCommunityDTOs,
  toPostDTO,
} from "./fixtures";

/**
 * Serves bundled demo fixtures. It never claims a live connection: every
 * result carries `isDemoData: true` and `getConnectionStatus()` reports DEMO.
 *
 * A real `RedditAdapter` implements the same interface against the official
 * Reddit API; nothing outside this folder changes when it is swapped in.
 */
export class MockRedditAdapter implements PlatformAdapter {
  readonly platform = "REDDIT" as const;

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      platform: "REDDIT",
      status: "DEMO",
      message:
        "Reddit is not connected. Opportunities shown are demo data. Add Reddit API credentials to discover live conversations.",
      isDemoData: true,
    };
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const communities = toCommunityDTOs();
    const ranked = rankByKeywords(
      communities,
      (community) =>
        [community.name, community.description, ...community.topics].join(" "),
      query.keywords,
    );
    return ranked.slice(0, query.limit ?? communities.length);
  }

  async searchPosts(
    communityExternalId: string,
    query: DiscoveryQuery,
  ): Promise<PostDTO[]> {
    const posts = REDDIT_POSTS.filter(
      (post) => post.communityExternalId === communityExternalId,
    ).map(toPostDTO);

    const ranked = rankByKeywords(
      posts,
      (post) => `${post.title} ${post.body}`,
      [...query.keywords, ...(query.intentSignals ?? [])],
    );
    return ranked.slice(0, query.limit ?? posts.length);
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const post = REDDIT_POSTS.find((p) => p.externalId === externalPostId);
    return post ? toPostDTO(post) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const post = REDDIT_POSTS.find((p) => p.externalId === externalPostId);
    return post ? toCommentDTOs(post) : [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const post = REDDIT_POSTS.find((p) => p.externalId === externalPostId);
    if (!post) return null;
    return { post: toPostDTO(post), comments: toCommentDTOs(post) };
  }
}

export const REDDIT_COMMUNITY_IDS = REDDIT_COMMUNITIES.map((c) => c.externalId);
