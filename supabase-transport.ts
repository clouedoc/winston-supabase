import { SupabaseClient } from "@supabase/supabase-js";
import Transport, { TransportStreamOptions } from "winston-transport";
import { logger } from "./logger";
import { env } from "./env";

/**
 * Describes a Winston log in the database.
 * Used to provide type definitions to Supabase.
 *
 * To create the corresponding table, execute the following:
 *
 * ```sql
 * CREATE TABLE winston_logs (
 *   level character varying,
 *   message character varying,
 *   meta json,
 *   timestamp timestamp without time zone DEFAULT now()
 * );
 *
 * ALTER TABLE winston_logs REPLICA IDENTITY FULL;
 * ```
 */
interface IDatabaseWinstonLog {
  level?: string | undefined;
  message?: string | undefined;
  meta?: Record<string, unknown>;
  timestamp?: string | undefined;
}

/**
 *`The log which is given to our dear transport.
 */
interface IInputWinstonLog {
  // metadata is stored at the same level of the rest of the properties
  [key: string]: unknown;

  level: string;
  message: string;
}

/**
 * Returns whether a log should be recorded.
 * Currently, this will be true if the metadata contains a "supabase" property set to true.
 * @param log
 */
function isLogAdmissible(log: IInputWinstonLog): boolean {
  return log.supabase === true;
}

/**
 * A Winston logger which logs to a Supabase instance.
 * Logs will be only logged when the "supabase" metadata property is set to `true`.
 * @see https://github.com/ofkindness/winston-postgres-transport/blob/develop/lib/winston-postgres-transport.js (inspiration)
 */
export class SupabaseTransport extends Transport {
  private supabase: SupabaseClient;
  private logTable: string;

  public constructor(
    options: TransportStreamOptions & {
      /**
       * The Supabase client with access to the
       * target database.
       */
      supabaseClient: SupabaseClient;
      /**
       * The name of the table containing the logs.
       *
       * To create the table, execute the following:
       *
       * ```sql
       * CREATE TABLE winston_logs (
       *   level character varying,
       *   message character varying,
       *   meta json,
       *   timestamp timestamp without time zone DEFAULT now()
       * );
       *
       * ALTER TABLE winston_logs REPLICA IDENTITY FULL;
       * ```
       */
      logTable: string;
    }
  ) {
    super(options);

    if (!env.WINSTON_LOGS_TABLE) {
      throw new Error("No log table defined");
    }

    this.supabase = options.supabaseClient;
    this.logTable = options.logTable;
  }

  public async log(log: IInputWinstonLog, next?: unknown): Promise<void> {
    // filter here if message is relevant

    // ignore inadmissible logs
    if (!isLogAdmissible(log)) {
      this.handleCallback(next);
      return;
    }

    /**
     * The metadata which should get stored in the database.
     */
    const metadata: Partial<IInputWinstonLog> = Object.assign({}, log);
    delete metadata.level;
    delete metadata.message;
    delete metadata.supabase;

    try {
      const { error } = await this.supabase
        .from<IDatabaseWinstonLog>(this.logTable)
        .insert({
          level: log.level,
          message: log.message,
          meta: metadata,
          timestamp: "NOW()",
        });

      if (error) {
        throw new Error("error inserting log: " + error.message);
      }
    } catch (err) {
      logger.error("Error logging to PostgreSQL: " + err);
    } finally {
      this.handleCallback(next);
    }
  }

  private handleCallback(next: unknown): void {
    // call the callback if provided
    if (next && typeof next === "function") {
      next();
    }
  }
}
