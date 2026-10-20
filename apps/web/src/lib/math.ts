const displayBlock = (tex: string) => `\n$$\n${tex.trim()}\n$$\n`;

export function normalizeMath(text: string) {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => displayBlock(tex))
    .replace(/^[ \t]*\$\$([^\n]+?)\$\$[ \t]*$/gm, (_, tex: string) =>
      displayBlock(tex),
    )
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => `$${tex}$`);
}

const GREEK =
  /(?<![\\A-Za-z])(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|kappa|lambda|mu|nu|xi|rho|sigma|tau|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Sigma|Phi|Psi|Omega)(?![A-Za-z])/g;
const OPERATOR = /^(<=|>=|!=|=|<|>|≤|≥|≠|\+|-|\*|\/)$/;
/** Subscripts, powers and TeX commands only appear in math. */
const STRONG = /[_^\\]/;
/** Short symbolic runs such as k+1 or n(n-1)/(k(k-1)+2): operators or brackets, no real words. */
const EXPRESSION = /^[\p{L}\d()[\]{}+\-*/=<>|.,']+$/u;
const PUNCTUATION = /[,.;:!?]+$/;

function isMath(token: string) {
  if (STRONG.test(token)) {
    return true;
  }
  return (
    EXPRESSION.test(token) &&
    /[()+*/=<>[\]{}|]|\d-|-\d/u.test(token) &&
    !/\p{L}{3}/u.test(token.replace(GREEK, ""))
  );
}

const toTex = (math: string) =>
  math
    .replace(/<=|≤/g, "\\le ")
    .replace(/>=|≥/g, "\\ge ")
    .replace(/!=|≠/g, "\\ne ")
    .replace(GREEK, "\\$1")
    .replace(/ {2,}/g, " ");

/**
 * Wraps bare math in short text, such as a card title an agent wrote as
 * `f_k(n) <= n^2/12`, in `$...$`. Text already inside `$...$` or backticks is left alone.
 */
export function wrapBareMath(text: string) {
  return text
    .split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$|`[^`]+`)/)
    .map((part, index) => (index % 2 === 1 ? part : wrapPlain(part)))
    .join("");
}

function wrapPlain(text: string) {
  const tokens = text.split(/(\s+)/);
  const out: string[] = [];
  let run: string[] = [];

  const flush = () => {
    // A lone operator between words (a hyphen, a slash) is prose, not math.
    if (
      run.length > 0 &&
      !run.every((t) => OPERATOR.test(t.trim()) || !t.trim())
    ) {
      const trailing = run.at(-1)!.match(PUNCTUATION)?.[0] ?? "";
      const body = run.join("").slice(0, run.join("").length - trailing.length);
      out.push(`$${toTex(body.trim())}$${trailing}`);
    } else {
      out.push(...run);
    }
    run = [];
  };

  for (const token of tokens) {
    const bare = token.replace(PUNCTUATION, "");

    if (!token.trim()) {
      (run.length > 0 ? run : out).push(token);
      continue;
    }
    if (isMath(bare) || (OPERATOR.test(bare) && run.length > 0)) {
      run.push(token);
      if (bare !== token) {
        flush();
      }
      continue;
    }
    if (OPERATOR.test(bare)) {
      run.push(token);
      continue;
    }

    // Trailing whitespace stays outside the math.
    const space = run.length > 0 && !run.at(-1)!.trim() ? run.pop()! : "";
    flush();
    out.push(space, token);
  }

  const space = run.length > 0 && !run.at(-1)!.trim() ? run.pop()! : "";
  flush();
  out.push(space);
  return out.join("");
}
