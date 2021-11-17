import { z } from "zod";

export const env = z
  .object({
    /**
     * The table where the logs will be sent.
     * The columns of the table must be named `level, message, meta`
     */
    WINSTON_LOGS_TABLE: z.string().optional(),
  })
  .parse(process.env);
