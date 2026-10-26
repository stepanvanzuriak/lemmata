export type Settings = {
  /** The first-run tour was finished or skipped. */
  onboarded: boolean;
  /** Legacy default for saved models without a provider prefix. */
  agent: "claude" | "codex";
  providers: { claude: boolean; codex: boolean };
};
