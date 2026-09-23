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
 * Live Stack Overflow integration using the Stack Exchange API (v2.3).
 *
 * Read-only: it searches questions and reads answers. It never posts a
 * question, answer, or comment — the founder acts on Stack Overflow
 * themselves (PRD s37).
 *
 * No OAuth or user authorization is needed to read public Q&A. An
 * `STACKOVERFLOW_APP_KEY` is optional — it only raises the daily quota from
 * 300 to 10,000 requests, obtained by registering a free app at
 * https://stackapps.com. Every fixture community defaults to "strict"
 * self-promotion rules, matching Stack Overflow's Help Center policy against
 * promotional answers.
 */

const API_BASE = "https://api.stackexchange.com/2.3";
const SITE = "stackoverflow";

/**
 * Generic English stop-words and product-marketing filler that shows up in
 * almost any AI-generated ICP phrase ("best online invoice checker", "how to
 * test X") but is either too broad or never itself a Stack Overflow tag name.
 * Deliberately domain-agnostic — nothing here is specific to any one product.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for", "with",
  "your", "you", "my", "is", "are", "do", "does", "did", "how", "why", "what",
  "when", "where", "who", "which", "this", "that", "these", "those", "it",
  "we", "they", "i", "me", "no", "not", "can", "will",
  "tool", "tools", "app", "apps", "software", "platform", "service",
  "services", "online", "free", "best", "top", "good", "great", "easy",
  "quick", "fast", "simple", "new", "alternative", "alternatives", "vs",
  "checker", "tester", "test", "tests", "check", "finder", "generator",
  "guide", "tips", "review", "reviews", "compare", "comparison",
]);

/**
 * Splits ICP phrases into distinct, meaningful words a Stack Overflow tag
 * might actually be named after. Tag names never contain spaces, so passing
 * a whole multi-word phrase as a tag-name filter can never match one — this
 * applies to any project's search topics, not a specific product's wording.
 */
function extractTagCandidates(phrases: string[], limit: number): string[] {
  const words: string[] = [];
  const seen = new Set<string>();

  for (const phrase of phrases) {
    for (const raw of phrase.toLowerCase().split(/\s+/)) {
      const word = raw.replace(/[^a-z0-9-]/g, "");
      if (word.length <= 2 || STOPWORDS.has(word) || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
      if (words.length >= limit) return words;
    }
  }

  return words;
}

interface SETag {
  name: string;
  count: number;
}

interface SEWrapper<T> {
  items: T[];
  error_id?: number;
  error_message?: string;
}

interface SEQuestion {
  question_id: number;
  title: string;
  body?: string;
  link: string;
  owner?: { display_name?: string };
  score: number;
  answer_count: number;
  creation_date: number;
}

interface SEAnswer {
  answer_id: number;
  body?: string;
  owner?: { display_name?: string };
  score: number;
  is_accepted: boolean;
  creation_date: number;
}

/** Strips the HTML the Stack Exchange API returns, leaving readable text. */
function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|div|li|pre|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class StackOverflowAdapter implements PlatformAdapter {
  readonly platform = "STACKOVERFLOW" as const;

  private readonly appKey: string | undefined;

  constructor() {
    this.appKey = process.env.STACKOVERFLOW_APP_KEY;
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      await this.get<SETag>("/info", {});
      return {
        platform: "STACKOVERFLOW",
        status: "CONNECTED",
        message: this.appKey
          ? "Connected to Stack Overflow with an app key (10,000 requests/day)."
          : "Connected to Stack Overflow without an app key (300 requests/day) — set STACKOVERFLOW_APP_KEY for a higher quota.",
        isDemoData: false,
      };
    } catch (error) {
      return {
        platform: "STACKOVERFLOW",
        status: "ERROR",
        message: `Stack Overflow connection failed: ${error instanceof Error ? error.message : "unknown error"}`,
        isDemoData: false,
      };
    }
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<SEWrapper<T>> {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("site", SITE);
    if (this.appKey) url.searchParams.set("key", this.appKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const response = await fetch(url);
    const json = (await response.json()) as SEWrapper<T>;

    if (!response.ok || json.error_id) {
      // error_id 502 is the Stack Exchange API's documented throttle-violation code.
      if (json.error_id === 502) {
        throw new PlatformRateLimitError("Stack Overflow rate limit reached; try again later");
      }
      throw new Error(json.error_message ?? `Stack Overflow API returned ${response.status}`);
    }

    return json;
  }

  async discoverCommunities(query: DiscoveryQuery): Promise<CommunityDTO[]> {
    const seen = new Map<string, CommunityDTO>();
    // Look up real tag names by word, not by whole ICP phrase — see
    // extractTagCandidates. Capped at 5 words, matching the previous
    // 5-keyword budget, so this makes no more API calls than before.
    const words = extractTagCandidates(query.keywords, 5);

    for (const word of words) {
      const result = await this.get<SETag>("/tags", {
        inname: word,
        pagesize: "2",
        order: "desc",
        sort: "popular",
      });

      // Keep only the top couple of matches per word — a broad word like
      // "screen" can otherwise pull in a dozen loosely related tags.
      for (const tag of result.items.slice(0, 2)) {
        if (seen.has(tag.name)) continue;
        seen.set(tag.name, {
          externalId: tag.name,
          name: tag.name,
          url: `https://stackoverflow.com/questions/tagged/${tag.name}`,
          description: `Questions tagged '${tag.name}' on Stack Overflow.`,
          memberCount: tag.count,
          // Stack Overflow's Help Center explicitly prohibits promotional
          // answers; there is no per-tag signal, so every tag defaults strict.
          selfPromoRules: "strict",
          topics: [word],
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
    if (terms.length === 0) return [];

    const result = await this.get<SEQuestion>("/search/advanced", {
      tagged: communityExternalId,
      q: terms.join(" "),
      sort: "creation",
      order: "desc",
      filter: "withbody",
      pagesize: String(query.limit ?? 25),
    });

    return result.items.map((question) => this.toPostDTO(communityExternalId, question));
  }

  async getPostDetails(externalPostId: string): Promise<PostDTO | null> {
    const result = await this.get<SEQuestion>(`/questions/${externalPostId}`, {
      filter: "withbody",
    });
    const question = result.items[0];
    return question ? this.toPostDTO("", question) : null;
  }

  async getComments(externalPostId: string): Promise<CommentDTO[]> {
    const context = await this.getConversationContext(externalPostId);
    return context?.comments ?? [];
  }

  async getConversationContext(
    externalPostId: string,
  ): Promise<ConversationContextDTO | null> {
    const questionResult = await this.get<SEQuestion>(`/questions/${externalPostId}`, {
      filter: "withbody",
    });
    const question = questionResult.items[0];
    if (!question) return null;

    const post = this.toPostDTO("", question);

    const answersResult = await this.get<SEAnswer>(`/questions/${externalPostId}/answers`, {
      filter: "withbody",
      sort: "votes",
      order: "desc",
    });

    // Answers reply to the question, never to each other — Stack Overflow
    // has no nested answer threading.
    const comments: CommentDTO[] = answersResult.items
      .filter((answer) => answer.body)
      .map((answer) => ({
        externalId: String(answer.answer_id),
        parentExternalId: null,
        postExternalId: externalPostId,
        author: answer.owner?.display_name ?? "unknown",
        body: `${answer.is_accepted ? "[Accepted answer] " : ""}${stripHtml(answer.body ?? "")}`,
        upvotes: answer.score,
        depth: 0,
        isOp: false,
        createdAt: new Date(answer.creation_date * 1000),
      }));

    return { post, comments };
  }

  private toPostDTO(communityExternalId: string, question: SEQuestion): PostDTO {
    return {
      externalId: String(question.question_id),
      communityExternalId,
      title: stripHtml(question.title),
      body: stripHtml(question.body ?? ""),
      author: question.owner?.display_name ?? "unknown",
      url: question.link,
      upvotes: question.score,
      commentCount: question.answer_count,
      createdAt: new Date(question.creation_date * 1000),
      isDemoData: false,
    };
  }
}
