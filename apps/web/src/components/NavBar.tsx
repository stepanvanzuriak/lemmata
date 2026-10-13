import { SearchField, Typography } from "@heroui/react";

export function NavBar({ title }: { title: string }) {
  return (
    <div className="h-17 gap-5 flex items-center px-6 bg-lm-surface border-b border-lm-line">
      <Typography type="body-sm">{title}</Typography>
      <SearchField name="search" className="border-lm-line">
        <SearchField.Group className="h-10 shadow-none border border-lm-line">
          <SearchField.SearchIcon />
          <SearchField.Input
            className="w-135 h-10 border-lm-line shadow-0"
            placeholder="Search lemmas, sessions, papers..."
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </div>
  );
}
