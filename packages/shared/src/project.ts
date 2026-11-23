export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "core/schema";

export const PROJECT_EXPORT_EXTENSION = "lemmata";

/** File name for an exported project: its title with path-unsafe characters dropped. */
export function projectExportFileName(title: string) {
  const base =
    title
      .replace(/[\p{Cc}/\\:*?"<>|]+/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 100) || "project";

  return `${base}.${PROJECT_EXPORT_EXTENSION}`;
}
