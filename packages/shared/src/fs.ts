export type FsEntry = { name: string; path: string };

export type FsListResponse = {
  path: string;
  parent: string | null;
  entries: FsEntry[];
};

export type MkdirInput = { path: string };
