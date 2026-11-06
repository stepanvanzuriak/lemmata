import { Link, useNavigate, useParams } from "react-router";
import { Button, Card, Typography } from "@heroui/react";
import { Plus } from "@gravity-ui/icons";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useCanvases, useCreateCanvas } from "../api/canvases";
import { useGetAllProjects } from "../api/projects";
import { Markdown } from "../components/common/Markdown";
import { Empty, ErrorNote, Loading } from "../components/common/State";
import { paths } from "../lib/paths";
import { useProjectStore } from "../stores/project";
import { useEffect } from "react";

export function ProjectCanvasesPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const projects = useGetAllProjects();
  const canvases = useCanvases(projectId);
  const createCanvas = useCreateCanvas();
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);
  const project = projects.data?.find(({ id }) => id === projectId);

  useEffect(() => {
    if (project) {
      setCurrentProjectId(project.id);
    }
  }, [project, setCurrentProjectId]);

  const list = canvases.data ?? [];

  if (projects.isPending || canvases.isPending) {
    return <Loading label="Loading canvases..." />;
  }

  const error = projects.error ?? canvases.error;
  if (error) {
    return <ErrorNote error={error} />;
  }

  if (!project) {
    return (
      <Empty
        title="Project not found"
        action={<Link to={paths.workspace}>Back to workspace</Link>}
      />
    );
  }

  const byId = new Map(list.map((canvas) => [canvas.id, canvas]));
  const label = (title: string) => title || "Main canvas";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to={paths.workspace} className="text-sm">
          ← Workspace
        </Link>
        <Typography type="h1" className="m-0 text-[28px] font-semibold">
          <Markdown inline>{project.title}</Markdown>
        </Typography>
        <Typography type="body-sm" color="muted">
          Choose a canvas to open.
        </Typography>
      </div>
      <div className="flex items-center gap-3">
        <Typography type="h4" className="m-0 text-base font-semibold">
          Canvases
        </Typography>
        <Button
          size="sm"
          variant="secondary"
          isPending={createCanvas.isPending}
          onPress={() =>
            createCanvas.mutate(
              { projectId },
              {
                onSuccess: (canvas) => navigate(`${paths.canvas}/${canvas.id}`),
              },
            )
          }
        >
          <Plus width={14} height={14} aria-hidden="true" />
          New canvas
        </Button>
      </div>
      {list.length === 0 ? (
        <Empty title="No canvas yet" description="Create one to get started." />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
          {list.map((canvas) => {
            const parent = canvas.parentCanvasId
              ? byId.get(canvas.parentCanvasId)
              : undefined;

            return (
              <li key={canvas.id}>
                <Link
                  to={`${paths.canvas}/${canvas.id}`}
                  className="block no-underline"
                >
                  <Card className="gap-1 rounded-xl border border-lm-line px-5 py-4 shadow-none hover:border-lm-accent">
                    <Card.Title className="text-base font-semibold">
                      {label(canvas.title)}
                    </Card.Title>
                    {parent && (
                      <Typography type="body-xs" color="muted">
                        Branched from {label(parent.title)}
                      </Typography>
                    )}
                    <Typography type="body-xs" color="muted">
                      Updated{" "}
                      {formatDistanceToNow(parseISO(canvas.updatedAt), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
