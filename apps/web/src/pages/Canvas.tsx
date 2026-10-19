import "@xyflow/react/dist/style.css";
import { useRef, useState } from "react";
import { Navigate, useParams } from "react-router";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { Button } from "@heroui/react";
import type { AddNodeRequest, EdgeKind } from "shared";
import {
  useAddEdge,
  useAddNode,
  useCanvases,
  useCreateCanvas,
  useDeleteEdge,
  useDeleteNode,
  useSaveNodePositions,
} from "../api/canvases";
import { useGetAllProjects } from "../api/projects";
import { CardViewer } from "../components/canvas/CardViewer";
import { CardNode } from "../components/canvas/cards/CardNode";
import { KindEdge } from "../components/canvas/KindEdge";
import { EDGE_KINDS, EDGE_LABELS } from "../components/canvas/edges";
import { fieldsOf, type CreatableKind } from "../components/canvas/kinds";
import { Toolbar } from "../components/canvas/Toolbar";
import { useCanvasData } from "../components/canvas/useCanvasData";
import { Empty, ErrorNote, Loading } from "../components/common/State";
import { useCurrentProjectId, useTheme } from "../lib/hooks";
import { paths } from "../lib/paths";

const nodeTypes = { card: CardNode };
const edgeTypes = { kind: KindEdge };

function nextHypothesisLabel(labels: (string | undefined)[]) {
  const numbers = labels.map((label) => Number(label?.match(/^H(\d+)$/)?.[1]));
  return `H${Math.max(0, ...numbers.filter(Number.isFinite)) + 1}`;
}

function newPayload(
  kind: CreatableKind,
  labels: (string | undefined)[],
): AddNodeRequest["payload"] {
  switch (kind) {
    case "hypothesis":
      return {
        title: "New hypothesis",
        label: nextHypothesisLabel(labels),
        status: "open",
      };
    case "python":
      return { title: "Python check", source: "" };
    case "lean":
      return { title: "Lean check", source: "" };
    case "note":
      return { title: "Note" };
    case "statement":
      return { title: "New statement" };
  }
}

function CanvasEditor({ canvasId }: { canvasId: string }) {
  const { query, detail, nodes, edges, onNodesChange, onEdgesChange } =
    useCanvasData(canvasId);
  const { resolved } = useTheme();
  const { screenToFlowPosition } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Connection | null>(null);
  const addNode = useAddNode(canvasId);
  const addEdge = useAddEdge(canvasId);
  const deleteNode = useDeleteNode(canvasId);
  const deleteEdge = useDeleteEdge(canvasId);
  const savePositions = useSaveNodePositions(canvasId);

  if (query.isPending) {
    return <Loading label="Loading canvas…" />;
  }

  if (query.isError || !detail) {
    return (
      <div className="p-6">
        <ErrorNote error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const selected = detail.nodes.find(({ id }) => id === selectedId);

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
      { onSuccess: (node) => setSelectedId(node.id) },
    );
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
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={setPending}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onNodeDragStop={(_, __, moved) =>
            savePositions.mutate(
              moved.map(({ id, position }) => ({ id, ...position })),
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
          <MiniMap pannable zoomable style={{ width: 140, height: 96 }} />
          <Panel position="top-left">
            <Toolbar onCreate={create} isPending={addNode.isPending} />
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
