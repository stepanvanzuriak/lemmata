import { useState } from "react";
import clsx from "clsx";
import { Button, Input, Label, ListBox, Surface } from "@heroui/react";
import { useFsList, useMkdir } from "../../api/fs";
import { ErrorNote, Loading } from "../common/State";
import { ArrowUp } from "@gravity-ui/icons";

export function FolderPicker({ name = "dir" }: { name?: string }) {
  const [path, setPath] = useState<string>("");
  const [typed, setTyped] = useState<string>();

  const { data, isLoading, isPlaceholderData, error } = useFsList(path);
  const mkdir = useMkdir();

  const current = data?.path ?? "";

  const go = (next: string) => {
    setPath(next);
    setTyped(undefined);
    mkdir.reset();
  };

  const create = () => {
    const target = typed?.trim();

    if (!target) {
      return;
    }

    mkdir.mutate({ path: target }, { onSuccess: (entry) => go(entry.path) });
  };

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={current} />

      <div className="flex gap-2">
        <Button
          variant="tertiary"
          isDisabled={!data?.parent}
          onPress={() => data?.parent && go(data.parent)}
        >
          <ArrowUp /> Up
        </Button>
        <Input
          aria-label="Folder path"
          className="flex-1 font-mono"
          value={typed ?? current}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (typed?.trim()) {
                go(typed.trim());
              }
            }
          }}
        />
        <Button
          variant="tertiary"
          isDisabled={!typed?.trim() || typed.trim() === current}
          isPending={mkdir.isPending}
          onPress={create}
        >
          New folder
        </Button>
      </div>

      {error && <ErrorNote error={error} />}
      {mkdir.isError && <ErrorNote error={mkdir.error} />}

      <Surface
        className="w-full rounded-3xl shadow-surface"
        variant="secondary"
      >
        {isLoading ? (
          <Loading label="Loading folders..." />
        ) : (
          <ListBox
            aria-label="Subfolders"
            selectionMode="none"
            className={clsx("h-50 overflow-y-auto transition-opacity", {
              "opacity-60": isPlaceholderData,
            })}
            renderEmptyState={() => (
              <Label className="p-3 text-lm-muted">No subfolders</Label>
            )}
            onAction={(key) => go(String(key))}
          >
            {data?.entries?.map((entry) => (
              <ListBox.Item
                id={entry.path}
                key={entry.path}
                textValue={entry.name}
              >
                <Label>{entry.name}</Label>
              </ListBox.Item>
            ))}
          </ListBox>
        )}
      </Surface>
    </div>
  );
}
