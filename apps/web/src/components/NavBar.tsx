import { SearchField, Typography } from "@heroui/react";

export function NavBar({ title }: { title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-8 bg-lm-surface border-b border-lm-line">
      <Typography type="body-sm">{title}</Typography>
      <SearchField
        name="search"
        className="min-w-0 max-w-130 flex-[1_1_280px] border-lm-line"
      >
        <SearchField.Group className="h-10 shadow-none border border-lm-line">
          <SearchField.SearchIcon />
          <SearchField.Input
            className="h-10 w-full min-w-0 border-lm-line shadow-0"
            placeholder="Search lemmas, sessions, papers..."
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </div>
  );
}
