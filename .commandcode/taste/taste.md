# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# Performance
- Profile before optimizing — measure each pipeline step in isolation, optimize only measured bottlenecks, and provide before/after benchmark numbers for each change. Confidence: 0.85
- Keep safe defaults (e.g., crypto.randomUUID()) and add configurable fast-paths rather than replacing safe defaults with fast alternatives. Confidence: 0.75
- Track both RSS and heapUsed for memory measurements, force GC before each snapshot, and document that separate-process benchmarking is the most reliable mode. Confidence: 0.80

# Benchmarking
- Use each framework's recommended Bun-native server setup for fairness comparisons — avoid Node adapters or artificial wrappers. Confidence: 0.70
- Prefer caching or precompiling middleware pipelines per route over optimizing dispatch mechanics like bind() calls. Confidence: 0.70

