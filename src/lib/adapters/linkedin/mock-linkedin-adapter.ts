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
  LINKEDIN_POSTS,
  toLinkedInCommentDTOs,
  toLinkedInCommunityDTOs,
  toLinkedInPostDTO,
} from "./fixtures";

/** Serves bundled demo fixtures. Never claims a live LinkedIn connection. */
export class MockLinkedInAdapter implements PlatformAdapter {
  readonly platform = "LINKEDIN" as const;

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      platform: "LINKEDIN",
      status: "DEMO",
      message:
        "LinkedIn is not connected. Opportunities shown are demo data. Live discovery requires approved LinkedIn API access.",
      isDemoData: true,
    };
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const communities = toLinkedInCommunityDTOs();
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
    const posts = LINKEDIN_POSTS.filter(
      (post) => post.communityExternalId === communityExternalId,
    ).map(toLinkedInPostDTO);

    const ranked = rankByKeywords(
      posts,
      (post) => `${post.title} ${post.body}`,
      [...query.keywords, ...(query.intentSignals ?? [])],
    );
    return ranked.slice(0, query.limit ?? posts.length);
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const post = LINKEDIN_POSTS.find((p) => p.externalId === externalPostId);
    return post ? toLinkedInPostDTO(post) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const post = LINKEDIN_POSTS.find((p) => p.externalId === externalPostId);
    return post ? toLinkedInCommentDTOs(post) : [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const post = LINKEDIN_POSTS.find((p) => p.externalId === externalPostId);
    if (!post) return null;
    return {
      post: toLinkedInPostDTO(post),
      comments: toLinkedInCommentDTOs(post),
    };
  }
}
