import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { CanvasNode, CardProgress } from "shared";
import {
  ProgressSection,
  ProgressSummary,
} from "../../../components/canvas/CardProgress";
import { workOnStep } from "../../../lib/progress";

const progress: CardProgress = {
  established: [
    { text: "Helper $x^2$ identity", evidence: ["check1", "gone"] },
  ],
  remaining: ["Monotone tail limit", "Chain rule"],
  next: "Formalize the chain rule",
  updatedAt: "2026-11-06T18:00:00.000Z",
};

const check = {
  id: "check1",
  kind: "lean",
  payload: { title: "Rotation step" },
} as CanvasNode;

it("shows established results with their evidence, remaining steps and the next step", () => {
  render(<ProgressSection progress={progress} nodes={[check]} />);
  const section = screen.getByRole("region", { name: "Card progress" });

  expect(section.textContent).toContain("Established · 1");
  expect(section.textContent).toContain("Helper");
  expect(screen.getByTitle("check1").textContent).toBe("Rotation step");
  // An evidence card that is not loaded falls back to a short id.
  expect(screen.getByTitle("gone").textContent).toBe("gone");
  expect(section.textContent).toContain("Remaining · 2");
  expect(section.textContent).toContain("Monotone tail limit");
  expect(section.textContent).toContain("Next: Formalize the chain rule");
});

it("summarises progress on the canvas card, and nothing without a record", () => {
  const { container, rerender } = render(
    <ProgressSummary progress={progress} />,
  );
  expect(container.textContent).toBe("1 established·2 remaining");
  rerender(<ProgressSummary />);
  expect(container.textContent).toBe("");
});

it("offers a button per remaining step and for the next step", () => {
  const onWork = vi.fn();
  render(<ProgressSection progress={progress} nodes={[]} onWork={onWork} />);

  fireEvent.click(
    screen.getByRole("button", {
      name: "Ask the prover to work on: Chain rule",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Ask the prover to work on: Formalize the chain rule",
    }),
  );
  expect(onWork.mock.calls).toEqual([
    ["Chain rule"],
    ["Formalize the chain rule"],
  ]);
});

it("has no step buttons without a chat to send to", () => {
  render(<ProgressSection progress={progress} nodes={[]} />);
  expect(screen.queryByRole("button", { name: /Ask the prover/ })).toBeNull();
});

it("collapses to a one-line summary and expands again", () => {
  render(<ProgressSection progress={progress} nodes={[]} />);
  const toggle = screen.getByRole("button", { name: "Progress" });
  const section = screen.getByRole("region", { name: "Card progress" });

  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(section.textContent).not.toContain("Monotone tail limit");
  expect(section.textContent).toContain("1 established·2 remaining");

  fireEvent.click(toggle);
  expect(section.textContent).toContain("Monotone tail limit");
});

it("names the card by id in the prover request", () => {
  const attack = { id: "01ABC", kind: "attack", payload: { label: "A413" } };
  const request = workOnStep(attack as CanvasNode, "Chain rule");
  expect(request.startsWith("/prover 01ABC Work on this step")).toBe(true);
  expect(request).toContain("Chain rule");
  expect(request).toContain("update_progress");
});
