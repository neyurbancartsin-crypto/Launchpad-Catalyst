import type {
  CommentDTO,
  CommunityDTO,
  ConnectionStatus,
  ConversationContextDTO,
  DiscoveryQuery,
  PlatformAdapter,
  PostDTO,
} from "../types";

/**
 * Live Reddit integration using the official OAuth API.
 *
 * Read-only: it searches, reads posts and reads comments. It never posts,
 * votes, or messages — the founder acts on Reddit themselves (PRD s37).
 *
 * Requires a script-type app from https://www.reddit.com/prefs/apps and
 * REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET. Rate limits are respected via the
 * documented headers; no scraping.
 */

const OAUTH_BASE = "https://oauth.reddit.com";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

interface RedditListing<T> {
  kind: string;
  data: { children: { kind: string; data: T }[]; after: string | null };
}

interface RedditSubreddit {
  display_name: string;
  display_name_prefixed: string;
  title: string;
  public_description: string;
  subscribers: number | null;
  url: string;
  over18: boolean;
}

interface RedditPost {
  id: string;
  name: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  ups: number;
  num_comments: number;
  created_utc: number;
  stickied?: boolean;
}

interface RedditComment {
  id: string;
  name: string;
  parent_id: string;
  link_id: string;
  author: string;
  body: string;
  ups: number;
  depth?: number;
  created_utc: number;
  replies?: RedditListing<RedditComment> | "";
}

export class RedditAdapter implements PlatformAdapter {
  readonly platform = "REDDIT" as const;

  private token: { value: string; expiresAt: number } | null = null;

  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly userAgent: string;

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
    this.userAgent =
      process.env.REDDIT_USER_AGENT ??
      "web:launchpad-catalyst:v1.0 (by /u/launchpadcatalyst)";
  }

  private get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    if (!this.configured) {
      return {
        platform: "REDDIT",
        status: "ERROR",
        message:
          "Reddit credentials are missing. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET, or set REDDIT_ADAPTER=mock to use demo data.",
        isDemoData: false,
      };
    }

    try {
      await this.accessToken();
      return {
        platform: "REDDIT",
        status: "CONNECTED",
        message: "Connected to Reddit. Discovery returns live conversations.",
        isDemoData: false,
      };
    } catch (error) {
      return {
        platform: "REDDIT",
        status: "ERROR",
        message: `Reddit connection failed: ${error instanceof Error ? error.message : "unknown error"}`,
        isDemoData: false,
      };
    }
  }

  /** Client-credentials token, cached until shortly before expiry. */
  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Reddit credentials are not configured");
    }

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64",
    );

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.userAgent,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    if (!response.ok) {
      throw new Error(
        `token request returned ${response.status} ${response.statusText}`,
      );
    }

    const json = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.token = {
      value: json.access_token,
      // Refresh a minute early so an in-flight request cannot expire midway.
      expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    };
    return this.token.value;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const token = await this.accessToken();
    const url = new URL(path, OAUTH_BASE);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": this.userAgent,
      },
    });

    if (response.status === 429) {
      const reset = response.headers.get("x-ratelimit-reset");
      throw new Error(
        `Reddit rate limit reached${reset ? `; retry in ${reset}s` : ""}`,
      );
    }
    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const seen = new Map<string, CommunityDTO>();

    // Reddit's subreddit search takes one query at a time; a handful of the
    // founder's top topics is enough and keeps well inside rate limits.
    for (const keyword of query.keywords.slice(0, 5)) {
      const listing = await this.get<RedditListing<RedditSubreddit>>(
        "/subreddits/search",
        { q: keyword, limit: "10", include_over_18: "false" },
      );

      for (const child of listing.data.children) {
        const sub = child.data;
        if (sub.over18 || seen.has(sub.display_name)) continue;

        seen.set(sub.display_name, {
          externalId: sub.display_name,
          name: sub.display_name_prefixed,
          url: `https://www.reddit.com${sub.url}`,
          description: sub.public_description || sub.title,
          memberCount: sub.subscribers,
          // The API does not expose promotion policy; assume the stricter
          // default rather than risking a recommendation to promote.
          selfPromoRules: "strict",
          topics: [keyword],
          isDemoData: false,
        });
      }
    }

    const communities = [...seen.values()];
    return communities.slice(0, query.limit ?? communities.length);
  }

  async searchPosts(
    communityExternalId: string,
    query: DiscoveryQuery,
  ): Promise<PostDTO[]> {
    const terms = [...query.keywords.slice(0, 3), ...(query.intentSignals ?? []).slice(0, 2)];
    const q = terms.length > 0 ? terms.map((t) => `"${t}"`).join(" OR ") : "";
    if (!q) return [];

    const listing = await this.get<RedditListing<RedditPost>>(
      `/r/${encodeURIComponent(communityExternalId)}/search`,
      {
        q,
        restrict_sr: "true",
        sort: "new",
        t: "month",
        limit: String(query.limit ?? 25),
      },
    );

    return listing.data.children
      .map((child) => child.data)
      .filter((post) => !post.stickied)
      .map((post) => this.toPostDTO(post));
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const id = externalPostId.replace(/^t3_/, "");
    const [postListing] = await this.get<[RedditListing<RedditPost>, RedditListing<RedditComment>]>(
      `/comments/${encodeURIComponent(id)}`,
      { limit: "1" },
    );

    const post = postListing.data.children[0]?.data;
    return post ? this.toPostDTO(post) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const context = await this.getConversationContext(externalPostId);
    return context?.comments ?? [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const id = externalPostId.replace(/^t3_/, "");
    const [postListing, commentListing] = await this.get<
      [RedditListing<RedditPost>, RedditListing<RedditComment>]
    >(`/comments/${encodeURIComponent(id)}`, {
      limit: "100",
      sort: "top",
      depth: "3",
    });

    const post = postListing.data.children[0]?.data;
    if (!post) return null;

    const comments: CommentDTO[] = [];
    this.flattenComments(commentListing, post, comments, 0);

    return { post: this.toPostDTO(post), comments };
  }

  /** Reddit nests replies; the analysis layer wants a flat, depth-tagged list. */
  private flattenComments(
    listing: RedditListing<RedditComment> | "" | undefined,
    post: RedditPost,
    out: CommentDTO[],
    depth: number,
  ): void {
    if (!listing || typeof listing === "string") return;

    for (const child of listing.data.children) {
      // "more" placeholders carry no body and are not conversation.
      if (child.kind !== "t1") continue;

      const comment = child.data;
      if (!comment.body || comment.body === "[deleted]" || comment.body === "[removed]") {
        continue;
      }

      out.push({
        externalId: comment.name,
        parentExternalId:
          comment.parent_id === post.name ? null : comment.parent_id,
        postExternalId: post.name,
        author: `u/${comment.author}`,
        body: comment.body,
        upvotes: comment.ups,
        depth: comment.depth ?? depth,
        isOp: comment.author === post.author,
        createdAt: new Date(comment.created_utc * 1000),
      });

      this.flattenComments(comment.replies, post, out, depth + 1);
    }
  }

  private toPostDTO(post: RedditPost): PostDTO {
    return {
      externalId: post.name,
      communityExternalId: post.subreddit,
      title: post.title,
      body: post.selftext ?? "",
      author: `u/${post.author}`,
      url: `https://www.reddit.com${post.permalink}`,
      upvotes: post.ups,
      commentCount: post.num_comments,
      createdAt: new Date(post.created_utc * 1000),
      isDemoData: false,
    };
  }
}
