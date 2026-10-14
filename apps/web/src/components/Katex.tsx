import katex from "katex";
import "katex/dist/katex.min.css";

function render(tex: string, displayMode = false) {
  return katex.renderToString(tex, { throwOnError: false, displayMode });
}

export function Katex({ children }: { children: string }) {
  const parts = children.split(/\$([^$]+)\$/g);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: render(part) }} />
        ) : (
          part
        ),
      )}
    </>
  );
}
