"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

const ADD_PROJECT_VALUE = "__add_project__";

/**
 * Always a real dropdown now, even with a single project — "Add Project"
 * lives inside it as the last option instead of a separate header button.
 * Picking it doesn't submit the switch-project action at all; it navigates
 * straight to onboarding client-side.
 */
export function ProjectSwitcher({
  projects,
  activeProjectId,
  switchAction,
}: {
  projects: { id: string; name: string }[];
  activeProjectId: string | null;
  switchAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  if (projects.length === 0) {
    return (
      <Select
        aria-label="Project"
        className="w-auto"
        value=""
        onChange={() => router.push("/onboarding?new=1")}
      >
        <option value="" disabled>
          No projects yet
        </option>
        <option value={ADD_PROJECT_VALUE}>+ Add project</option>
      </Select>
    );
  }

  return (
    <form ref={formRef} action={switchAction}>
      <Select
        name="projectId"
        aria-label="Active project"
        className="w-auto"
        defaultValue={activeProjectId ?? projects[0]?.id}
        onChange={(event) => {
          if (event.currentTarget.value === ADD_PROJECT_VALUE) {
            router.push("/onboarding?new=1");
            return;
          }
          event.currentTarget.form?.requestSubmit();
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
        <option value={ADD_PROJECT_VALUE}>+ Add project</option>
      </Select>
    </form>
  );
}
