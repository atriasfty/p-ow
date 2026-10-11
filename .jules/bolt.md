# Bolt Performance Journal

## 2024-05-24 - Prisma Latest Record Anti-Pattern
**Learning:** When fetching the "latest" record per user in Prisma (e.g., for shifts), using groupBy followed by findMany with a large dynamically generated OR array is an anti-pattern that creates large query payloads and sequential latency.
**Action:** Use a single findMany query combining distinct: ["userId"] with orderBy: [{ userId: "asc" }, { startTime: "desc" }]. Crucially for PostgreSQL, the field used in distinct MUST be the first element in the orderBy array to avoid ConnectorErrors.
