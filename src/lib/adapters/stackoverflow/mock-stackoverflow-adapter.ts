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
  STACKOVERFLOW_QUESTIONS,
  toStackOverflowCommentDTOs,
  toStackOverflowCommunityDTOs,
  toStackOverflowPostDTO,
} from "./fixtures";

/** Serves bundled demo fixtures. Never claims a live Stack Overflow connection. */
export class MockStackOverflowAdapter implements PlatformAdapter {
  readonly platform = "STACKOVERFLOW" as const;

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      platform: "STACKOVERFLOW",
      status: "DEMO",
      message:
        "Stack Overflow is not connected. Opportunities shown are demo data. Set STACKOVERFLOW_ADAPTER=live to discover live questions.",
      isDemoData: true,
    };
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const communities = toStackOverflowCommunityDTOs();
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
    const questions = STACKOVERFLOW_QUESTIONS.filter(
      (question) => question.communityExternalId === communityExternalId,
    ).map(toStackOverflowPostDTO);

    const ranked = rankByKeywords(
      questions,
      (question) => `${question.title} ${question.body}`,
      [...query.keywords, ...(query.intentSignals ?? [])],
    );
    return ranked.slice(0, query.limit ?? questions.length);
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const question = STACKOVERFLOW_QUESTIONS.find((q) => q.externalId === externalPostId);
    return question ? toStackOverflowPostDTO(question) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const question = STACKOVERFLOW_QUESTIONS.find((q) => q.externalId === externalPostId);
    return question ? toStackOverflowCommentDTOs(question) : [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const question = STACKOVERFLOW_QUESTIONS.find((q) => q.externalId === externalPostId);
    if (!question) return null;
    return {
      post: toStackOverflowPostDTO(question),
      comments: toStackOverflowCommentDTOs(question),
    };
  }
}
