import { useRef, useState } from "react";
import { Panel, useNodes, useReactFlow, useStore } from "@xyflow/react";
import type { CardFlowNode } from "./cards/CardNode";
import { minimapColor } from "./minimap";

const WIDTH = 140;
const HEIGHT = 96;
// How many viewports wide/tall the minimap covers around the current view.
const SPAN = 3;

interface Props {
  selectedId?: string | null;
}

// Unlike xyflow's MiniMap, which always fits every node, this only shows the
// area around the viewport so large canvases stay legible.
export function LocalMiniMap({ selectedId }: Props) {
  const nodes = useNodes<CardFlowNode>();
  const { setViewport, getZoom } = useReactFlow();
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const svg = useRef<SVGSVGElement>(null);

  const view = {
    x: -tx / zoom,
    y: -ty / zoom,
    w: width / zoom,
    h: height / zoom,
  };
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;

  // Fit the window to the minimap's aspect ratio.
  const scale = Math.max((view.w * SPAN) / WIDTH, (view.h * SPAN) / HEIGHT);
  const winW = WIDTH * scale;
  const winH = HEIGHT * scale;
  // Freeze the window while dragging, otherwise it follows the view and the
  // pointer drifts relative to the map.
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const winX = drag ? drag.x : cx - winW / 2;
  const winY = drag ? drag.y : cy - winH / 2;

  const visible = nodes.filter((n) => {
    const w = n.measured?.width ?? n.width ?? 0;
    const h = n.measured?.height ?? n.height ?? 0;
    return (
      n.position.x + w > winX &&
      n.position.x < winX + winW &&
      n.position.y + h > winY &&
      n.position.y < winY + winH
    );
  });

  const toFlow = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: winX + ((e.clientX - rect.left) / rect.width) * winW,
      y: winY + ((e.clientY - rect.top) / rect.height) * winH,
    };
  };

  const panTo = (fx: number, fy: number) => {
    const z = getZoom();
    setViewport({
      x: width / 2 - fx * z,
      y: height / 2 - fy * z,
      zoom: z,
    }).catch(() => undefined);
  };

  return (
    <Panel
      position="top-right"
      className="react-flow__minimap"
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <svg
        ref={svg}
        width={WIDTH}
        height={HEIGHT}
        viewBox={`${winX} ${winY} ${winW} ${winH}`}
        className="react-flow__minimap-svg"
        role="img"
        aria-label="Minimap"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = toFlow(e);
          // Grabbing inside the view rect keeps the grab point; elsewhere jump.
          const inside =
            p.x > view.x &&
            p.x < view.x + view.w &&
            p.y > view.y &&
            p.y < view.y + view.h;
          const dx = inside ? cx - p.x : 0;
          const dy = inside ? cy - p.y : 0;
          setDrag({ x: winX, y: winY, dx, dy });
          panTo(p.x + dx, p.y + dy);
        }}
        onPointerMove={(e) => {
          if (!drag) {
            return;
          }
          const p = toFlow(e);
          panTo(p.x + drag.dx, p.y + drag.dy);
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {visible.map((n) => (
          <rect
            key={n.id}
            x={n.position.x}
            y={n.position.y}
            width={n.measured?.width ?? n.width ?? 0}
            height={n.measured?.height ?? n.height ?? 0}
            rx={8}
            fill={minimapColor(n)}
            stroke={
              n.id === selectedId
                ? "var(--color-lm-accent)"
                : "var(--color-lm-line)"
            }
            strokeWidth={3 * scale}
          />
        ))}
        <path
          className="react-flow__minimap-mask"
          fillRule="evenodd"
          pointerEvents="none"
          d={`M${winX},${winY}h${winW}v${winH}h${-winW}z M${view.x},${view.y}h${view.w}v${view.h}h${-view.w}z`}
        />
      </svg>
    </Panel>
  );
}
