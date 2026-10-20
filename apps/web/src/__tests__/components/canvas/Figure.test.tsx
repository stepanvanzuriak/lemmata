import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../../api/http";
import { Figure } from "../../../components/canvas/Figure";

afterEach(() => {
  vi.restoreAllMocks();
});

it("shows a fetched figure from a blob URL and revokes it on unmount", async () => {
  const get = vi
    .spyOn(api, "get")
    .mockResolvedValue({ data: new Blob(["x"], { type: "image/png" }) });
  const create = vi.fn(() => "blob:figure-1");
  const revoke = vi.fn();

  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
  );

  const { container, unmount } = render(
    <Figure nodeId="n1" name="fig-1.png" runAt="t0" alt="Saddle" />,
  );

  await waitFor(() =>
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "blob:figure-1",
    ),
  );
  expect(get).toHaveBeenCalledWith("/nodes/n1/figures/fig-1.png?t=t0", {
    responseType: "blob",
  });

  unmount();
  expect(revoke).toHaveBeenCalledWith("blob:figure-1");
});
