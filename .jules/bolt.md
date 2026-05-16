## 2024-05-16 - O(N*M) user lookup in data mapping loops
**Learning:** Found multiple instances where `Array.prototype.find()` was used to look up Clerk users within `.map()` or `for` loops (e.g., `dashboard/src/app/api/staff/on-duty/route.ts`). This causes O(N*M) complexity when merging database records with Clerk data.
**Action:** Always pre-compute an O(1) lookup `Map` keyed by identifiers (like `user.id`) before iterating over data to merge or transform it. Both native `.find()` and `Map.get()` return `undefined` on failure, ensuring falsy checks continue to work without modification.
