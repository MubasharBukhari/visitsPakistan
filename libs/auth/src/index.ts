/** Pure permission contract. Authentication/session flows are deferred. */
export type Permission = `${string}:${string}`;
export function hasPermission(
  granted: ReadonlySet<Permission>,
  required: Permission,
): boolean {
  return granted.has(required);
}
export * from './staff-crypto';
