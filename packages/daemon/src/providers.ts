import { createAdapter, type AdapterName, type ModelOption } from "runner";
import type { Settings } from "shared";
import { ConflictError } from "./agents.js";

const PROVIDERS = ["claude", "codex"] as const;
const providerLabel = (provider: AdapterName) =>
  provider === "claude" ? "Claude Code" : "Codex";

/** Prefix model IDs so each role keeps its provider along with its model. */
export async function enabledModels(
  settings: Settings,
): Promise<ModelOption[]> {
  const models = await Promise.all(
    PROVIDERS.filter((provider) => settings.providers[provider]).map(
      async (provider) => {
        const label = providerLabel(provider);
        const models = await createAdapter(provider).models;
        return [
          { id: `${provider}:`, label: `${label} · Default` },
          ...models.map((model) => ({
            id: `${provider}:${model.id}`,
            label: `${label} · ${model.label}`,
          })),
        ];
      },
    ),
  );
  return models.flat();
}

export function resolveModel(settings: Settings, model: string | null) {
  const separator = model?.indexOf(":") ?? -1;
  const explicit = separator >= 0 ? model!.slice(0, separator) : null;
  const provider =
    explicit ??
    (model
      ? settings.agent
      : settings.providers[settings.agent]
        ? settings.agent
        : PROVIDERS.find((provider) => settings.providers[provider]));

  if (
    !PROVIDERS.some((name) => name === provider) ||
    !settings.providers[provider as AdapterName]
  ) {
    throw new ConflictError(
      "no_provider",
      explicit
        ? `Enable ${explicit} in Settings or select a model from an enabled provider.`
        : "Enable a provider in Settings before running an agent.",
    );
  }
  return {
    provider: provider as AdapterName,
    id: separator >= 0 ? model!.slice(separator + 1) || null : model,
  };
}
