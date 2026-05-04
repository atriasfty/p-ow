## 2024-05-04 - Optimize Repeated Clerk User Lookups
**Learning:** In data processing loops (like quota calculations mapping DB members to Clerk users), using `Array.prototype.find()` on the Clerk user array for every record results in O(N*M) complexity.
**Action:** Pre-compute a unified Map keyed by all possible identifiers (userId, discordId, robloxId) outside the loop to reduce lookups to O(1).
