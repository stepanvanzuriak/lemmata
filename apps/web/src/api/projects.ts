import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  projectExportFileName,
  type CreateProjectInput,
  type Project,
  type UpdateProjectInput,
} from "shared";
import { api } from "./http";

export async function createProject(input: CreateProjectInput) {
  const { data } = await api.post<Project>("/projects", input);

  return data;
}

export async function getProjects() {
  const { data } = await api.get<Project[]>("/projects");

  return data;
}

export async function deleteProject(id: string) {
  const { data } = await api.delete<Project>(`/projects/${id}`);

  return data;
}

export async function updateProject({
  id,
  input,
}: {
  id: string;
  input: UpdateProjectInput;
}) {
  const { data } = await api.patch<Project>(`/projects/${id}`, input);

  return data;
}

/** Downloads the project as a `<title>.lemmata` zip archive. */
export async function exportProject(project: Project) {
  const { data } = await api.get<Blob>(`/projects/${project.id}/export`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: projectExportFileName(project.title),
  });

  link.click();
  URL.revokeObjectURL(url);
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

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}

export function useExportProject() {
  return useMutation({ mutationFn: exportProject });
}
