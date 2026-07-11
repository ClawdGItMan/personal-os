import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A tiny in-memory stand-in for the RLS-scoped Supabase client, covering
 * exactly the query shapes `context.ts`/`tools.ts` use: `select` (with
 * `eq`/`gte`/`lte`/`lt`/`gt`/`is`/`not`/`order`/`limit`, awaited directly for
 * a list or terminated with `.maybeSingle()`/`.single()`), `insert`,
 * `update`, `delete`, and a minimal `upsert` (matches on the `onConflict`
 * columns, merges on hit, inserts on miss — mirrors the real partial-merge
 * upsert behavior `sync/whoop.ts` relies on).
 *
 * Not a general Postgrest emulator — just enough surface for these two
 * modules' unit tests. Seed with `{ tableName: [rows...] }`.
 */

type Row = Record<string, unknown>;
type FilterOp = "eq" | "gte" | "lte" | "gt" | "lt" | "is" | "not-is";

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

/** Orders values the way Postgres would for our column types: numbers
 * numerically, ISO-date-like strings chronologically, everything else
 * lexicographically. `null`/`undefined` sort first. */
function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const as = String(a);
  const bs = String(b);
  const ad = Date.parse(as);
  const bd = Date.parse(bs);
  if (!Number.isNaN(ad) && !Number.isNaN(bd)) return ad - bd;
  return as < bs ? -1 : as > bs ? 1 : 0;
}

class FakeQueryBuilder {
  private filters: Array<{ col: string; op: FilterOp; val: unknown }> = [];
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private conflictCols: string[] | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;

  constructor(
    private readonly table: string,
    private readonly db: Map<string, Row[]>,
  ) {
    if (!db.has(table)) db.set(table, []);
  }

  select(): this {
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filters.push({ col, op: "gte", val });
    return this;
  }
  lte(col: string, val: unknown): this {
    this.filters.push({ col, op: "lte", val });
    return this;
  }
  gt(col: string, val: unknown): this {
    this.filters.push({ col, op: "gt", val });
    return this;
  }
  lt(col: string, val: unknown): this {
    this.filters.push({ col, op: "lt", val });
    return this;
  }
  is(col: string, val: unknown): this {
    this.filters.push({ col, op: "is", val });
    return this;
  }
  not(col: string, _op: string, val: unknown): this {
    this.filters.push({ col, op: "not-is", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  insert(row: Row | Row[]): this {
    this.mode = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row): this {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  upsert(row: Row, opts?: { onConflict?: string }): this {
    this.mode = "upsert";
    this.payload = row;
    this.conflictCols = opts?.onConflict ? opts.onConflict.split(",") : ["id"];
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const v = row[f.col];
      switch (f.op) {
        case "eq":
          return v === f.val;
        case "gte":
          return cmp(v, f.val) >= 0;
        case "lte":
          return cmp(v, f.val) <= 0;
        case "gt":
          return cmp(v, f.val) > 0;
        case "lt":
          return cmp(v, f.val) < 0;
        case "is":
          return f.val === null ? v == null : v === f.val;
        case "not-is":
          return f.val === null ? v != null : v !== f.val;
        default:
          return false;
      }
    });
  }

  private applyOrderLimit(rows: Row[]): Row[] {
    let out = rows.slice();
    const col = this.orderCol;
    if (col) {
      out = out.sort((a, b) => (this.orderAsc ? cmp(a[col], b[col]) : cmp(b[col], a[col])));
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  private table_(): Row[] {
    return this.db.get(this.table) ?? [];
  }

  private runSelect(): Row[] {
    return this.applyOrderLimit(this.table_().filter((r) => this.matches(r)));
  }

  private runInsert(): Row[] {
    const table = this.table_();
    const rowsIn = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
    const inserted = rowsIn.map((r) => {
      const row: Row = { id: randomId(), created_at: new Date().toISOString(), ...r };
      table.push(row);
      return row;
    });
    this.db.set(this.table, table);
    return inserted;
  }

  private runUpdate(): Row[] {
    const table = this.table_();
    const patch = (this.payload as Row) ?? {};
    const affected: Row[] = [];
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      if (row && this.matches(row)) {
        const updated = { ...row, ...patch };
        table[i] = updated;
        affected.push(updated);
      }
    }
    this.db.set(this.table, table);
    return affected;
  }

  private runDelete(): Row[] {
    const table = this.table_();
    const kept: Row[] = [];
    const removed: Row[] = [];
    for (const row of table) {
      if (this.matches(row)) removed.push(row);
      else kept.push(row);
    }
    this.db.set(this.table, kept);
    return removed;
  }

  private runUpsert(): Row[] {
    const table = this.table_();
    const incoming = (this.payload as Row) ?? {};
    const cols = this.conflictCols ?? ["id"];
    const idx = table.findIndex((r) => cols.every((c) => r[c] === incoming[c]));
    if (idx >= 0) {
      const existing = table[idx];
      const merged = { ...existing, ...incoming };
      table[idx] = merged;
      this.db.set(this.table, table);
      return [merged];
    }
    const row: Row = { id: randomId(), created_at: new Date().toISOString(), ...incoming };
    table.push(row);
    this.db.set(this.table, table);
    return [row];
  }

  private resolveRows(): Row[] {
    switch (this.mode) {
      case "select":
        return this.runSelect();
      case "insert":
        return this.runInsert();
      case "update":
        return this.runUpdate();
      case "delete":
        return this.runDelete();
      case "upsert":
        return this.runUpsert();
      default:
        return [];
    }
  }

  async maybeSingle(): Promise<{ data: Row | null; error: null }> {
    const rows = this.resolveRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: Row | null; error: { message: string } | null }> {
    const rows = this.resolveRows();
    if (rows.length === 0) {
      return { data: null, error: { message: `fake-supabase: no row in "${this.table}" matched .single()` } };
    }
    return { data: rows[0] ?? null, error: null };
  }

  // Makes the builder itself awaitable for list-mode calls, e.g.
  // `const { data, error } = await supabase.from(t).select("*").eq(...)`.
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.resolveRows(), error: null }).then(onfulfilled, onrejected);
  }
}

export type FakeSeed = Record<string, Row[]>;

/** Builds a fake `SupabaseClient<Database>`, seeded with `seed`. Rows are
 * deep-copied so mutations during a test never leak into the seed object.
 * Returns the live `db` map alongside the client so tests can assert on
 * rows a write actually produced (e.g. "was a habit_logs row inserted"),
 * without threading assertions through the tool's return value alone. */
export function createFakeSupabase(seed: FakeSeed = {}): {
  client: SupabaseClient<Database>;
  db: Map<string, Row[]>;
} {
  const db = new Map<string, Row[]>(
    Object.entries(seed).map(([table, rows]) => [table, rows.map((r) => ({ ...r }))]),
  );
  const client = {
    from(table: string) {
      return new FakeQueryBuilder(table, db);
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, db };
}
