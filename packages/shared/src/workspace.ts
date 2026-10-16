export type Toolchain = {
  claude: string | null;
  uv: string | null;
  python: string | null;
  lean: string | null;
};

export type WorkspaceInfo = {
  dir: string;
  address: string;
  toolchain: Toolchain;
};
