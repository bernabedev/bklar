/**
 * Fast ID generator for request IDs.
 *
 * Uses a process-level random prefix plus an incrementing counter
 * instead of crypto.randomUUID() on every request.
 *
 * Note: Not suitable for security-sensitive contexts (tokens, secrets).
 * Use crypto.randomUUID() for those.
 */

let _defaultIdGen: (() => string) | null = null;

export function createFastIdGenerator(prefix?: string): () => string {
  const nodeId = prefix ?? Math.random().toString(36).slice(2, 10);
  let counter = 0;
  return () => `${nodeId}-${(counter++).toString(36)}`;
}

/**
 * Get or lazily-initialize the default fast ID generator.
 */
export function getDefaultFastIdGen(): () => string {
  if (!_defaultIdGen) {
    _defaultIdGen = createFastIdGenerator();
  }
  return _defaultIdGen;
}
