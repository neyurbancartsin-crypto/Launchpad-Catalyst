import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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

/** The founder's active SaaS project, or null before onboarding. */
export async function getActiveProject() {
  const userId = await getSessionUserId();
  return prisma.saaSProject.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
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
