## 2024-06-01 - Two-Pointer Sliding Window for Temporal Closeness
**Learning:** Nested array scans inside a loop (like `Array.filter` inside a `for` loop) over sorted arrays degrade performance to O(N^2). This is a common anti-pattern when looking for temporal closeness (e.g. rate-limiting, raid detection).
**Action:** Utilize two-pointer sliding windows to strictly bound operations to O(N) when finding patterns based on temporal closeness in sorted arrays.
