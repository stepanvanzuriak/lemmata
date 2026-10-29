import { fileURLToPath } from "node:url";
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
  setNodeCollapsed,
  deleteNode,
  addEdge,
  deleteEdge,
  parsePayload,
  GoalNodeError,
  UniqueToolboxError,
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
export { addAttemptEvent, listAttemptEvents } from "./transcripts.js";

export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../migrations", import.meta.url),
);
export {
  startAttempt,
  addAttemptUsage,
  setAttemptSession,
  finishAttempt,
  listAttempts,
  attemptTokens,
  type AttemptUsage,
} from "./attempts.js";
export {
  ATTEMPT_STATUSES,
  type Attempt,
  type AttemptStatus,
} from "./db/schema.js";
export {
  listAgents,
  getAgent,
  addAgent,
  updateAgent,
  removeAgent,
  clearClaims,
} from "./agents.js";
export {
  addMessage,
  archiveMessages,
  listMessages,
  lastSessionId,
  restoreMessages,
} from "./chat.js";
export {
  AGENT_ROLES,
  type AgentRole,
  type CanvasAgent,
  type ChatMessage,
} from "./db/schema.js";
export {
  addMemory,
  listMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  type MemoryInput,
  type MemorySource,
} from "./memory.js";
export {
  MEMORY_KINDS,
  type MemoryEntry,
  type MemoryKind,
} from "./db/schema.js";
