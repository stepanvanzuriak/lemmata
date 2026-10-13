import type { SVGProps } from "react";

export function LemmataMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <g transform="translate(16 16) skewX(-8) translate(-16 -16)">
        <circle cx={16} cy={16} r={9.5} />
        <path d="M5.5 26.5L26.5 5.5" />
      </g>
    </svg>
  );
}
