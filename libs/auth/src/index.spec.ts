import { hasPermission, type Permission } from './index';
test('denies absent permissions without wildcard or paid tier shortcuts', () => {
  const permissions = new Set<Permission>(['content:read']);
  expect(hasPermission(permissions, 'content:write')).toBe(false);
  expect(hasPermission(permissions, 'content:read')).toBe(true);
  expect(hasPermission(new Set<Permission>(['*:*']), 'content:read')).toBe(
    false,
  );
});
