## 2024-06-05 - Concurrent Database Writes for Bulk Data Processing
**Learning:** Sequential `await` statements inside a loop for batched external API or database calls (like iterating through array payloads) severely degrade performance and block the main thread unnecessarily. This is essentially an N+1 problem for writes.
**Action:** Always map the batches to an array of promises and execute them concurrently using `Promise.all()` to achieve significant speed improvements for non-dependent operations.
