
## 2024-04-26 - O(1) Lookups in Discord Role Verification
**Learning:** Checking if a user has specific Discord roles inside loops or `.some()` calls by using `.includes()` on their role array causes O(N*M) performance bottlenecks. This is prominent in the JIT role verification, auto-assign panel roles, auto-join routines, and form gate checks where multiple permissions map to multiple user roles.
**Action:** When performing multiple membership checks against an array like user Discord roles inside loops or `.some()` calls, immediately convert the array to a `Set` prior to the loop. Using `Set.has()` instead of `Array.includes()` reduces the lookup complexity from O(N) to O(1) per check, dramatically speeding up role resolution for users in multiple guilds/roles.
