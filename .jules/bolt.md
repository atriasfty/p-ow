## 2024-05-20 - [Avoid groupBy + OR findMany anti-pattern]
**Learning:** When fetching the 'latest' record per user in Prisma, using `groupBy` to find the max date, followed by a `findMany` using a large `OR` array of `{userId, date}` causes performance issues and potential ConnectorErrors (especially on Postgres).
**Action:** Use a single `findMany` with `distinct: ['userId']` and an `orderBy` array where the `distinct` field is the first element (e.g., `orderBy: [{ userId: 'asc' }, { startTime: 'desc' }]`).
