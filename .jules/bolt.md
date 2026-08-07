## 2024-06-26 - Optimize Latest Per User DB Query
**Learning:** When fetching the latest record per user in Prisma, using `groupBy` followed by `findMany` with a dynamically generated `OR` array is an anti-pattern. It creates two queries and the second query can fail or become very slow with a large number of users due to massive `OR` clauses.
**Action:** Use a single `findMany` with `distinct: ["userId"]` and `orderBy: [{ userId: "asc" }, { startTime: "desc" }]`. Ensure the distinct field is the first element in `orderBy` to avoid Postgres ConnectorErrors.
