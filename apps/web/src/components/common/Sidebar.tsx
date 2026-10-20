import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router";
import { Chip, Typography } from "@heroui/react";
import {
  BookOpen,
  ChartColumn,
  Comment,
  FileText,
  Gear,
  GraphNode,
  Layers,
  LayoutCells,
  NodesRight,
} from "@gravity-ui/icons";
import { paths } from "../../lib/paths";
import { DaemonStatus } from "./DaemonStatus";
import { LemmataMark } from "../icons/LemmataMark";

type NavItem = {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const nav: NavItem[] = [
  { to: paths.workspace, label: "Workspace", Icon: LayoutCells },
  { to: paths.canvas, label: "Research canvas", Icon: NodesRight },
  { to: paths.sessions, label: "Sessions", Icon: Comment },
  { to: paths.notebook, label: "Notebook", Icon: BookOpen },
  { to: paths.memory, label: "Research memory", Icon: Layers },
  { to: paths.literature, label: "Literature", Icon: FileText },
  { to: paths.usage, label: "Usage & budgets", Icon: ChartColumn },
];

const phase2 = [{ label: "Semantic graph", Icon: GraphNode }];

const rowBase = "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `${rowBase} no-underline hover:text-white ${
    isActive ? "bg-lm-nav-active font-medium text-white" : "text-lm-nav-text"
  }`;

export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="box-border flex grow basis-58 flex-col gap-5 bg-lm-nav px-3.5 py-5 text-lm-nav-text"
    >
      <div className="flex items-center gap-2.5 px-2">
        <div
          aria-hidden="true"
          className="flex size-7.5 items-center justify-center rounded-[7px] bg-lm-accent text-white"
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

      <div className="flex flex-col gap-0.5">
        {nav.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === paths.workspace}
            className={navLinkClass}
          >
            <Icon width={18} height={18} aria-hidden="true" />
            {label}
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

      <NavLink
        to={paths.settings}
        className={(state) => `mt-auto -mb-3 ${navLinkClass(state)}`}
      >
        <Gear width={18} height={18} aria-hidden="true" />
        Settings
      </NavLink>

      <DaemonStatus />
    </nav>
  );
}
