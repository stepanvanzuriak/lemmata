import { Label, ListBox, Select } from "@heroui/react";
import { useModels } from "../../api/chat";

const DEFAULT = "default";

/** Picks a model from the agent adapter's list; null means the agent's own default. */
export function ModelSelect({
  value,
  onChange,
  label,
  className,
}: {
  value: string | null;
  onChange: (model: string | null) => void;
  label?: string;
  className?: string;
}) {
  const { data: models = [] } = useModels();
  const options = [{ id: DEFAULT, label: "Default" }, ...models];

  return (
    <Select
      aria-label={label ? undefined : "Model"}
      value={value ?? DEFAULT}
      onChange={(key) => onChange(key === DEFAULT || !key ? null : String(key))}
      className={className}
    >
      {label && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
