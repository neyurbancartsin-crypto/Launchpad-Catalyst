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
  GITHUB_ISSUES,
  toGitHubCommentDTOs,
  toGitHubCommunityDTOs,
  toGitHubPostDTO,
} from "./fixtures";

/** Serves bundled demo fixtures. Never claims a live GitHub connection. */
export class MockGitHubAdapter implements PlatformAdapter {
  readonly platform = "GITHUB" as const;

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      platform: "GITHUB",
      status: "DEMO",
      message:
        "GitHub is not connected. Opportunities shown are demo data. Set GITHUB_ADAPTER=live to discover live issues and discussions.",
      isDemoData: true,
    };
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const communities = toGitHubCommunityDTOs();
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
    const issues = GITHUB_ISSUES.filter(
      (issue) => issue.communityExternalId === communityExternalId,
    ).map(toGitHubPostDTO);

    const ranked = rankByKeywords(
      issues,
      (issue) => `${issue.title} ${issue.body}`,
      [...query.keywords, ...(query.intentSignals ?? [])],
    );
    return ranked.slice(0, query.limit ?? issues.length);
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const issue = GITHUB_ISSUES.find((i) => i.externalId === externalPostId);
    return issue ? toGitHubPostDTO(issue) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const issue = GITHUB_ISSUES.find((i) => i.externalId === externalPostId);
    return issue ? toGitHubCommentDTOs(issue) : [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const issue = GITHUB_ISSUES.find((i) => i.externalId === externalPostId);
    if (!issue) return null;
    return { post: toGitHubPostDTO(issue), comments: toGitHubCommentDTOs(issue) };
  }
}
