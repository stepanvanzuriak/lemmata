export { openDb, schema, type Db } from "./db/index.js";
export {
  projectSchema,
  createProjectSchema,
  updateProjectSchema,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "./db/schema.js";
export { initWorkspace } from "./workspace.js";
export {
  createProject,
  listProjects,
  deleteProject,
  getProject,
  updateProject,
} from "./projects.js";
export { ulid, isoNow } from "./ids.js";

export const MIGRATIONS_FOLDER = new URL("../migrations", import.meta.url)
  .pathname;
