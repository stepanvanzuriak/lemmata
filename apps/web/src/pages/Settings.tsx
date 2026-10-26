import type { ComponentType, SVGProps } from "react";
import {
  Button,
  Card,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@heroui/react";
import { Display, Moon, Sun } from "@gravity-ui/icons";
import { useSettings, useUpdateSettings } from "../api/settings";
import { Toolchain } from "../components/onboarding/Toolchain";
import { useTheme } from "../lib/hooks";
import type { ThemePreference } from "../stores/theme";

const themes: {
  id: ThemePreference;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { id: "system", label: "System", Icon: Display },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
];

export function Settings() {
  const { preference, resolved, setPreference } = useTheme();
  const settings = useUpdateSettings();
  const { data: savedSettings } = useSettings();

  return (
    <div className="flex max-w-180 flex-col gap-6">
      <Typography type="h1" className="m-0 text-[28px] font-semibold">
        Settings
      </Typography>

      <Card className="gap-4 rounded-xl border border-lm-line px-5 py-4.5 shadow-none">
        <Card.Header className="gap-1">
          <Card.Title className="text-base font-semibold">
            Appearance
          </Card.Title>
          <Card.Description>
            System follows your operating system
            {preference === "system" ? ` (currently ${resolved})` : ""}. The
            choice is remembered in this browser.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ToggleButtonGroup
            aria-label="Theme"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[preference]}
            onSelectionChange={(keys) => {
              const [key] = keys;
              if (key) {
                setPreference(key as ThemePreference);
              }
            }}
          >
            {themes.map(({ id, label, Icon }) => (
              <ToggleButton key={id} id={id}>
                <Icon width={16} height={16} aria-hidden="true" />
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Card.Content>
      </Card>

      <Card className="gap-4 rounded-xl border border-lm-line px-5 py-4.5 shadow-none">
        <Card.Header className="gap-1">
          <Card.Title className="text-base font-semibold">Providers</Card.Title>
          <Card.Description>
            Enable the providers you want to use. Choose a model separately for
            the Prover, Referee, and chat from any enabled provider.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {(["claude", "codex"] as const).map((provider) => {
            const enabled = savedSettings?.providers[provider] ?? false;
            const name = provider === "claude" ? "Claude Code" : "Codex";
            return (
              <div
                key={provider}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm font-medium">{name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-label={name}
                  aria-checked={enabled}
                  disabled={!savedSettings || settings.isPending}
                  onClick={() => {
                    if (savedSettings) {
                      settings.mutate({
                        providers: {
                          ...savedSettings.providers,
                          [provider]: !enabled,
                        },
                      });
                    }
                  }}
                  className={`relative h-6 w-11 shrink-0 rounded-full border border-lm-line transition-colors disabled:opacity-50 ${enabled ? "bg-lm-accent" : "bg-lm-line"}`}
                >
                  <span
                    className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "left-0.5 translate-x-5" : "left-0.5"}`}
                  />
                </button>
              </div>
            );
          })}
          {savedSettings &&
            !Object.values(savedSettings.providers).some(Boolean) && (
              <p className="m-0 text-sm text-lm-muted">
                Enable a provider to select models and run agents.
              </p>
            )}
          {settings.error && (
            <p role="alert" className="m-0 text-sm text-lm-danger">
              {settings.error.message}
            </p>
          )}
        </Card.Content>
      </Card>

      <Card className="gap-4 rounded-xl border border-lm-line px-5 py-4.5 shadow-none">
        <Card.Header className="gap-1">
          <Card.Title className="text-base font-semibold">Setup</Card.Title>
          <Card.Description>
            Tools Lemmata found on this computer.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <Toolchain />
          <div>
            <Button
              variant="tertiary"
              isPending={settings.isPending}
              onPress={() => settings.mutate({ onboarded: false })}
            >
              Show the welcome tour again
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
