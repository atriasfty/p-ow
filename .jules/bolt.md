## 2024-05-24 - O(N) Sliding Window for Time-based Logging Thresholds
**Learning:** When evaluating temporal thresholds in sorted log arrays (e.g., Raid Detection checking for X events within Y seconds), nesting `Array.filter()` inside an iterative loop creates an O(N^2) bottleneck that degrades severely under load.
**Action:** Always implement a two-pointer sliding window approach (O(N)) for time-bounded array scans rather than recalculating the window size iteratively.
