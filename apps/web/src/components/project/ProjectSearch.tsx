import { useState } from "react";
import { ComboBox, EmptyState, Input, ListBox } from "@heroui/react";
import { useSearch } from "../../api/search";
import { useProjectStore } from "../../stores/project";

export function ProjectSearch() {
  const [query, setQuery] = useState("");
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);

  const { data: results = [] } = useSearch(query);

  return (
    <ComboBox
      aria-label="Search projects"
      className="w-full"
      allowsEmptyCollection
      menuTrigger="input"
      defaultFilter={() => true}
      inputValue={query}
      onInputChange={setQuery}
      value={null}
      onChange={(key) => {
        if (key === null) {
          return;
        }

        setCurrentProjectId(String(key));
        setQuery("");
      }}
    >
      <ComboBox.InputGroup className="h-10 shadow-none border border-lm-line">
        <Input
          autoFocus
          className="h-10 w-full min-w-0"
          placeholder="Search projects…"
        />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox
          items={results}
          renderEmptyState={() => (
            <EmptyState>
              {query.trim() ? "No projects found" : "Type to search"}
            </EmptyState>
          )}
        >
          {(result) => (
            <ListBox.Item
              id={result.id}
              textValue={result.title}
              className="flex-col items-start"
            >
              <span className="w-full truncate text-sm font-medium">
                {result.title}
              </span>
              {result.snippet && (
                <span className="w-full truncate text-xs text-lm-muted">
                  {result.snippet}
                </span>
              )}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
