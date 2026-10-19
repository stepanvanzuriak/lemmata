import { ListBox, Select } from "@heroui/react";
import { useGetAllProjects } from "../../api/projects";
import { useCurrentProjectId } from "../../lib/hooks";
import { useProjectStore } from "../../stores/project";
import { Markdown } from "../common/Markdown";

export function ProjectSelect({
  onSelect,
}: {
  onSelect?: (id: string) => void;
}) {
  const { data: projects = [] } = useGetAllProjects();
  const currentId = useCurrentProjectId(projects.map(({ id }) => id));
  const setCurrentProjectId = useProjectStore(
    (state) => state.setCurrentProjectId,
  );
  const current = projects.find(({ id }) => id === currentId);

  return (
    <Select
      aria-label="Project"
      variant="secondary"
      placeholder="No projects yet"
      isDisabled={projects.length === 0}
      value={currentId ?? null}
      onChange={(id) => {
        if (!id) {
          return;
        }
        setCurrentProjectId(String(id));
        onSelect?.(String(id));
      }}
      className="min-w-0 max-w-130 flex-[1_1_280px]"
    >
      <Select.Trigger className="h-10 rounded-lg border border-lm-line px-3 text-[13px] shadow-none">
        <Select.Value className="min-w-0 truncate">
          {({ isPlaceholder, defaultChildren }) =>
            isPlaceholder || !current ? (
              defaultChildren
            ) : (
              <Markdown inline className="truncate">
                {current.title}
              </Markdown>
            )
          }
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {projects.map(({ id, title, dir }) => (
            <ListBox.Item key={id} id={id} textValue={title}>
              <span className="flex min-w-0 flex-col">
                <Markdown inline className="truncate">
                  {title}
                </Markdown>
                {dir && (
                  <span className="truncate font-mono text-xs text-lm-muted">
                    {dir}
                  </span>
                )}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
