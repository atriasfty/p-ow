## 2024-07-05 - Prisma ORM Query Optimization
**Learning:** Fetching the latest record per user using `groupBy` followed by `findMany` with a large dynamically generated `OR` array is an anti-pattern and can cause performance issues for large datasets.
**Action:** Use a single `findMany` query with `distinct: ["userId"]` and `orderBy: [{ userId: "asc" }, { startTime: "desc" }]` to fetch the latest record per user efficiently, being careful to match the distinct field as the first element in the orderBy array to avoid ConnectorErrors.
