## 2024-05-27 - O(N^2) Anti-Pattern in Sliding Windows
**Learning:** Nested array iterations (like `Array.filter` inside a `for` loop) to check time-window boundaries create O(N^2) bottlenecks, especially for frequent arrays like command logs or raid detection.
**Action:** Replace nested loops with a two-pointer sliding window approach. Sort the array by timestamp (ascending) once, and maintain `left` and `right` pointers, shrinking the window (`left++`) when the difference exceeds the target window size, achieving strictly bounded O(N) operations.
