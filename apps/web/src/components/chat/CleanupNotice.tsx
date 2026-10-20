import { Button } from "@heroui/react";
import { Archive } from "@gravity-ui/icons";
import { useRestoreNodes } from "../../api/canvases";
import { useChatStore } from "../../stores/chat";

/**
 * Shown in the chat under the reply of a tidy or reset run (`by` is its attempt), or at the
 * top for cards archived some other way. Undo brings back the cards and any chat a reset hid.
 */
export function CleanupNotice({
  canvasId,
  count,
  by,
}: {
  canvasId: string;
  count: number;
  by?: string;
}) {
  const restore = useRestoreNodes(canvasId);
  const shown = useChatStore((state) => state.showArchived);
  const setShown = useChatStore((state) => state.setShowArchived);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-dashed border-lm-line px-2.5 py-1 text-xs text-lm-muted">
      <Archive width={14} height={14} aria-hidden="true" />
      <span className="mr-auto">
        {count} {by ? "" : "earlier "}
        {count === 1 ? "card" : "cards"} archived
      </span>
      <Button size="sm" variant="ghost" onPress={() => setShown(!shown)}>
        {shown ? "Hide" : "Show"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        isPending={restore.isPending}
        onPress={() => restore.mutate(by ? { by } : {})}
      >
        {by ? "Undo" : "Restore all"}
      </Button>
    </div>
  );
}
