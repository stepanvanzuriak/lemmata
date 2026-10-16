import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

export function validate<
  T extends ZodType,
  Target extends keyof ValidationTargets,
>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (result.success) {
      return;
    }

    const [issue] = result.error.issues;

    if (!issue) {
      return c.json({ error: "invalid request" }, 400);
    }

    const field = issue.path.join(".");
    const message = field ? `${field}: ${issue.message}` : issue.message;

    return c.json({ error: message }, 400);
  });
}
