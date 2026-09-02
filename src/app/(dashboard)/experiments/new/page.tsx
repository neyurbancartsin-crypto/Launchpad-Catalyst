import Link from "next/link";
import { requireProject } from "@/lib/project";
import { createExperimentAction } from "@/actions/experiments.actions";
import { CreateExperimentForm } from "@/components/experiments/experiment-forms";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "New experiment · Launchpad Catalyst" };

export default async function NewExperimentPage() {
  await requireProject();

  return (
    <>
      <div className="mb-4">
        <Link href="/experiments" className="text-sm text-brand hover:underline">
          ← All experiments
        </Link>
      </div>
      <PageHeader
        title="New experiment"
        description="One hypothesis, one time window, one target. Keep the scope small enough that the result means something."
      />
      <Card>
        <CreateExperimentForm action={createExperimentAction} />
      </Card>
    </>
  );
}
