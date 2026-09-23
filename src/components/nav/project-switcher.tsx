"use client";

import { Select } from "@/components/ui";

export function ProjectSwitcher({
  projects,
  activeProjectId,
  switchAction,
}: {
  projects: { id: string; name: string }[];
  activeProjectId: string | null;
  switchAction: (formData: FormData) => Promise<void>;
}) {
  if (projects.length < 2) return null;

  return (
    <form action={switchAction}>
      <Select
        name="projectId"
        aria-label="Active project"
        className="w-auto"
        defaultValue={activeProjectId ?? projects[0]?.id}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </Select>
    </form>
  );
}
