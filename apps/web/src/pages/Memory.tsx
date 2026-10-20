import { useState } from "react";
import { Button, Label, ListBox, Select, Typography } from "@heroui/react";
import { Plus } from "@gravity-ui/icons";
import type { MemoryKind } from "shared";
import { useGetAllProjects } from "../api/projects";
import { useMemory } from "../api/memory";
import { Markdown } from "../components/common/Markdown";
import { Empty, ErrorNote, Loading } from "../components/common/State";
import { MemoryDialog } from "../components/memory/MemoryDialog";
import { MemoryRow } from "../components/memory/MemoryRow";
import {
  MEMORY_KIND_IDS,
  MEMORY_KIND_LABELS,
} from "../components/memory/kinds";

const ALL = "all";

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string; markdown?: boolean }[];
}) {
  return (
    <Select
      value={value}
      onChange={(key) => key && onChange(String(key))}
      className="min-w-44"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map(({ id, label: text, markdown }) => (
            <ListBox.Item key={id} id={id} textValue={text}>
              {markdown ? (
                <Markdown inline className="truncate">
                  {text}
                </Markdown>
              ) : (
                text
              )}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function MemoryPage() {
  const [projectId, setProjectId] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [adding, setAdding] = useState(false);
  const projects = useGetAllProjects();
  const memory = useMemory({
    projectId: projectId === ALL ? undefined : projectId,
    kind: kind === ALL ? undefined : (kind as MemoryKind),
  });
  const projectList = projects.data ?? [];
  const filtered = projectId !== ALL || kind !== ALL;

  return (
    <div className="flex max-w-220 flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Typography type="h1" className="m-0 text-[28px] font-semibold">
            Research memory
          </Typography>
          <Typography type="body-sm" color="muted">
            Notes agents read at the start of every run. Pinned entries come
            first.
          </Typography>
        </div>
        <Button
          isDisabled={projectList.length === 0}
          onPress={() => setAdding(true)}
        >
          <Plus width={16} height={16} aria-hidden="true" />
          Add entry
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Filter
          label="Project"
          value={projectId}
          onChange={setProjectId}
          options={[
            { id: ALL, label: "All projects" },
            ...projectList.map(({ id, title }) => ({
              id,
              label: title,
              markdown: true,
            })),
          ]}
        />
        <Filter
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { id: ALL, label: "All kinds" },
            ...MEMORY_KIND_IDS.map((id) => ({
              id,
              label: MEMORY_KIND_LABELS[id],
            })),
          ]}
        />
      </div>

      {memory.isPending ? (
        <Loading label="Loading memory…" />
      ) : memory.error ? (
        <ErrorNote error={memory.error} onRetry={() => memory.refetch()} />
      ) : memory.data.length === 0 ? (
        <Empty
          title={filtered ? "No matching entries" : "Nothing remembered yet"}
          description={
            filtered
              ? "Change the filters to see more."
              : "Agents save facts, dead ends and ideas here as they work. You can add your own."
          }
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {sortEntries(memory.data).map((entry) => (
            <MemoryRow
              key={entry.id}
              entry={entry}
              project={projectList.find(({ id }) => id === entry.projectId)}
              projects={projectList}
            />
          ))}
        </ul>
      )}

      <MemoryDialog
        projects={projectList}
        isOpen={adding}
        onOpenChange={setAdding}
      />
    </div>
  );
}

/** Pinned first, then newest. */
function sortEntries<T extends { pinned: boolean; createdAt: string }>(
  entries: T[],
) {
  return [...entries].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}
