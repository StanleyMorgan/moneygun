declare module '@vercel/postgres' {
  type Primitive = string | number | boolean | null | undefined;
  type QueryResultRow = { [key: string]: any };

  interface QueryResult<O extends QueryResultRow> {
    rows: O[];
  }

  export function sql<O extends QueryResultRow = any>(
    strings: TemplateStringsArray,
    ...values: readonly Primitive[]
  ): Promise<QueryResult<O>>;

  export const db: {
    connect: () => Promise<any>;
  };
}
