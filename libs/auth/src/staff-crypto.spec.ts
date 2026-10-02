import { randomBytes } from 'node:crypto';
import {
  encryptMfa,
  decryptMfa,
  generateSecret,
  generate,
  verifyMfa,
  hashPassword,
  verifyPassword,
  tokenHash,
} from './staff-crypto';
test('password hashes and MFA encryption protect credentials and detect tampering', async () => {
  const hash = await hashPassword('long-test-password-for-fixture');
  expect(hash).toContain('argon2id');
  expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  expect(await verifyPassword(hash, 'long-test-password-for-fixture')).toBe(
    true,
  );
  const key = randomBytes(32).toString('hex');
  const encrypted = encryptMfa('fixture-secret', key);
  expect(encrypted).not.toContain('fixture-secret');
  expect(decryptMfa(encrypted, key)).toBe('fixture-secret');
  expect(() =>
    decryptMfa(encrypted, randomBytes(32).toString('hex')),
  ).toThrow();
  expect(tokenHash('token')).not.toBe('token');
});
test('TOTP verification rejects replayed and incorrect tokens', async () => {
  const secret = generateSecret();
  const token = await generate({ secret });
  const step = await verifyMfa(secret, token, null);
  expect(step).not.toBeNull();
  expect(await verifyMfa(secret, token, step)).toBeNull();
  expect(
    await verifyMfa(secret, 'bad-token', null).catch(() => null),
  ).toBeNull();
});
