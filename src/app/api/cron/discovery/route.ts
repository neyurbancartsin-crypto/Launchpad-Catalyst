import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { runDiscoverySync } from "@/lib/discovery-run";

/**
 * Background/automatic discovery. Triggered by an external scheduler (e.g.
 * Vercel Cron — see vercel.json) hitting this endpoint periodically; it does
 * NOT assume the scheduler itself fires exactly every N hours. Each
 * project's own `discoveryIntervalHours` is what actually gates whether it
 * runs on a given invocation, so calling this endpoint more often than any
 * project's interval is always safe — it just finds nothing due yet.
 *
 * Reuses the exact same `syncOpportunities` pipeline (via `runDiscoverySync`)
 * that onboarding and "Find New Opportunities" already use — no second
 * discovery implementation, and no AI calls: this only ever runs deterministic
 * platform search, negative filtering, and scoring.
 *
 * Vercel's own cron invocation is a GET request; POST is supported too for a
 * manual/external trigger (e.g. curl, another scheduler). Both run the exact
 * same handler.
 */

const MAX_PROJECTS_PER_INVOCATION = 25;

interface ProjectResult {
  projectId: string;
  ran: boolean;
  status: "ok" | "not-due" | "locked" | "no-icp" | "error";
}

async function handleCronRequest(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: never treat a missing secret as "no auth required".
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const candidates = await prisma.saaSProject.findMany({
    where: { onboardingComplete: true, autoDiscoveryEnabled: true },
    include: { icp: true },
    orderBy: { lastAutoDiscoveryAt: "asc" },
    // Bounds one invocation's work — with many projects, the ones least
    // recently checked are prioritised, so every project still gets a turn
    // across invocations rather than the same early ones starving the rest.
    take: MAX_PROJECTS_PER_INVOCATION,
  });

  const results: ProjectResult[] = [];

  // Sequential, not parallel: several projects can share the same
  // rate-limited platform (e.g. an unauthenticated GitHub budget), so
  // running them one at a time avoids one cron tick exhausting it outright.
  for (const project of candidates) {
    if (!project.icp) {
      results.push({ projectId: project.id, ran: false, status: "no-icp" });
      continue;
    }

    const dueAt = project.lastAutoDiscoveryAt
      ? new Date(
          project.lastAutoDiscoveryAt.getTime() + project.discoveryIntervalHours * 60 * 60 * 1000,
        )
      : now; // never run automatically before — due immediately
    if (dueAt > now) {
      results.push({ projectId: project.id, ran: false, status: "not-due" });
      continue;
    }

    try {
      const outcome = await runDiscoverySync(project, project.icp, { isAuto: true });
      results.push({
        projectId: project.id,
        ran: outcome.ran,
        status: outcome.ran ? "ok" : "locked",
      });
    } catch (error) {
      // One project's unexpected failure must not stop the rest of the
      // batch — log server-side only, never expose the stack trace.
      console.error(`[cron/discovery] project ${project.id} failed`, error);
      results.push({ projectId: project.id, ran: false, status: "error" });
    }
  }

  return NextResponse.json({ checked: candidates.length, results });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCronRequest(request);
}
