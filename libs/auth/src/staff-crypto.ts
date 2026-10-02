import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { hash, verify as verifyPassword } from '@node-rs/argon2';
import {
  verify as verifyOtp,
  generateSecret,
  generate,
  generateURI,
} from 'otplib';
export { generateSecret, generate, generateURI };
export const hashPassword = (password: string) =>
  hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export { verifyPassword };
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function encryptMfa(secret: string, key: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), nonce);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [nonce, cipher.getAuthTag(), data]
    .map((b) => b.toString('base64url'))
    .join('.');
}
export function decryptMfa(value: string, key: string) {
  const [nonce, tag, data] = value
    .split('.')
    .map((v) => Buffer.from(v, 'base64url'));
  if (!nonce || !tag || !data) throw new Error('Invalid MFA envelope');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    nonce,
  );
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
export async function verifyMfa(
  secret: string,
  token: string,
  lastStep: bigint | null,
) {
  const result = await verifyOtp({
    secret,
    token,
    epochTolerance: 30,
    afterTimeStep: lastStep === null ? undefined : Number(lastStep),
  });
  return result.valid && 'timeStep' in result ? BigInt(result.timeStep) : null;
}
