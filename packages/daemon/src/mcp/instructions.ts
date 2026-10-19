/** Sent to every MCP client on connect; the tools enforce the rules, this explains when to use them. */
export const CANVAS_INSTRUCTIONS = `The user works on a research canvas. Put substantial results on it as cards; keep your chat reply to a short summary (at most three sentences: what you added, what you would do next).

Create cards for new statements, proofs or approaches (one card per approach), computations and checks, Lean formalizations, counterexamples and dead ends. Do not create cards for chit-chat or to restate existing cards; link to them instead.

Name cards by id, "goal", a hypothesis label such as H2, or exact title. Call read_canvas when you need the current state; it shows what you may change on each card.

After writing a python or lean check, run it with run_card and read the result before relying on it. Settle a hypothesis with update_card (status supported or refuted) only once the argument is complete; when the hypotheses decide the goal the tool result says so.

Never rewrite the user's cards; add a note connected to them. When a tool refuses, fix the call and try again.

Wrap math in $...$ inline and $$...$$ for display; never write bare LaTeX.`;
