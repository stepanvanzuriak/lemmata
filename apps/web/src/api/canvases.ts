import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddEdgeRequest,
  AddNodeRequest,
  Canvas,
  CanvasDetail,
  CanvasEdge,
  CanvasNode,
  CreateCanvasRequest,
  NodePositionInput,
  UpdateNodeRequest,
} from "shared";
import { api } from "./http";

export async function getCanvases(projectId: string) {
  const { data } = await api.get<Canvas[]>("/canvases", {
    params: { projectId },
  });

  return data;
}

export async function getCanvas(id: string) {
  const { data } = await api.get<CanvasDetail>(`/canvases/${id}`);

  return data;
}

export async function createCanvas({
  projectId,
  input = {},
}: {
  projectId: string;
  input?: CreateCanvasRequest;
}) {
  const { data } = await api.post<Canvas>(
    `/projects/${projectId}/canvases`,
    input,
  );

  return data;
}

export async function addNode({
  canvasId,
  input,
}: {
  canvasId: string;
  input: AddNodeRequest;
}) {
  const { data } = await api.post<CanvasNode>(
    `/canvases/${canvasId}/nodes`,
    input,
  );

  return data;
}

export async function updateNode({
  id,
  patch,
}: {
  id: string;
  patch: UpdateNodeRequest;
}) {
  const { data } = await api.patch<CanvasNode>(`/nodes/${id}`, patch);

  return data;
}

export async function saveNodePositions({
  canvasId,
  nodes,
}: {
  canvasId: string;
  nodes: NodePositionInput[];
}) {
  await api.patch(`/canvases/${canvasId}/nodes`, { nodes });
}

export async function setNodeCollapsed({
  id,
  collapsed,
}: {
  id: string;
  collapsed: boolean;
}) {
  const { data } = await api.patch<CanvasNode>(`/nodes/${id}/collapsed`, {
    collapsed,
  });
  return data;
}

export async function runNode(id: string) {
  const { data } = await api.post<CanvasNode>(`/nodes/${id}/run`);

  return data;
}

export async function addPaper({
  canvasId,
  arxivId,
  connectFrom,
}: {
  canvasId: string;
  arxivId: string;
  connectFrom?: string;
}) {
  const { data } = await api.post<CanvasNode>(`/canvases/${canvasId}/papers`, {
    arxivId,
    connectFrom,
  });

  return data;
}

export async function fetchPaperSource(id: string) {
  const { data } = await api.post<CanvasNode>(`/nodes/${id}/source`);

  return data;
}

export async function deleteNode(id: string) {
  const { data } = await api.delete<CanvasNode>(`/nodes/${id}`);

  return data;
}

export async function addEdge({
  canvasId,
  input,
}: {
  canvasId: string;
  input: AddEdgeRequest;
}) {
  const { data } = await api.post<CanvasEdge>(
    `/canvases/${canvasId}/edges`,
    input,
  );

  return data;
}

export async function restoreNodes({
  canvasId,
  ids,
  by,
}: {
  canvasId: string;
  ids?: string[];
  by?: string;
}) {
  const { data } = await api.post<{ restored: CanvasNode[] }>(
    `/canvases/${canvasId}/restore`,
    { ids, by },
  );

  return data;
}

export async function deleteEdge(id: string) {
  const { data } = await api.delete<CanvasEdge>(`/edges/${id}`);

  return data;
}

export const canvasKey = (id: string) => ["canvas", id] as const;
export const canvasesKey = (projectId: string) =>
  ["canvases", projectId] as const;

export function useCanvases(projectId: string) {
  return useQuery({
    queryKey: canvasesKey(projectId),
    queryFn: () => getCanvases(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCanvas(id: string) {
  return useQuery({
    queryKey: canvasKey(id),
    queryFn: () => getCanvas(id),
  });
}

export function useCreateCanvas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCanvas,
    onSuccess: (_, { projectId }) =>
      queryClient.invalidateQueries({ queryKey: canvasesKey(projectId) }),
  });
}

function useCanvasMutation<TVariables, TData>(
  canvasId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: canvasKey(canvasId) }),
  });
}

export function useAddNode(canvasId: string) {
  return useCanvasMutation(canvasId, (input: AddNodeRequest) =>
    addNode({ canvasId, input }),
  );
}

export function useUpdateNode(canvasId: string) {
  return useCanvasMutation(canvasId, updateNode);
}

export function useSaveNodePositions(canvasId: string) {
  return useCanvasMutation(canvasId, (nodes: NodePositionInput[]) =>
    saveNodePositions({ canvasId, nodes }),
  );
}

export function useSetNodeCollapsed(canvasId: string) {
  const queryClient = useQueryClient();
  const queryKey = canvasKey(canvasId);
  const mutationKey = ["canvas-collapse", canvasId];
  return useMutation({
    mutationKey,
    scope: { id: `canvas-collapse-${canvasId}` },
    mutationFn: setNodeCollapsed,
    onMutate: async ({ id, collapsed }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient
        .getQueryData<CanvasDetail>(queryKey)
        ?.nodes.find((node) => node.id === id)?.collapsed;
      queryClient.setQueryData<CanvasDetail>(
        queryKey,
        (detail) =>
          detail && {
            ...detail,
            nodes: detail.nodes.map((node) =>
              node.id === id ? { ...node, collapsed } : node,
            ),
          },
      );
      return { previous };
    },
    onError: (_, { id }, context) => {
      if (
        context?.previous !== undefined &&
        queryClient.isMutating({ mutationKey }) === 1
      ) {
        queryClient.setQueryData<CanvasDetail>(
          queryKey,
          (detail) =>
            detail && {
              ...detail,
              nodes: detail.nodes.map((node) =>
                node.id === id
                  ? { ...node, collapsed: context.previous! }
                  : node,
              ),
            },
        );
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useRunNode(canvasId: string) {
  return useCanvasMutation(canvasId, runNode);
}

export function useAddPaper(canvasId: string) {
  return useCanvasMutation(
    canvasId,
    (input: { arxivId: string; connectFrom?: string }) =>
      addPaper({ canvasId, ...input }),
  );
}

export function useFetchPaperSource(canvasId: string) {
  return useCanvasMutation(canvasId, fetchPaperSource);
}

export function useDeleteNode(canvasId: string) {
  return useCanvasMutation(canvasId, deleteNode);
}

export function useAddEdge(canvasId: string) {
  return useCanvasMutation(canvasId, (input: AddEdgeRequest) =>
    addEdge({ canvasId, input }),
  );
}

export function useDeleteEdge(canvasId: string) {
  return useCanvasMutation(canvasId, deleteEdge);
}

export function useRestoreNodes(canvasId: string) {
  return useCanvasMutation(
    canvasId,
    (filter: { ids?: string[]; by?: string } = {}) =>
      restoreNodes({ canvasId, ...filter }),
  );
}
