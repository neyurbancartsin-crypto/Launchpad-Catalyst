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

/**
 * Live GitHub integration using the official REST API.
 *
 * Read-only: it searches repositories and issues, and reads issue comments.
 * It never opens issues, comments, or reacts — the founder acts on GitHub
 * themselves (PRD s37).
 *
 * A `GITHUB_TOKEN` is optional, not required: public search works
 * unauthenticated (10 req/min) and is simply faster with a classic personal
 * access token (30 req/min) — no scopes are needed for public data. GitHub
 * Discussions specifically require GraphQL with a token and are out of scope
 * for this MVP (issues only).
 */

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

interface GitHubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  topics?: string[];
}

interface GitHubSearchRepos {
  items: GitHubRepo[];
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: { login: string } | null;
  comments: number;
  created_at: string;
  reactions?: { total_count: number };
  pull_request?: unknown;
}

interface GitHubSearchIssues {
  items: GitHubIssue[];
}

interface GitHubComment {
  id: number;
  body: string | null;
  user: { login: string } | null;
  created_at: string;
  reactions?: { total_count: number };
}

export class GitHubAdapter implements PlatformAdapter {
  readonly platform = "GITHUB" as const;

  /**
   * GitHub's Search API allows ~30 requests/min even with a token — a much
   * stricter, separate budget from the general REST API. A broad ICP can
   * discover 20-30 repositories, and searching every one for issues in a
   * single sync exhausts that budget mid-run (reproduced empirically).
   * Capping to the most ICP-relevant repositories keeps a full sync safely
   * inside the limit while still surfacing the strongest candidates.
   */
  readonly maxCommunitiesPerSync = 8;

  private readonly token: string | undefined;

  constructor() {
    this.token = process.env.GITHUB_TOKEN;
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      const response = await this.rawFetch("/rate_limit");
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }
      return {
        platform: "GITHUB",
        status: "CONNECTED",
        message: this.token
          ? "Connected to GitHub with a personal access token. Discovery returns live issues (30 requests/min)."
          : "Connected to GitHub without a token. Discovery returns live issues at the unauthenticated rate limit (10 requests/min) — set GITHUB_TOKEN for a higher limit.",
        isDemoData: false,
      };
    } catch (error) {
      return {
        platform: "GITHUB",
        status: "ERROR",
        message: `GitHub connection failed: ${error instanceof Error ? error.message : "unknown error"}`,
        isDemoData: false,
      };
    }
  }

  private async rawFetch(path: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "launchpad-catalyst",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return fetch(`${API_BASE}${path}`, { headers });
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.rawFetch(path);

    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
      const reset = response.headers.get("x-ratelimit-reset");
      const retryAt = reset ? new Date(Number(reset) * 1000) : null;
      throw new PlatformRateLimitError(
        `GitHub rate limit reached; resets at ${retryAt ? retryAt.toISOString() : "unknown"}${this.token ? "" : " (set GITHUB_TOKEN for a higher limit)"}`,
        retryAt,
      );
    }
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const seen = new Map<string, CommunityDTO>();

    // One request per keyword is enough signal and keeps well inside the
    // search endpoint's stricter rate limit.
    for (const keyword of query.keywords.slice(0, 3)) {
      const q = `${keyword} in:name,description,topics`;
      const result = await this.get<GitHubSearchRepos>(
        `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`,
      );

      for (const repo of result.items) {
        if (seen.has(repo.full_name)) continue;
        seen.set(repo.full_name, {
          externalId: repo.full_name,
          name: repo.full_name,
          url: repo.html_url,
          description: repo.description ?? "",
          memberCount: repo.stargazers_count,
          // GitHub exposes no promotion-policy signal; assume the safer
          // middle ground rather than risk recommending a pitch.
          selfPromoRules: "moderate",
          topics: repo.topics && repo.topics.length > 0 ? repo.topics : [keyword],
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
    // GitHub search ANDs bare space-separated words as independent required
    // terms, not a phrase — `is:issue webhook debugging` requires "webhook"
    // AND "debugging" to each appear, which zeroes out real, relevant issues
    // (verified against live data: a repo with 5 real issues returned 0).
    // Quoting a whole multi-word ICP topic as one exact phrase over-corrects
    // the other way — "webhook debugging" as a literal phrase rarely appears
    // verbatim. Splitting each topic into its individual words and ORing
    // those is what actually surfaced real matches in testing.
    const words = [
      ...query.keywords.slice(0, 4),
      ...(query.intentSignals ?? []).slice(0, 2),
    ]
      .flatMap((phrase) => phrase.split(/\s+/))
      .map((word) => word.replace(/[^a-zA-Z0-9-]/g, ""))
      .filter((word) => word.length > 2);
    const terms = [...new Set(words)].slice(0, 6).join(" OR ");
    const q = `repo:${communityExternalId} is:issue${terms ? ` (${terms})` : ""}`;

    const result = await this.get<GitHubSearchIssues>(
      `/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=${query.limit ?? 25}`,
    );

    return result.items
      .filter((issue) => !issue.pull_request)
      .map((issue) => this.toPostDTO(communityExternalId, issue));
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const parsed = this.parseId(externalPostId);
    if (!parsed) return null;
    const { owner, repo, number } = parsed;

    const issue = await this.get<GitHubIssue>(`/repos/${owner}/${repo}/issues/${number}`);
    return this.toPostDTO(`${owner}/${repo}`, issue);
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const context = await this.getConversationContext(externalPostId);
    return context?.comments ?? [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const parsed = this.parseId(externalPostId);
    if (!parsed) return null;
    const { owner, repo, number } = parsed;

    const issue = await this.get<GitHubIssue>(`/repos/${owner}/${repo}/issues/${number}`);
    const post = this.toPostDTO(`${owner}/${repo}`, issue);

    const comments = await this.get<GitHubComment[]>(
      `/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`,
    );

    // GitHub issue comments are a flat timeline, not threaded — every
    // comment replies to the issue itself, so there is no parent/depth.
    const commentDTOs: CommentDTO[] = comments
      .filter((comment) => comment.body)
      .map((comment) => ({
        externalId: String(comment.id),
        parentExternalId: null,
        postExternalId: externalPostId,
        author: comment.user?.login ?? "ghost",
        body: comment.body ?? "",
        upvotes: comment.reactions?.total_count ?? 0,
        depth: 0,
        isOp: comment.user?.login === issue.user?.login,
        createdAt: new Date(comment.created_at),
      }));

    return { post, comments: commentDTOs };
  }

  private parseId(externalPostId: string): { owner: string; repo: string; number: string } | null {
    const match = /^([^/]+)\/([^#]+)#(\d+)$/.exec(externalPostId);
    if (!match) return null;
    const [, owner, repo, number] = match;
    return { owner, repo, number };
  }

  private toPostDTO(communityExternalId: string, issue: GitHubIssue): PostDTO {
    return {
      externalId: `${communityExternalId}#${issue.number}`,
      communityExternalId,
      title: issue.title,
      body: issue.body ?? "",
      author: issue.user?.login ?? "ghost",
      url: issue.html_url,
      upvotes: issue.reactions?.total_count ?? 0,
      commentCount: issue.comments,
      createdAt: new Date(issue.created_at),
      isDemoData: false,
    };
  }
}
