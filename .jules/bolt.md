## 2024-06-30 - Avoid groupBy + OR for latest records
**Learning:** When fetching the latest record per user in Prisma, using groupBy followed by a dynamically generated OR array creates massive, slow queries.
**Action:** Use a single findMany with distinct: ["userId"] and orderBy: [{ userId: "asc" }, { startTime: "desc" }] instead.
