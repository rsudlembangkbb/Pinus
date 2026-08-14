/** Generates a prefixed unique id, e.g. `emp_9f2c...`, for readability in logs/URLs. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}
