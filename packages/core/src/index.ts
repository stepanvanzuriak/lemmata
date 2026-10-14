export { openDb, schema, type Db } from "./db/index.js";
export type { Project, CreateProjectInput } from "shared";
export type { ProjectRow, NewProject } from "./db/schema.js";
export { initWorkspace } from "./workspace.js";
export { createProject, listProjects } from "./projects.js";
export { ulid, isoNow } from "./ids.js";

export const MIGRATIONS_FOLDER = new URL("../migrations", import.meta.url)
  .pathname;
