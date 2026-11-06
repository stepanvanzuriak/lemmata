import { useMatch } from "react-router";
import { paths } from "../../lib/paths";

export const CRUMB_SLOT_ID = "canvas-crumb-slot";

export function NavBar() {
  const isCanvasPage = useMatch(`${paths.canvas}/*`) !== null;

  if (!isCanvasPage) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-8 bg-lm-surface border-b border-lm-line">
      <div id={CRUMB_SLOT_ID} className="flex items-center" />
    </div>
  );
}
