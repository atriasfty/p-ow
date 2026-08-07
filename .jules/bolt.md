## 2024-05-18 - Avoid groupBy followed by findMany for latest records
**Learning:** Using `prisma.shift.groupBy` followed by `prisma.shift.findMany` with an OR array is a common N+1 anti-pattern when fetching the "latest" records per user. The OR array grows proportionally with the number of users, causing extremely slow query times.
**Action:** Replace this pattern with a single `findMany` using `distinct: ['userId']` combined with `orderBy: { startTime: 'desc' }`. This leverages Prisma's distinct feature which is much more performant than a groupBy + large OR list.
