import type { AIProvider } from "./types";
import { MockAIProvider } from "./mock-provider";
import { ClaudeAIProvider } from "./claude-provider";
import { OpenRouterAIProvider } from "./openrouter-provider";
import { GeminiAIProvider } from "./gemini-provider";

let cached: AIProvider | null = null;

/**
 * Resolves the configured AI provider.
 *
 * `AI_PROVIDER=mock` (default) uses the offline demo engine.
 * `AI_PROVIDER=claude` uses the Claude API and requires ANTHROPIC_API_KEY.
 * `AI_PROVIDER=openrouter` uses OpenRouter and requires OPENROUTER_API_KEY.
 * `AI_PROVIDER=gemini` uses the Google Gemini API and requires GEMINI_API_KEY.
 *
 * Opportunity scores are computed by `lib/scoring` in every case, so
 * switching providers changes the language around a score, never the score
 * itself.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const configured = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  switch (configured) {
    case "mock":
      cached = new MockAIProvider();
      break;
    case "claude":
    case "anthropic":
      cached = new ClaudeAIProvider();
      break;
    case "openrouter":
      cached = new OpenRouterAIProvider();
      break;
    case "gemini":
      cached = new GeminiAIProvider();
      break;
    default:
      // Fail loudly rather than silently serving demo analysis when the
      // operator believes a real provider is configured.
      throw new Error(
        `Unknown AI_PROVIDER "${configured}". Supported values: mock, claude, openrouter, gemini.`,
      );
  }

  return cached;
}

/** Test seam: clears the memoised provider after an env change. */
export function resetAIProvider(): void {
  cached = null;
}
