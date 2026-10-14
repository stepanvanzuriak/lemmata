export type Project = {
  id: string;
  title: string;
  statement: string;
  dir: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  title: string;
  statement?: string;
  dir?: string | null;
};
