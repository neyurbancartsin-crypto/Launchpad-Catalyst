import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { ProblemSection } from "@/components/landing/problem-section";
import { WorkflowSteps } from "@/components/landing/workflow-steps";
import { FounderControlSection } from "@/components/landing/founder-control-section";
import { WorkflowDiagram } from "@/components/landing/workflow-diagram";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="landing-root bg-landing-bg">
      <LandingNavbar />
      <main>
        <Hero />
        <ProblemSection />
        <WorkflowSteps />
        <FounderControlSection />
        <WorkflowDiagram />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
