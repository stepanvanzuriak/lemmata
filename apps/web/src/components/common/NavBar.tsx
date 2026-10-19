import { useMatch, useNavigate } from "react-router";
import { paths } from "../../lib/paths";
import { ProjectSelect } from "../project/ProjectSelect";

export function NavBar() {
  const isCanvasPage = useMatch(`${paths.canvas}/*`) !== null;
  const navigate = useNavigate();

  if (!isCanvasPage) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-8 bg-lm-surface border-b border-lm-line">
      <ProjectSelect onSelect={() => navigate(paths.canvas)} />
    </div>
  );
}
