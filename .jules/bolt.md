## 2024-07-08 - PostgreSQL Distinct Grouping Anti-Pattern
**Learning:** When fetching the latest record per user in Prisma on PostgreSQL, using `groupBy` followed by a large dynamic `OR` query is an anti-pattern that generates massive, slow queries. Using a single `distinct: ["userId"]` with an `orderBy` is much more efficient.
**Action:** Use `distinct` and ensure the distinct field is the first element in the `orderBy` array to prevent PostgreSQL ConnectorErrors.
