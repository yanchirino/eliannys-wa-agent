import type { ZodType } from "zod";

export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  schema: ZodType<I>;
  run: (input: I) => Promise<O> | O;
}
