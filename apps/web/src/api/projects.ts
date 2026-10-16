import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, Project } from "shared";

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Create project failed: ${res.status}`);
  }

  return res.json();
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");

  if (!res.ok) {
    throw new Error(`Get projects failed: ${res.status}`);
  }

  return res.json();
}

export async function deleteProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });

  if (!res.ok) {
    throw new Error(`Delete project failed: ${res.status}`);
  }

  return res.json();
}

export const projectsKey = ["projects"] as const;

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}

export function useGetAllProjects() {
  return useQuery({
    queryKey: projectsKey,
    queryFn: getProjects,
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}
