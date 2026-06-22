## 2024-10-24 - Avoid groupBy+findMany OR arrays for latest record
**Learning:** When fetching the latest record per user in Prisma, using `groupBy` followed by `findMany` with a large dynamically generated `OR` array is an anti-pattern that slows down the database parser and planner.
**Action:** Use a single `findMany` query with `distinct: ["userId"]` and `orderBy: [{ userId: "asc" }, { <date_field>: "desc" }]` instead. Note that in PostgreSQL, the distinct field must be the first element in the orderBy array to prevent ConnectorErrors.
