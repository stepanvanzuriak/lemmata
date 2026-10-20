import { useEffect, useState } from "react";
import { api } from "./http";

export function useFigureUrl(nodeId: string, name: string, runAt: string) {
  const key = `${nodeId}/${name}/${runAt}`;
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .get<Blob>(
        `/nodes/${nodeId}/figures/${name}?t=${encodeURIComponent(runAt)}`,
        { responseType: "blob" },
      )
      .then(({ data }) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(data);
          setLoaded({ key, url: objectUrl });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [key, nodeId, name, runAt]);

  return loaded?.key === key ? loaded.url : null;
}
