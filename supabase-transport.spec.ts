import delay from "delay";
import { createLogger } from "winston";
import { supabase, definitions } from "../database";
import { throwExpression } from "../utils";
import { env } from "./env";
import { SupabaseTransport } from "./supabase-transport";

const databaseTableName =
  env.WINSTON_LOGS_TABLE ?? throwExpression("missing logging table name");

const transport = new SupabaseTransport({
  supabaseClient: supabase,
  logTable: databaseTableName,
});

const logger = createLogger({
  transports: [transport],
});

/**
 * Get the current number of logs saved in the database
 */
async function getLogsCount(): Promise<number> {
  const { data } = await supabase
    .from<definitions["winston_logs"]>("winston_logs")
    .select();

  const count: number = data?.length ?? throwExpression("no data");

  return count;
}

describe.skip("Supabase transport", () => {
  it("should log to supabase when the supabase property is set to true", async () => {
    // number of logs before running the test
    const firstCount = await getLogsCount();

    logger.info("ceci est un test", {
      supabase: true,
      testProperty: "testValue",
      testNumberProperty: 1900,
    });
    await delay(200);

    // one log should've been added
    const secondCount = await getLogsCount();
    expect(secondCount).toBe(firstCount + 1);
  });

  it.todo("should strip the supabase: true property");

  it("should not log when supabase metadata property is not set", async () => {
    const firstCount = await getLogsCount();
    logger.info("ceci est un test qui ne doit pas apparaitre dans supabase", {
      supabase: false,
    });
    logger.info("ceci ne doit pas apparaître non plus");
    logger.info("... et ça non plus", { supabase: "foobar" });
    await delay(200);

    const secondCount = await getLogsCount();
    expect(secondCount).toBe(firstCount);
  });
});
