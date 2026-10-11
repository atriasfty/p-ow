## 2025-05-24 - API Batching & O(1) Lookups
**Learning:** Sequential await statements inside a loop severely degrade performance when batching external API calls (e.g. bypassing limits). Also, Array.find() inside mapping loops creates O(N*M) complexity.
**Action:** Use Promise.all to concurrently fetch API chunks and pre-compute O(1) lookup Maps to reduce mapping complexity to O(N).
