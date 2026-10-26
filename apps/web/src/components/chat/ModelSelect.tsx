import { Label, ListBox, Select } from "@heroui/react";
import { useSettings } from "../../api/settings";
import { useModels } from "../../api/chat";

const DEFAULT = "default";

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
  const { data: models = [], error, isPending } = useModels();
  const { data: settings } = useSettings();
  // Older agents saved only a model ID; show their original provider's model.
  const selected =
    value && !value.includes(":") && settings
      ? `${settings.agent}:${value}`
      : value;
  const options = [{ id: DEFAULT, label: "Default" }, ...models];
  if (selected && !options.some((option) => option.id === selected)) {
    options.push({ id: selected, label: `${selected} (unavailable)` });
  }

  return (
    <Select
      aria-label={label ? undefined : "Model"}
      value={selected ?? DEFAULT}
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
          {error && (
            <ListBox.Item
              id="models-error"
              textValue="Unable to load models"
              isDisabled
            >
              Unable to load models: {error.message}
            </ListBox.Item>
          )}
          {isPending && (
            <ListBox.Item
              id="models-loading"
              textValue="Loading models"
              isDisabled
            >
              Loading models…
            </ListBox.Item>
          )}
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
              isDisabled={
                option.id !== DEFAULT &&
                !models.some((model) => model.id === option.id)
              }
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
