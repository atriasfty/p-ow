## 2024-06-29 - Prisma PostgreSQL Distinct Query Optimization
**Learning:** When fetching the latest record per user in Prisma with PostgreSQL, using `groupBy` followed by a large `OR` array is highly inefficient. Using `distinct` with a compound `orderBy` is much faster, but requires the distinct field to be the first element in the `orderBy` array to prevent ConnectorErrors.
**Action:** Use `distinct: ["userId"]` and `orderBy: [{ userId: "asc" }, { <sort_field>: "desc" }]` instead of `groupBy` + `findMany` when fetching latest related records.
