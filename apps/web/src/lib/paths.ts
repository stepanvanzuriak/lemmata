export const paths = {
  workspace: "/",
  canvas: "/canvas",
  project: (id: string) => `/projects/${id}`,
  sessions: "/sessions",
  notebook: "/notebook",
  memory: "/memory",
  literature: "/literature",
  usage: "/usage",
  settings: "/settings",
} as const;
