## 2024-07-21 - [Optimize 'latest' record queries]
**Learning:** In Prisma, using `groupBy` followed by `findMany` with a dynamically generated `OR` array to fetch the "latest" record per group is an anti-pattern that leads to slow queries and high memory usage when the number of groups is large.
**Action:** Replace `groupBy` + `OR` lookup with a single `findMany` using `distinct: ['userId']` combined with `orderBy: [{ userId: 'asc' }, { startTime: 'desc' }]`. In PostgreSQL, the `distinct` field MUST be the first element in the `orderBy` array to avoid `ConnectorError`.
