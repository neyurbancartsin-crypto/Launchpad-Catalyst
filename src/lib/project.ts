import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * Which of the founder's SaaS projects the UI is currently showing. HttpOnly
 * so client-side script can never read or forge it — the only way to change
 * it is a Server Action that has already verified ownership.
 */
const ACTIVE_PROJECT_COOKIE = "activeProjectId";

/**
 * The signed-in user's id, verified to still exist.
 *
 * Sessions are JWTs, so a cookie outlives the row it points at — after the
 * account is deleted, or after the app is pointed at a different database.
 * Without this check the session looks valid and the next write fails on a
 * foreign key instead. Cached per request so the extra lookup runs once.
 */
export const getSessionUserId = cache(async (): Promise<string> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const exists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!exists) redirect("/login?reason=session-expired");

  return exists.id;
});

/**
 * The founder's active SaaS project, or null before onboarding.
 *
 * Reads `activeProjectId` from the cookie set by `setActiveProjectCookie`.
 * The ownership check (`userId`) is part of the query itself, not a
 * follow-up `if` — a cookie holding another user's (or a deleted) project id
 * simply matches no row here and falls through to the default below, so it
 * can never be used to read another user's project.
 */
export async function getActiveProject() {
  const userId = await getSessionUserId();
  const store = await cookies();
  const activeProjectId = store.get(ACTIVE_PROJECT_COOKIE)?.value;

  if (activeProjectId) {
    const selected = await prisma.saaSProject.findFirst({
      where: { id: activeProjectId, userId },
    });
    if (selected) return selected;
  }

  // No cookie, or it didn't resolve to a project owned by this user: fall
  // back to the original single-project behaviour (the oldest project).
  return prisma.saaSProject.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/** All of the founder's projects, oldest first, for the project switcher. */
export async function getUserProjects() {
  const userId = await getSessionUserId();
  return prisma.saaSProject.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * Marks a project as the active one. Callable only from a Server Action or
 * Route Handler (Next.js restriction on writing cookies) — callers must have
 * already verified the project belongs to the signed-in user.
 */
export async function setActiveProjectCookie(projectId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Clears the active-project cookie, e.g. after the last project is deleted. */
export async function clearActiveProjectCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_PROJECT_COOKIE);
}

/**
 * For pages that cannot render without a completed project. Sends the founder
 * back to onboarding rather than showing a broken empty shell.
 */
export async function requireProject() {
  const project = await getActiveProject();
  if (!project || !project.onboardingComplete) redirect("/onboarding");
  return project;
}

export async function requireProjectWithIcp() {
  const project = await requireProject();
  const icp = await prisma.iCP.findUnique({ where: { projectId: project.id } });
  if (!icp) redirect("/onboarding");
  return { project, icp };
}
