import { Buffer } from "node:buffer";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
  type ChannelVersions,
  type PendingWrite,
} from "@langchain/langgraph-checkpoint";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}

const CREATE_CHECKPOINTS = `CREATE TABLE IF NOT EXISTS checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type TEXT,
  checkpoint TEXT NOT NULL,
  metadata TEXT NOT NULL,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id))`;

const CREATE_WRITES = `CREATE TABLE IF NOT EXISTS writes (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  channel TEXT NOT NULL,
  type TEXT,
  value TEXT,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx))`;

const enc = (b: Uint8Array) => Buffer.from(b).toString("base64");
const dec = (s: string) => Buffer.from(s, "base64");

function parts(config: RunnableConfig) {
  const c = (config.configurable ?? {}) as Record<string, string | undefined>;
  return { thread_id: c.thread_id ?? "", checkpoint_ns: c.checkpoint_ns ?? "", checkpoint_id: c.checkpoint_id };
}

export class D1Saver extends BaseCheckpointSaver {
  private setupDone: Promise<void> | null = null;

  constructor(private db: D1Database, serde?: ConstructorParameters<typeof BaseCheckpointSaver>[0]) {
    super(serde);
  }

  private setup(): Promise<void> {
    return (this.setupDone ??= (async () => {
      await this.db.prepare(CREATE_CHECKPOINTS).run();
      await this.db.prepare(CREATE_WRITES).run();
    })());
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    await this.setup();
    const { thread_id, checkpoint_ns, checkpoint_id } = parts(config);
    if (!thread_id) return undefined;

    const cols = "checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata";
    const row = (checkpoint_id
      ? await this.db
          .prepare(`SELECT ${cols} FROM checkpoints WHERE thread_id=? AND checkpoint_ns=? AND checkpoint_id=?`)
          .bind(thread_id, checkpoint_ns, checkpoint_id)
          .first()
      : await this.db
          .prepare(`SELECT ${cols} FROM checkpoints WHERE thread_id=? AND checkpoint_ns=? ORDER BY checkpoint_id DESC LIMIT 1`)
          .bind(thread_id, checkpoint_ns)
          .first()) as Record<string, string | null> | null;
    if (!row) return undefined;

    const type = row.type ?? "";
    const cid = row.checkpoint_id as string;
    const checkpoint = (await this.serde.loadsTyped(type, dec(row.checkpoint as string))) as Checkpoint;
    const metadata = (await this.serde.loadsTyped(type, dec(row.metadata as string))) as CheckpointMetadata;

    const writes = await this.db
      .prepare(`SELECT task_id, channel, type, value FROM writes WHERE thread_id=? AND checkpoint_ns=? AND checkpoint_id=? ORDER BY task_id, idx`)
      .bind(thread_id, checkpoint_ns, cid)
      .all<Record<string, string>>();
    const pendingWrites = await Promise.all(
      writes.results.map(
        async (w) =>
          [w.task_id, w.channel, await this.serde.loadsTyped(w.type ?? "", dec(w.value))] as [string, string, unknown],
      ),
    );

    return {
      config: { configurable: { thread_id, checkpoint_ns, checkpoint_id: cid } },
      checkpoint,
      metadata,
      parentConfig: row.parent_checkpoint_id
        ? { configurable: { thread_id, checkpoint_ns, checkpoint_id: row.parent_checkpoint_id } }
        : undefined,
      pendingWrites,
    };
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    await this.setup();
    const { thread_id, checkpoint_ns } = parts(config);
    const before = (options?.before?.configurable as Record<string, string> | undefined)?.checkpoint_id;

    let sql = `SELECT checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata FROM checkpoints WHERE thread_id=? AND checkpoint_ns=?`;
    const binds: unknown[] = [thread_id, checkpoint_ns];
    if (before) {
      sql += ` AND checkpoint_id < ?`;
      binds.push(before);
    }
    sql += ` ORDER BY checkpoint_id DESC`;
    if (options?.limit) {
      sql += ` LIMIT ?`;
      binds.push(options.limit);
    }

    const res = await this.db.prepare(sql).bind(...binds).all<Record<string, string | null>>();
    for (const row of res.results) {
      const type = row.type ?? "";
      yield {
        config: { configurable: { thread_id, checkpoint_ns, checkpoint_id: row.checkpoint_id as string } },
        checkpoint: (await this.serde.loadsTyped(type, dec(row.checkpoint as string))) as Checkpoint,
        metadata: (await this.serde.loadsTyped(type, dec(row.metadata as string))) as CheckpointMetadata,
        parentConfig: row.parent_checkpoint_id
          ? { configurable: { thread_id, checkpoint_ns, checkpoint_id: row.parent_checkpoint_id } }
          : undefined,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    await this.setup();
    const { thread_id, checkpoint_ns, checkpoint_id: parent } = parts(config);
    const [type, cpBytes] = this.serde.dumpsTyped(checkpoint);
    const [, metaBytes] = this.serde.dumpsTyped(metadata);
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(thread_id, checkpoint_ns, checkpoint.id, parent ?? null, type, enc(cpBytes), enc(metaBytes))
      .run();
    return { configurable: { thread_id, checkpoint_ns, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    await this.setup();
    const { thread_id, checkpoint_ns, checkpoint_id } = parts(config);
    if (!checkpoint_id) return;
    const stmts = writes.map(([channel, value], idx) => {
      const [type, bytes] = this.serde.dumpsTyped(value);
      return this.db
        .prepare(
          `INSERT OR REPLACE INTO writes (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(thread_id, checkpoint_ns, checkpoint_id, taskId, idx, channel, type, enc(bytes));
    });
    if (stmts.length) await this.db.batch(stmts);
  }
}
