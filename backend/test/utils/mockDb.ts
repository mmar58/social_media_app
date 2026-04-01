type TableName = "users" | "posts" | "comments" | "likes" | "notifications";
type Row = Record<string, any>;
type JoinType = "inner" | "left";
type Predicate = (row: Row) => boolean;

interface DatabaseState {
  users: Row[];
  posts: Row[];
  comments: Row[];
  likes: Row[];
  notifications: Row[];
}

interface JoinSpec {
  type: JoinType;
  table: TableName;
  alias: string;
  leftColumn: string;
  rightColumn: string;
}

interface SelectSpec {
  expression: string;
  alias?: string;
}

const defaultState = (): DatabaseState => ({
  users: [],
  posts: [],
  comments: [],
  likes: [],
  notifications: [],
});

let state = defaultState();
let counters: Record<TableName, number> = {
  users: 1,
  posts: 1,
  comments: 1,
  likes: 1,
  notifications: 1,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeValue(value: any) {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

function valuesEqual(left: any, right: any) {
  return normalizeValue(left) === normalizeValue(right);
}

function likeMatch(input: any, pattern: string) {
  const normalized = String(input ?? "").toLowerCase();
  const expected = pattern.toLowerCase().replace(/%/g, "");
  return normalized.includes(expected);
}

function parseTableSpec(tableSpec: string): { table: TableName; alias: string } {
  const match = tableSpec.match(/^(\w+)(?:\s+as\s+(\w+))?$/i);
  if (!match) {
    throw new Error(`Unsupported table spec: ${tableSpec}`);
  }

  return {
    table: match[1] as TableName,
    alias: match[2] || match[1],
  };
}

function withQualifiedKeys(row: Row, alias: string, table: string, includeUnqualified: boolean) {
  const qualified: Row = includeUnqualified ? { ...row } : {};
  for (const [key, value] of Object.entries(row)) {
    qualified[`${alias}.${key}`] = value;
    if (alias !== table) {
      qualified[`${table}.${key}`] = value;
    }
  }
  return qualified;
}

function readValue(row: Row, column: string) {
  if (column in row) {
    return row[column];
  }

  const [, field] = column.split(".");
  if (field && field in row) {
    return row[field];
  }

  return undefined;
}

function parseSelect(expression: string): SelectSpec {
  const match = expression.match(/^(.+?)\s+as\s+(.+)$/i);
  if (match) {
    return { expression: match[1].trim(), alias: match[2].trim() };
  }
  return { expression: expression.trim() };
}

function makeRow(table: TableName, payload: Row) {
  const now = payload.created_at || new Date().toISOString();
  if (table === "users") {
    return { profile_picture: null, created_at: now, ...payload };
  }
  if (table === "posts") {
    return { image_url: null, visibility: "public", created_at: now, ...payload };
  }
  if (table === "comments") {
    return { parent_id: null, created_at: now, ...payload };
  }
  if (table === "notifications") {
    return { is_read: false, created_at: now, ...payload };
  }
  return { created_at: now, ...payload };
}

class ConditionGroup {
  private conditions: Array<{ type: "and" | "or"; predicate: Predicate }> = [];

  where(...args: any[]) {
    this.conditions.push({ type: "and", predicate: buildPredicate(args) });
    return this;
  }

  orWhere(...args: any[]) {
    this.conditions.push({ type: "or", predicate: buildPredicate(args) });
    return this;
  }

  compile(): Predicate {
    return (row: Row) => {
      let result: boolean | undefined;
      for (const condition of this.conditions) {
        const matches = condition.predicate(row);
        if (result === undefined) {
          result = matches;
        } else if (condition.type === "or") {
          result = result || matches;
        } else {
          result = result && matches;
        }
      }
      return result ?? true;
    };
  }
}

function buildPredicate(args: any[]): Predicate {
  const [first, second, third] = args;

  if (typeof first === "function") {
    const group = new ConditionGroup();
    first.call(group);
    return group.compile();
  }

  if (typeof first === "object" && first !== null) {
    const entries = Object.entries(first);
    return (row: Row) => entries.every(([key, value]) => valuesEqual(readValue(row, key), value));
  }

  if (args.length === 2) {
    return (row: Row) => valuesEqual(readValue(row, first), second);
  }

  if (String(second).toLowerCase() === "like") {
    return (row: Row) => likeMatch(readValue(row, first), third);
  }

  if (["<", "<=", ">", ">="].includes(String(second))) {
    return (row: Row) => {
      const leftValue = normalizeValue(readValue(row, first));
      const rightValue = normalizeValue(third);

      if (second === "<") return leftValue < rightValue;
      if (second === "<=") return leftValue <= rightValue;
      if (second === ">") return leftValue > rightValue;
      return leftValue >= rightValue;
    };
  }

  return (row: Row) => valuesEqual(readValue(row, first), third);
}

class QueryBuilder {
  private readonly baseTable: TableName;
  private readonly baseAlias: string;
  private readonly joins: JoinSpec[] = [];
  private readonly selects: SelectSpec[] = [];
  private readonly conditions: Array<{ type: "and" | "or"; predicate: Predicate }> = [];
  private orderByColumn?: string;
  private orderDirection: "asc" | "desc" = "asc";
  private rowLimit?: number;
  private countAlias?: string;

  constructor(table: TableName) {
    this.baseTable = table;
    this.baseAlias = table;
  }

  select(...columns: string[]) {
    this.selects.push(...columns.map(parseSelect));
    return this;
  }

  join(tableSpec: string, leftColumn: string, rightColumn: string) {
    const { table, alias } = parseTableSpec(tableSpec);
    this.joins.push({ type: "inner", table, alias, leftColumn, rightColumn });
    return this;
  }

  leftJoin(tableSpec: string, leftColumn: string, rightColumn: string) {
    const { table, alias } = parseTableSpec(tableSpec);
    this.joins.push({ type: "left", table, alias, leftColumn, rightColumn });
    return this;
  }

  where(...args: any[]) {
    this.conditions.push({ type: "and", predicate: buildPredicate(args) });
    return this;
  }

  andWhere(...args: any[]) {
    return this.where(...args);
  }

  orWhere(...args: any[]) {
    this.conditions.push({ type: "or", predicate: buildPredicate(args) });
    return this;
  }

  whereIn(column: string, values: any[]) {
    this.conditions.push({
      type: "and",
      predicate: (row: Row) => values.some((value) => valuesEqual(readValue(row, column), value)),
    });
    return this;
  }

  orderBy(column: string, direction: "asc" | "desc" = "asc") {
    this.orderByColumn = column;
    this.orderDirection = direction;
    return this;
  }

  limit(limit: number) {
    this.rowLimit = limit;
    return this;
  }

  count(expression: string) {
    const match = expression.match(/\s+as\s+(\w+)$/i);
    this.countAlias = match?.[1] || "count";
    return this;
  }

  async first() {
    return this.execute()[0];
  }

  async insert(payload: Row | Row[]) {
    const entries = Array.isArray(payload) ? payload : [payload];
    const insertedIds: number[] = [];

    for (const entry of entries) {
      const id = counters[this.baseTable]++;
      const row = makeRow(this.baseTable, { id, ...clone(entry) });
      state[this.baseTable].push(row);
      insertedIds.push(id);
    }

    return insertedIds;
  }

  async update(patch: Row) {
    const rows = this.resolveBaseRows();
    rows.forEach((row) => Object.assign(row, clone(patch)));
    return rows.length;
  }

  async del() {
    const rows = this.resolveBaseRows();
    const ids = new Set(rows.map((row) => row.id));
    state[this.baseTable] = state[this.baseTable].filter((row) => !ids.has(row.id));
    return rows.length;
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }

  private resolveBaseRows() {
    const predicates = this.compileConditions();
    return state[this.baseTable].filter((row) => predicates(withQualifiedKeys(row, this.baseAlias, this.baseTable, true)));
  }

  private compileConditions(): Predicate {
    return (row: Row) => {
      let result: boolean | undefined;
      for (const condition of this.conditions) {
        const matches = condition.predicate(row);
        if (result === undefined) {
          result = matches;
        } else if (condition.type === "or") {
          result = result || matches;
        } else {
          result = result && matches;
        }
      }
      return result ?? true;
    };
  }

  private execute() {
    let rows = state[this.baseTable].map((row) => withQualifiedKeys(row, this.baseAlias, this.baseTable, true));

    for (const join of this.joins) {
      const joinedRows: Row[] = [];

      for (const row of rows) {
        const matches = state[join.table]
          .map((entry) => withQualifiedKeys(entry, join.alias, join.table, false))
          .filter((entry) => valuesEqual(readValue({ ...row, ...entry }, join.leftColumn), readValue({ ...row, ...entry }, join.rightColumn)));

        if (matches.length === 0 && join.type === "left") {
          joinedRows.push(row);
          continue;
        }

        for (const match of matches) {
          joinedRows.push({ ...row, ...match });
        }
      }

      rows = joinedRows;
    }

    const predicate = this.compileConditions();
    rows = rows.filter((row) => predicate(row));

    if (this.orderByColumn) {
      rows = rows.sort((left, right) => {
        const leftValue = readValue(left, this.orderByColumn!);
        const rightValue = readValue(right, this.orderByColumn!);
        const leftTime = Date.parse(String(leftValue));
        const rightTime = Date.parse(String(rightValue));
        const comparableLeft = Number.isNaN(leftTime) ? leftValue : leftTime;
        const comparableRight = Number.isNaN(rightTime) ? rightValue : rightTime;

        if (comparableLeft === comparableRight) {
          return 0;
        }

        const result = comparableLeft > comparableRight ? 1 : -1;
        return this.orderDirection === "desc" ? -result : result;
      });
    }

    if (this.countAlias) {
      rows = [{ [this.countAlias]: rows.length }];
    } else if (this.rowLimit !== undefined) {
      rows = rows.slice(0, this.rowLimit);
    }

    if (this.selects.length === 0 || this.countAlias) {
      return rows.map((row) => {
        const base: Row = {};
        for (const [key, value] of Object.entries(row)) {
          if (!key.includes(".")) {
            base[key] = value;
          }
        }
        return clone(base);
      });
    }

    return rows.map((row) => {
      const projected: Row = {};

      for (const select of this.selects) {
        if (select.expression.endsWith(".*")) {
          const prefix = `${select.expression.slice(0, -2)}.`;
          for (const [key, value] of Object.entries(row)) {
            if (key.startsWith(prefix)) {
              projected[key.slice(prefix.length)] = value;
            }
          }
          continue;
        }

        const value = readValue(row, select.expression);
        const outputKey = select.alias || select.expression.split(".").pop() || select.expression;
        projected[outputKey] = value;
      }

      return clone(projected);
    });
  }
}

type MockDb = ((table: TableName) => QueryBuilder) & {
  __reset: () => void;
  __state: () => DatabaseState;
};

const db = ((table: TableName) => new QueryBuilder(table)) as MockDb;

db.__reset = () => {
  state = defaultState();
  counters = {
    users: 1,
    posts: 1,
    comments: 1,
    likes: 1,
    notifications: 1,
  };
};

db.__state = () => clone(state);

export function resetMockDb() {
  db.__reset();
}

export function getMockState() {
  return db.__state();
}

export default db;