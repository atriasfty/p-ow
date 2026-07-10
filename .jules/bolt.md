## 2024-05-24 - Database queries: distinct over groupBy
**Learning:** When fetching the 'latest' record per user in Prisma, avoid the anti-pattern of using `groupBy` followed by `findMany` with a large dynamically generated `OR` array. Instead, execute a single `findMany` using `distinct: ['userId']` combined with `orderBy`.
**Action:** Always prefer using `distinct` with `orderBy` instead of `groupBy` + `findMany` with `OR` arrays to retrieve the most recent records.
