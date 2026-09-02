import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function getSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

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
