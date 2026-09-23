import {
  PlatformRateLimitError,
  type CommentDTO,
  type CommunityDTO,
  type ConnectionStatus,
  type ConversationContextDTO,
  type DiscoveryQuery,
  type PlatformAdapter,
  type PostDTO,
} from "../types";
import { HACKERNEWS_COMMUNITIES } from "./fixtures";

/**
 * Live Hacker News integration via the Algolia HN Search API
 * (hn.algolia.com) — a free, keyless, community-maintained search index over
 * Hacker News, since the official Firebase API has no search, only item and
 * top-story-id lookups.
 *
 * Read-only, no credentials of any kind: HN has no auth to configure.
 */

const SEARCH_BASE = "https://hn.algolia.com/api/v1";

interface AlgoliaHit {
  objectID: string;
  title: string | null;
  story_text: string | null;
  author: string | null;
  url: string | null;
  points: number | null;
  num_comments: number | null;
  created_at: string;
}

interface AlgoliaSearchResponse {
  hits: AlgoliaHit[];
}

interface AlgoliaItem {
  id: number;
  author: string | null;
  text: string | null;
  points: number | null;
  title: string | null;
  url: string | null;
  type: string;
  created_at: string;
  children: AlgoliaItem[];
}

/** Discovery categories are fixed platform structure, not fetched from an endpoint. */
const COMMUNITY_IDS = new Set(HACKERNEWS_COMMUNITIES.map((c) => c.externalId));

export class HackerNewsAdapter implements PlatformAdapter {
  readonly platform = "HACKERNEWS" as const;

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      const response = await fetch(`${SEARCH_BASE}/search?tags=front_page&hitsPerPage=1`);
      if (!response.ok) throw new Error(`Algolia HN API returned ${response.status}`);
      return {
        platform: "HACKERNEWS",
        status: "CONNECTED",
        message: "Connected to Hacker News. Discovery returns live stories.",
        isDemoData: false,
      };
    } catch (error) {
      return {
        platform: "HACKERNEWS",
        status: "ERROR",
        message: `Hacker News connection failed: ${error instanceof Error ? error.message : "unknown error"}`,
        isDemoData: false,
      };
    }
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${SEARCH_BASE}${path}`);

    if (response.status === 429) {
      throw new PlatformRateLimitError(
        "Hacker News search is temporarily rate limited; try again shortly",
      );
    }
    if (!response.ok) {
      throw new Error(`Hacker News API returned ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const communities: CommunityDTO[] = HACKERNEWS_COMMUNITIES.map((c) => ({
      ...c,
      isDemoData: false,
    }));
    return communities.slice(0, query.limit ?? communities.length);
  }

  async searchPosts(
    communityExternalId: string,
    query: DiscoveryQuery,
  ): Promise<PostDTO[]> {
    if (!COMMUNITY_IDS.has(communityExternalId)) return [];

    // One combined query mashing every keyword and intent signal together
    // dilutes Algolia's relevance matching to the point of returning
    // nothing, even when a short, focused query over the same stories finds
    // real results. Running one short query per topic and merging keeps
    // each search specific while still covering the whole ICP — this holds
    // for any project's topics, not a particular product's wording.
    const limit = query.limit ?? 25;
    const topics = query.keywords.slice(0, 3);

    const hits = new Map<string, AlgoliaHit>();
    for (const topic of topics) {
      const params = new URLSearchParams({
        query: topic,
        tags: communityExternalId,
        hitsPerPage: String(limit),
      });
      const result = await this.get<AlgoliaSearchResponse>(`/search?${params}`);
      for (const hit of result.hits) {
        if (hit.title && !hits.has(hit.objectID)) hits.set(hit.objectID, hit);
      }
    }

    return [...hits.values()]
      .slice(0, limit)
      .map((hit) => this.toPostDTO(communityExternalId, hit));
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const item = await this.get<AlgoliaItem>(`/items/${encodeURIComponent(externalPostId)}`);
    if (!item.title) return null;
    return this.toPostDTOFromItem(item);
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const context = await this.getConversationContext(externalPostId);
    return context?.comments ?? [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const item = await this.get<AlgoliaItem>(`/items/${encodeURIComponent(externalPostId)}`);
    if (!item.title) return null;

    const post = this.toPostDTOFromItem(item);
    const comments: CommentDTO[] = [];
    this.flattenComments(item.children, item.author, post.externalId, null, comments, 0);

    return { post, comments };
  }

  /** HN nests replies; the analysis layer wants a flat, depth-tagged list. */
  private flattenComments(
    children: AlgoliaItem[] | undefined,
    postAuthor: string | null,
    postExternalId: string,
    parentId: string | null,
    out: CommentDTO[],
    depth: number,
  ): void {
    if (!children) return;

    for (const child of children) {
      if (child.text) {
        out.push({
          externalId: String(child.id),
          parentExternalId: parentId,
          postExternalId,
          author: child.author ?? "unknown",
          body: child.text,
          upvotes: child.points ?? 0,
          depth,
          isOp: child.author === postAuthor,
          createdAt: new Date(child.created_at),
        });
      }
      this.flattenComments(
        child.children,
        postAuthor,
        postExternalId,
        String(child.id),
        out,
        depth + 1,
      );
    }
  }

  private toPostDTO(communityExternalId: string, hit: AlgoliaHit): PostDTO {
    return {
      externalId: hit.objectID,
      communityExternalId,
      title: hit.title ?? "(untitled)",
      body: hit.story_text ?? "",
      author: hit.author ?? "unknown",
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
      upvotes: hit.points ?? 0,
      commentCount: hit.num_comments ?? 0,
      createdAt: new Date(hit.created_at),
      isDemoData: false,
    };
  }

  private toPostDTOFromItem(item: AlgoliaItem): PostDTO {
    return {
      externalId: String(item.id),
      communityExternalId: "front_page",
      title: item.title ?? "(untitled)",
      body: item.text ?? "",
      author: item.author ?? "unknown",
      url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
      upvotes: item.points ?? 0,
      commentCount: item.children?.length ?? 0,
      createdAt: new Date(item.created_at),
      isDemoData: false,
    };
  }
}
