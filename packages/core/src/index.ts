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
export {
  listCanvases,
  getCanvas,
  createCanvas,
  addNode,
  updateNode,
  updateNodePositions,
  deleteNode,
  addEdge,
  deleteEdge,
  parsePayload,
  GoalNodeError,
  NotFoundError,
  type CanvasDetail,
  type NodeInput,
  type NodePayload,
  type NodePosition,
} from "./canvases.js";
export {
  EDGE_KINDS,
  NODE_CREATORS,
  type Canvas,
  type CanvasNode,
  type CanvasEdge,
} from "./db/schema.js";
export { searchProjects } from "./search.js";
export { ulid, isoNow } from "./ids.js";

export const MIGRATIONS_FOLDER = new URL("../migrations", import.meta.url)
  .pathname;
