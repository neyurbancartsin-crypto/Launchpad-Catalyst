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
  X_POSTS,
  toXCommentDTOs,
  toXCommunityDTOs,
  toXPostDTO,
} from "./fixtures";

/** Serves bundled demo fixtures. Never claims a live X connection. */
export class MockXAdapter implements PlatformAdapter {
  readonly platform = "X" as const;

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      platform: "X",
      status: "DEMO",
      message:
        "X is not connected. Opportunities shown are demo data. Live discovery requires X API access with read permissions.",
      isDemoData: true,
    };
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const communities = toXCommunityDTOs();
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
    const posts = X_POSTS.filter(
      (post) => post.communityExternalId === communityExternalId,
    ).map(toXPostDTO);

    const ranked = rankByKeywords(
      posts,
      (post) => `${post.title} ${post.body}`,
      [...query.keywords, ...(query.intentSignals ?? [])],
    );
    return ranked.slice(0, query.limit ?? posts.length);
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const post = X_POSTS.find((p) => p.externalId === externalPostId);
    return post ? toXPostDTO(post) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const post = X_POSTS.find((p) => p.externalId === externalPostId);
    return post ? toXCommentDTOs(post) : [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const post = X_POSTS.find((p) => p.externalId === externalPostId);
    if (!post) return null;
    return { post: toXPostDTO(post), comments: toXCommentDTOs(post) };
  }
}
