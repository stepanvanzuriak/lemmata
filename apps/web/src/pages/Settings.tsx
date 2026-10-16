import type { ComponentType, SVGProps } from "react";
import {
  Card,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@heroui/react";
import { Display, Moon, Sun } from "@gravity-ui/icons";
import { useTheme, type ThemePreference } from "../lib/theme";

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
    </div>
  );
}
