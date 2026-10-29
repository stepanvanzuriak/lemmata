import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { Button } from "@heroui/react";
import type { AddNodeRequest, CanvasNode, EdgeKind } from "shared";
import {
  useAddEdge,
  useAddNode,
  useCanvases,
  useCreateCanvas,
  useDeleteEdge,
  useDeleteNode,
  useSaveNodePositions,
  useSetNodeCollapsed,
} from "../api/canvases";
import { useGetAllProjects } from "../api/projects";
import { AddPaperDialog } from "../components/canvas/AddPaperDialog";
import { CardViewer } from "../components/canvas/CardViewer";
import { LocalMiniMap } from "../components/canvas/LocalMiniMap";
import { collapseCards } from "../components/canvas/collapse";
import { CardNode } from "../components/canvas/cards/CardNode";
import { KindEdge } from "../components/canvas/KindEdge";
import { EDGE_KINDS, EDGE_LABELS } from "../components/canvas/edges";
import {
  fieldsOf,
  isArchived,
  type CreatableKind,
} from "../components/canvas/kinds";
import { ProgressPanel } from "../components/canvas/ProgressPanel";
import { Toolbar } from "../components/canvas/Toolbar";
import { useCanvasData } from "../components/canvas/useCanvasData";
import { ChatPanel } from "../components/chat/ChatPanel";
import { Empty, ErrorNote, Loading } from "../components/common/State";
import { useCurrentProjectId, useTheme } from "../lib/hooks";
import { useChatStore } from "../stores/chat";
import { downloadLatex } from "../lib/latex";
import { cardSize, tidyLayout } from "../lib/layout";
import { paths } from "../lib/paths";

const nodeTypes = { card: CardNode };
const edgeTypes = { kind: KindEdge };

function nextLabel(labels: (string | undefined)[], prefix: "H" | "A") {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const numbers = labels.map((label) => Number(label?.match(pattern)?.[1]));
  return `${prefix}${Math.max(0, ...numbers.filter(Number.isFinite)) + 1}`;
}

function newPayload(
  kind: CreatableKind,
  labels: (string | undefined)[],
): AddNodeRequest["payload"] {
  switch (kind) {
    case "hypothesis":
      return {
        title: "New hypothesis",
        label: nextLabel(labels, "H"),
        status: "open",
      };
    case "attack":
      return {
        title: "New attack",
        label: nextLabel(labels, "A"),
        status: "open",
      };
    case "python":
      return { title: "Python check", source: "" };
    case "lean":
      return { title: "Lean check", source: "" };
    case "toolbox":
      return {
        title: "Toolbox",
        text: "Reusable Python and Lean snippets",
        python: "",
        lean: "",
      };
    case "note":
      return { title: "Note" };
    case "statement":
      return { title: "New statement" };
  }
}

const LITERATURE_KINDS = new Set<CanvasNode["kind"]>([
  "hypothesis",
  "statement",
  "goal",
]);

/** What `/literature` checks from the toolbar: the selected card when it can be checked, else the goal. */
function literatureRef(selected?: CanvasNode) {
  if (!selected || !LITERATURE_KINDS.has(selected.kind)) {
    return "goal";
  }
  if (selected.kind === "goal") {
    return "goal";
  }
  return fieldsOf(selected).label ?? selected.id;
}

function CanvasEditor({ canvasId }: { canvasId: string }) {
  const {
    query,
    detail,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    mergeLive,
  } = useCanvasData(canvasId);
  const { resolved } = useTheme();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Connection | null>(null);
  const [addingPaper, setAddingPaper] = useState(false);
  const collapsedIds = useMemo(
    () =>
      new Set(
        nodes.filter(({ data }) => data.node.collapsed).map(({ id }) => id),
      ),
    [nodes],
  );
  const { mutate: setCollapsed } = useSetNodeCollapsed(canvasId);
  const toggleChildren = useCallback(
    (id: string) => {
      setCollapsed({ id, collapsed: !collapsedIds.has(id) });
    },
    [collapsedIds, setCollapsed],
  );
  const addNode = useAddNode(canvasId);
  const addEdge = useAddEdge(canvasId);
  const deleteNode = useDeleteNode(canvasId);
  const deleteEdge = useDeleteEdge(canvasId);
  const savePositions = useSaveNodePositions(canvasId);
  const send = (text: string) => useChatStore.getState().send?.(text);
  const showArchived = useChatStore((state) => state.showArchived);
  const setFocus = useChatStore((state) => state.setFocus);

  useEffect(() => {
    setFocus(setSelectedId);
    return () => setFocus(null);
  }, [setFocus]);

  const archivedIds = useMemo(
    () =>
      new Set(
        nodes.filter(({ data }) => isArchived(data.node)).map(({ id }) => id),
      ),
    [nodes],
  );

  const uncollapsedNodes = useMemo(() => {
    if (showArchived) {
      return nodes.map((node) =>
        archivedIds.has(node.id) ? { ...node, className: "opacity-45" } : node,
      );
    }
    return nodes.filter(({ id }) => !archivedIds.has(id));
  }, [nodes, archivedIds, showArchived]);

  const collapsedGraph = useMemo(
    () => collapseCards(uncollapsedNodes, edges, collapsedIds),
    [uncollapsedNodes, edges, collapsedIds],
  );

  const shownNodes = useMemo(
    () =>
      collapsedGraph.nodes.map((node) =>
        node.data.descendantCount
          ? {
              ...node,
              data: {
                ...node.data,
                onToggleChildren: () => toggleChildren(node.id),
              },
            }
          : node,
      ),
    [collapsedGraph.nodes, toggleChildren],
  );

  const shownEdges = useMemo(() => {
    const visible = showArchived
      ? collapsedGraph.edges
      : collapsedGraph.edges.filter(
          ({ source, target }) =>
            !archivedIds.has(source) && !archivedIds.has(target),
        );

    if (!selectedId) {
      return visible;
    }
    return visible.map((edge) => {
      const active = edge.source === selectedId || edge.target === selectedId;

      return {
        ...edge,
        data: { ...edge.data!, active, dim: !active },
      };
    });
  }, [collapsedGraph.edges, selectedId, archivedIds, showArchived]);

  if (query.isPending) {
    return <Loading label="Loading canvas..." />;
  }

  if (query.isError || !detail) {
    return (
      <div className="p-6">
        <ErrorNote error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const selected = detail.nodes.find(({ id }) => id === selectedId);
  const visibleDetail = {
    ...detail,
    nodes: detail.nodes.filter((node) => !isArchived(node)),
    edges: detail.edges.filter(
      ({ fromNode, toNode }) =>
        !archivedIds.has(fromNode) && !archivedIds.has(toNode),
    ),
  };

  const create = (kind: CreatableKind) => {
    const rect = wrapper.current!.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    const labels = detail.nodes.map((node) => fieldsOf(node).label);
    const position = { x: center.x - 128, y: center.y - 40 };
    const taken = ({ x, y }: { x: number; y: number }) =>
      detail.nodes.some(
        (node) => Math.abs(node.x - x) < 200 && Math.abs(node.y - y) < 100,
      );

    while (taken(position)) {
      position.y += 140;
    }

    addNode.mutate(
      {
        kind,
        ...position,
        payload: newPayload(kind, labels),
      },
      {
        onSuccess: (node) => {
          setSelectedId(node.id);

          if (kind === "attack" && selected?.kind === "hypothesis") {
            addEdge.mutate({
              fromNode: selected.id,
              toNode: node.id,
              kind: "depends-on",
            });
          }
        },
      },
    );
  };

  const tidy = async () => {
    const positions = await tidyLayout(
      shownNodes.map(({ id, measured, width, height, data }) => ({
        id,
        width: measured?.width ?? width ?? cardSize(data.node).width,
        height: measured?.height ?? height ?? cardSize(data.node).height,
      })),
      shownEdges.map(({ source, target }) => ({ from: source, to: target })),
    );

    onNodesChange(
      [...positions].map(([id, position]) => ({
        type: "position" as const,
        id,
        position,
      })),
    );
    savePositions.mutate(
      shownNodes.map(({ id, measured, width, height, data }) => ({
        id,
        ...positions.get(id)!,
        w: measured?.width ?? width ?? cardSize(data.node).width,
        h: measured?.height ?? height ?? cardSize(data.node).height,
      })),
    );
    requestAnimationFrame(() => fitView({ maxZoom: 1, duration: 300 }));
  };

  const connect = (kind: EdgeKind) => {
    if (pending?.source && pending.target) {
      addEdge.mutate({
        fromNode: pending.source,
        toNode: pending.target,
        kind,
      });
    }
    setPending(null);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div ref={wrapper} className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={shownNodes}
          edges={shownEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={setPending}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onNodeDoubleClick={(event, node) => {
            if (
              (event.target as HTMLElement).closest(
                "button, a, input, textarea, select",
              )
            ) {
              return;
            }
            if (node.data.descendantCount) {
              toggleChildren(node.id);
            }
          }}
          zoomOnDoubleClick={false}
          onPaneClick={() => setSelectedId(null)}
          onNodeDragStop={(_, __, moved) =>
            savePositions.mutate(
              moved.map(({ id, position, measured, width, height, data }) => ({
                id,
                ...position,
                w: measured?.width ?? width ?? cardSize(data.node).width,
                h: measured?.height ?? height ?? cardSize(data.node).height,
              })),
            )
          }
          onDelete={({ nodes: gone, edges: goneEdges }) => {
            const ids = new Set(gone.map(({ id }) => id));

            for (const id of ids) {
              deleteNode.mutate(id);
            }

            for (const edge of goneEdges) {
              if (!ids.has(edge.source) && !ids.has(edge.target)) {
                deleteEdge.mutate(edge.id);
              }
            }
            if (selectedId && ids.has(selectedId)) {
              setSelectedId(null);
            }
          }}
          deleteKeyCode={["Backspace", "Delete"]}
          colorMode={resolved}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
          <Controls showInteractive={false} />
          <LocalMiniMap selectedId={selectedId} />
          <Panel position="bottom-right">
            <ProgressPanel canvasId={canvasId} detail={visibleDetail} />
          </Panel>
          <Panel
            position="top-left"
            className="flex flex-col items-start gap-2"
          >
            <Toolbar
              onCreate={create}
              onTidy={tidy}
              onCleanup={() => send("/tidy")}
              onReset={() => send("/reset")}
              onLiterature={() =>
                send(`/literature ${literatureRef(selected)}`)
              }
              onAddPaper={() => setAddingPaper(true)}
              onExport={() => downloadLatex(visibleDetail)}
              isPending={addNode.isPending}
              hasToolbox={detail.nodes.some((node) => node.kind === "toolbox")}
            />
          </Panel>
          {pending && (
            <Panel position="top-center">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-lm-line bg-lm-surface p-1.5 shadow-sm">
                <span className="px-1.5 text-xs text-lm-muted">Link as</span>
                {EDGE_KINDS.map((kind) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant={kind === "depends-on" ? "primary" : "secondary"}
                    onPress={() => connect(kind)}
                  >
                    {EDGE_LABELS[kind]}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setPending(null)}
                >
                  Cancel
                </Button>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
      {selected && (
        <CardViewer
          key={selected.id}
          canvasId={canvasId}
          node={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
      <AddPaperDialog
        canvasId={canvasId}
        connectFrom={
          selected && !isArchived(selected) ? selected.id : undefined
        }
        isOpen={addingPaper}
        onOpenChange={setAddingPaper}
        onAdded={(node) => setSelectedId(node.id)}
      />
      <ChatPanel canvasId={canvasId} onCards={mergeLive} />
    </div>
  );
}

export function CanvasPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ReactFlowProvider>
      <CanvasEditor key={id} canvasId={id!} />
    </ReactFlowProvider>
  );
}

export function CanvasRedirect() {
  const projects = useGetAllProjects();
  const projectId = useCurrentProjectId(
    projects.data?.map(({ id }) => id) ?? [],
  );
  const canvases = useCanvases(projectId ?? "");
  const createCanvas = useCreateCanvas();

  if (projects.isPending || (projectId && canvases.isPending)) {
    return <Loading />;
  }

  const error = projects.error ?? canvases.error;
  if (error) {
    return <ErrorNote error={error} />;
  }

  const latest = canvases.data?.[0];
  if (latest) {
    return <Navigate to={`${paths.canvas}/${latest.id}`} replace />;
  }

  return (
    <Empty
      title="No canvas yet"
      description={
        projectId
          ? "This project has no canvas."
          : "Create a project on the Workspace page to get its canvas."
      }
      action={
        projectId && (
          <Button
            isPending={createCanvas.isPending}
            onPress={() => createCanvas.mutate({ projectId })}
          >
            Create canvas
          </Button>
        )
      }
    />
  );
}
