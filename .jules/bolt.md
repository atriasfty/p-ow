## 2024-05-24 - Prisma groupBy Anti-Pattern
**Learning:** When fetching the latest record per user in Prisma, using groupBy followed by findMany with a dynamically generated OR array is inefficient and can cause ConnectorErrors on Postgres if the OR array is too large. Instead, use a single findMany combining distinct and orderBy, ensuring the distinct field is the first element in the orderBy array.
**Action:** Use distinct and orderBy instead of groupBy + dynamic OR arrays for latest-per-user queries.
