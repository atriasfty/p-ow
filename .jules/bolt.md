## 2025-01-01 - Prisma Distinct Optimization
**Learning:** Fetching the "latest" record per user in Prisma using groupBy followed by a findMany with a dynamically generated OR array is an anti-pattern. This results in slow queries, especially as the data size grows.
**Action:** Use a single findMany query with distinct: ["userId"] combined with orderBy: [{ userId: "asc" }, { startTime: "desc" }]. In PostgreSQL, the field in distinct must be the first element in the orderBy array to avoid ConnectorErrors.
