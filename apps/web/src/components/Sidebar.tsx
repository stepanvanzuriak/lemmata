import { useState, type ComponentType, type SVGProps } from "react";
import { NavLink } from "react-router";
import { Chip, ListBox, Select, Typography, type Key } from "@heroui/react";
import {
  BookOpen,
  ChartColumn,
  CircleFill,
  Comment,
  FileText,
  GraphNode,
  Layers,
  LayoutCells,
  NodesRight,
} from "@gravity-ui/icons";
import { paths } from "../lib/paths";
import { LemmataMark } from "./LemmataMark";

type NavItem = {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: { text: string; className: string };
};

const nav: NavItem[] = [
  { to: paths.workspace, label: "Workspace", Icon: LayoutCells },
  { to: paths.canvas, label: "Research canvas", Icon: NodesRight },
  {
    to: paths.sessions,
    label: "Sessions",
    Icon: Comment,
    badge: { text: "2", className: "bg-lm-badge-green" },
  },
  { to: paths.notebook, label: "Notebook", Icon: BookOpen },
  {
    to: paths.literature,
    label: "Literature",
    Icon: FileText,
    badge: { text: "7", className: "bg-lm-badge-amber" },
  },
  { to: paths.usage, label: "Usage & budgets", Icon: ChartColumn },
];

const phase2 = [
  { label: "Research memory", Icon: Layers },
  { label: "Semantic graph", Icon: GraphNode },
];

const projects = [
  { id: "research", path: "~/research" },
  { id: "lemmata", path: "~/lemmata" },
  { id: "scratch", path: "~/scratch" },
];

const rowBase = "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm";

export function Sidebar() {
  const [project, setProject] = useState<Key | null>(projects[0].id);

  return (
    <nav
      aria-label="Primary"
      className="box-border flex grow basis-[232px] flex-col gap-5 bg-lm-nav px-3.5 py-5 text-lm-nav-text"
    >
      <div className="flex items-center gap-2.5 px-2">
        <div
          aria-hidden="true"
          className="flex size-[30px] items-center justify-center rounded-[7px] bg-lm-accent text-white"
        >
          <LemmataMark width={24} height={24} />
        </div>
        <Typography
          type="h1"
          className="m-0 text-[17px] font-semibold text-white"
        >
          Lemmata
        </Typography>
        <Chip
          size="sm"
          variant="tertiary"
          className="ml-auto bg-transparent font-mono text-[11px] text-lm-nav-muted"
        >
          v0.1
        </Chip>
      </div>

      <Select
        aria-label="Project"
        variant="secondary"
        value={project}
        onChange={setProject}
      >
        <Select.Trigger className="min-h-11 rounded-lg border border-lm-nav-line bg-lm-nav-raised px-3 text-[13px] text-lm-nav-fg">
          <Select.Value className="font-mono" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {projects.map(({ id, path }) => (
              <ListBox.Item key={id} id={id} textValue={path}>
                <span className="font-mono">{path}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex flex-col gap-0.5">
        {nav.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === paths.workspace}
            className={({ isActive }) =>
              `${rowBase} no-underline hover:text-white ${
                isActive
                  ? "bg-lm-nav-active font-medium text-white"
                  : "text-lm-nav-text"
              }`
            }
          >
            <Icon width={18} height={18} aria-hidden="true" />
            {label}
            {badge && (
              <Chip
                size="sm"
                className={`ml-auto rounded-[10px] font-mono text-[11px] text-lm-nav ${badge.className}`}
              >
                {badge.text}
              </Chip>
            )}
          </NavLink>
        ))}

        <Typography
          type="body-xs"
          className="mx-2.5 mt-3.5 mb-1.5 uppercase tracking-[0.08em] text-lm-nav-dim"
        >
          Coming in phase 2
        </Typography>
        {phase2.map(({ label, Icon }) => (
          <span key={label} className={`${rowBase} text-lm-nav-dim`}>
            <Icon width={18} height={18} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-start gap-1.5 rounded-[10px] border border-lm-nav-card-line bg-lm-nav-card p-3">
        <Chip size="sm" color="success" variant="soft">
          <CircleFill width={6} />
          <Chip.Label>Daemon running</Chip.Label>
        </Chip>
        <Typography type="body-xs" className="font-mono text-lm-nav-dim">
          127.0.0.1:4317
        </Typography>
        <Typography type="body-xs" className="text-lm-nav-dim">
          Lean 4.34.1 · Python 3.12 · uv
        </Typography>
      </div>
    </nav>
  );
}
