## 2026-06-18 - Optimize Latest Record Fetching
**Learning:** Using `groupBy` followed by `findMany` with a large dynamically generated `OR` array is an anti-pattern for fetching the latest record per user. It causes unnecessary database load and potential connection errors.
**Action:** Use a single `findMany` with `distinct: ['userId']` and `orderBy: [{ userId: 'asc' }, { startTime: 'desc' }]`. Note that in PostgreSQL, the distinct field must be the first element in the `orderBy` array to avoid ConnectorErrors.
