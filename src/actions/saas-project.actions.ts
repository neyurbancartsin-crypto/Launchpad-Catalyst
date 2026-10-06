"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  clearActiveProjectCookie,
  getActiveProject,
  getSessionUserId,
  requireProjectWithIcp,
  setActiveProjectCookie,
} from "@/lib/project";
import { getAIProvider } from "@/lib/ai/registry";
import { generateDeterministicSaaSAnalysis } from "@/lib/ai/deterministic-saas-analysis";
import { manualDiscoveryAvailableAt, runDiscoverySync } from "@/lib/discovery-run";
import type { SaaSAnalysisWithChannels, SaaSIntake } from "@/lib/ai/types";

export interface FormState {
  error?: string;
  ok?: boolean;
}

const intakeSchema = z.object({
  productName: z.string().trim().min(1, "Product name is required").max(120),
  description: z.string().trim().min(20, "Describe your product in at least 20 characters"),
  problemSolved: z.string().trim().min(20, "Describe the problem in at least 20 characters"),
  targetCustomer: z.string().trim().max(300).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  useCases: z.string().trim().max(1000).optional().or(z.literal("")),
});

function readIntake(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return intakeSchema.safeParse(raw);
}

/**
 * Creates the project, runs the combined SaaS Analyzer + Channel Strategist
 * call, then seeds opportunities so the founder lands on a populated
 * workspace. The founder answers five fields: product name plus
 * `SaaSIntake`'s four (description/problem/target customer/website) — the
 * name is theirs directly, not AI-inferred; everything else on `SaaSProject`
 * is inferred from the AI analysis or a safe static default; see the
 * field-by-field mapping below.
 */
export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readIntake(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your answers" };
  }

  const userId = await getSessionUserId();
  const data = parsed.data;
  const targetCustomer = data.targetCustomer?.trim() || null;
  const website = data.website?.trim() || null;
  const useCases = data.useCases?.trim() || null;

  const intake: SaaSIntake = {
    description: data.description,
    problemSolved: data.problemSolved,
    targetCustomer,
    website,
    useCases,
  };

  let analysis: SaaSAnalysisWithChannels["analysis"];
  let channels: SaaSAnalysisWithChannels["channels"];
  // Onboarding must never block on the configured AI provider being
  // rate-limited, down, misconfigured, or simply unset (a missing API key
  // throws inside `getAIProvider()` itself, before `analyzeSaaSWithChannels`
  // is even reached — hence this try also wraps that call, not just the
  // next one). Any failure here falls back to the same deterministic
  // analysis the demo engine already uses (`MockAIProvider` delegates to the
  // same function), built entirely from the founder's own intake — no
  // retry, no extra AI call, just a graceful downgrade so onboarding
  // completes either way.
  let usedDeterministicFallback = false;
  try {
    const ai = getAIProvider();
    ({ analysis, channels } = await ai.analyzeSaaSWithChannels(intake));
  } catch (error) {
    console.warn(
      `[onboarding] AI product analysis unavailable, falling back to deterministic analysis: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    usedDeterministicFallback = true;
    ({ analysis, channels } = generateDeterministicSaaSAnalysis(intake));
  }

  // A `mode=new` hidden field (set by the onboarding wizard when reached via
  // /onboarding?new=1) means "create another project" rather than the
  // default "update the one currently active" behaviour.
  const createNew = formData.get("mode") === "new";
  const existing = createNew ? null : await getActiveProject();

  const sharedFields = {
    name: data.productName,
    website,
    description: data.description,
    problemSolved: data.problemSolved,
    useCases,
    targetCustomer: targetCustomer ?? analysis.primaryCustomer,
    category: analysis.productCategory,
    pricing: null,
    businessModel: analysis.businessModel,
    targetGeography: "Global",
    competitors: analysis.likelyCompetitors.join(", ") || "none",
    currentChannels: "none",
    biggestProblem: "Not enough qualified conversations yet to know",
    onboardingComplete: true,
    aiAnalysisRaw: analysis as unknown as object,
  };

  const project = existing
    ? await prisma.saaSProject.update({
        where: { id: existing.id },
        // currentUsers/payingUsers are never asked for again after the first
        // onboarding, so an update must not overwrite real historical counts.
        data: sharedFields,
      })
    : await prisma.saaSProject.create({
        data: {
          userId,
          ...sharedFields,
          currentUsers: 0,
          payingUsers: 0,
        },
      });

  // Whichever project this onboarding submission just created or updated
  // becomes (or stays) the active one the founder is looking at.
  await setActiveProjectCookie(project.id);

  const icp = await prisma.iCP.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      productSummary: analysis.productSummary,
      coreProblem: analysis.coreProblem,
      valueProposition: analysis.valueProposition,
      productCategory: analysis.productCategory,
      primaryCustomer: analysis.primaryCustomer,
      secondaryCustomer: analysis.secondaryCustomer,
      roles: analysis.roles,
      industries: analysis.industries,
      companySize: analysis.companySize,
      painPoints: analysis.painPoints,
      buyingTriggers: analysis.buyingTriggers,
      objections: analysis.objections,
      problemMap: analysis.problemMap as unknown as object,
      searchTopics: analysis.searchTopics,
      intentSignals: analysis.intentSignals,
      positiveKeywords: analysis.positiveKeywords,
      keywordSynonyms: analysis.keywordSynonyms as unknown as object,
      negativeKeywords: analysis.negativeKeywords,
      supportedUseCases: analysis.supportedUseCases,
      unsupportedUseCases: analysis.unsupportedUseCases,
    },
    update: {
      productSummary: analysis.productSummary,
      coreProblem: analysis.coreProblem,
      valueProposition: analysis.valueProposition,
      productCategory: analysis.productCategory,
      primaryCustomer: analysis.primaryCustomer,
      secondaryCustomer: analysis.secondaryCustomer,
      roles: analysis.roles,
      industries: analysis.industries,
      companySize: analysis.companySize,
      painPoints: analysis.painPoints,
      buyingTriggers: analysis.buyingTriggers,
      objections: analysis.objections,
      problemMap: analysis.problemMap as unknown as object,
      searchTopics: analysis.searchTopics,
      intentSignals: analysis.intentSignals,
      positiveKeywords: analysis.positiveKeywords,
      keywordSynonyms: analysis.keywordSynonyms as unknown as object,
      negativeKeywords: analysis.negativeKeywords,
      supportedUseCases: analysis.supportedUseCases,
      unsupportedUseCases: analysis.unsupportedUseCases,
    },
  });

  for (const channel of channels) {
    await prisma.channel.upsert({
      where: {
        projectId_platform: { projectId: project.id, platform: channel.platform },
      },
      create: { projectId: project.id, ...channel },
      update: { ...channel },
    });
  }

  // Surface unreachable platforms rather than silently redirecting as if
  // every platform succeeded (PRD s35), and record this as the project's
  // first discovery run. A brand-new project can never already be locked,
  // so `runDiscoverySync` always actually runs here.
  await runDiscoverySync(project, icp, { isAuto: false });

  revalidatePath("/", "layout");
  redirect(
    usedDeterministicFallback ? "/strategy?onboarded=1&aiFallback=1" : "/strategy?onboarded=1",
  );
}

// --- ICP editing (PRD s6: the founder must be able to edit the analysis) ----

const icpEditSchema = z.object({
  primaryCustomer: z.string().trim().min(1),
  secondaryCustomer: z.string().trim().min(1),
  companySize: z.string().trim().min(1),
  roles: z.string(),
  industries: z.string(),
  painPoints: z.string(),
  buyingTriggers: z.string(),
  objections: z.string(),
  searchTopics: z.string(),
  intentSignals: z.string(),
  supportedUseCases: z.string(),
  unsupportedUseCases: z.string(),
});

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function updateIcpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { icp } = await requireProjectWithIcp();

  const parsed = icpEditSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "Primary customer, secondary customer and company size are required" };
  }

  const data = parsed.data;
  await prisma.iCP.update({
    where: { id: icp.id },
    data: {
      primaryCustomer: data.primaryCustomer,
      secondaryCustomer: data.secondaryCustomer,
      companySize: data.companySize,
      roles: toLines(data.roles),
      industries: toLines(data.industries),
      painPoints: toLines(data.painPoints),
      buyingTriggers: toLines(data.buyingTriggers),
      objections: toLines(data.objections),
      searchTopics: toLines(data.searchTopics),
      intentSignals: toLines(data.intentSignals),
      supportedUseCases: toLines(data.supportedUseCases),
      unsupportedUseCases: toLines(data.unsupportedUseCases),
      editedByUser: true,
    },
  });

  revalidatePath("/strategy");
  return { ok: true };
}

/**
 * "Find New Opportunities" — re-runs discovery against the current
 * (possibly edited) ICP for the SAME project. Safe to run any number of
 * times: the platform+externalId/externalPostId uniqueness already on
 * `Community`/`Opportunity` means a repeat search updates existing rows
 * instead of duplicating them (see `syncOpportunities`), and there is no
 * search-count limit here by design. If a run (manual or automatic) is
 * already in progress for this project, this simply does nothing rather
 * than starting a second concurrent sync.
 */
/**
 * Mirrors `runDiscoverySync`'s own outcome — not a new status model, just
 * exposing what it already returns so the UI can show a real count instead
 * of a generic "done". An unexpected throw (a true crash, as opposed to the
 * "locked" outcome `runDiscoverySync` returns normally) is deliberately left
 * uncaught here, same as before this change: it still propagates to the
 * existing dashboard error boundary.
 */
export type RefreshOpportunitiesResult =
  | { status: "idle" }
  | { status: "ok"; newCount: number }
  | { status: "locked" }
  /** `availableAt` is an ISO string (Server Action results must be plain-serializable). */
  | { status: "cooldown"; availableAt: string };

export async function refreshOpportunitiesAction(
  _prevState: RefreshOpportunitiesResult,
  _formData: FormData,
): Promise<RefreshOpportunitiesResult> {
  const { project, icp } = await requireProjectWithIcp();

  // Enforced here, server-side, before the lock is even attempted — reads
  // `project.lastSyncedAt` fresh from the DB on every call, so this cannot
  // be bypassed by a stale page, a new tab, or invoking this action
  // directly: whatever the client believes, this check is authoritative.
  const availableAt = manualDiscoveryAvailableAt(project.lastSyncedAt);
  if (availableAt) {
    return { status: "cooldown", availableAt: availableAt.toISOString() };
  }

  // Surface unreachable platforms rather than letting them look like
  // "no opportunities found" (PRD s35), and keep a short discovery history.
  const outcome = await runDiscoverySync(project, icp, { isAuto: false });

  revalidatePath("/opportunities");
  revalidatePath("/dashboard");

  if (!outcome.ran) return { status: "locked" };
  return { status: "ok", newCount: outcome.summary.discovered };
}

/**
 * Turns automatic (cron-driven) discovery on/off for the active project.
 * Ownership is baked into the `updateMany` `where` clause exactly like
 * `switchProjectAction` — a made-up or another user's project id matches no
 * row and is silently ignored.
 */
export async function toggleAutoDiscoveryAction(formData: FormData): Promise<void> {
  const userId = await getSessionUserId();
  const projectId = String(formData.get("projectId") ?? "");
  const enabled = formData.get("enabled") === "true";

  await prisma.saaSProject.updateMany({
    where: { id: projectId, userId },
    data: { autoDiscoveryEnabled: enabled },
  });

  revalidatePath("/opportunities");
}

// --- Project switching (multi-project MVP) ----------------------------------

/**
 * Switches the founder's active project. The ownership check is part of the
 * query itself — `projectId` is looked up scoped to `userId`, so posting
 * another user's (or a made-up) project id here matches no row and is
 * silently ignored rather than ever activating it.
 */
export async function switchProjectAction(formData: FormData): Promise<void> {
  const userId = await getSessionUserId();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.saaSProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (project) {
    await setActiveProjectCookie(project.id);
    revalidatePath("/", "layout");
  }

  redirect("/dashboard");
}

/**
 * Deletes a project the founder owns, after they've typed its exact name as
 * confirmation. The ownership check is baked into the lookup, exactly like
 * `switchProjectAction` — a made-up or another user's project id matches no
 * row. Deleting the row cascades through every project-scoped table via the
 * Prisma relations already in place (ICP, Channel, Community, Opportunity
 * and its Conversation/Response children, Engagement, Experiment and its
 * Result, GrowthReport, LandingPageAudit) — no manual per-table cleanup.
 */
export async function deleteProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await getSessionUserId();
  const projectId = String(formData.get("projectId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();

  const project = await prisma.saaSProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true, name: true },
  });
  if (!project) {
    return { error: "Project not found." };
  }
  if (confirmName !== project.name) {
    return { error: "Type the project name exactly to confirm deletion." };
  }

  const active = await getActiveProject();
  await prisma.saaSProject.delete({ where: { id: project.id } });

  if (active?.id === project.id) {
    const next = await prisma.saaSProject.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (next) {
      await setActiveProjectCookie(next.id);
    } else {
      await clearActiveProjectCookie();
    }
  }

  revalidatePath("/", "layout");

  const remaining = await prisma.saaSProject.count({ where: { userId } });
  redirect(remaining > 0 ? "/dashboard" : "/onboarding");
}
