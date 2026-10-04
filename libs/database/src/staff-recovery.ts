import { randomBytes, randomInt } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import {
  decryptMfa,
  encryptMfa,
  tokenHash,
  hashPassword,
  verifyMfa,
} from '@visitspakistan/auth';
import { EditorialError } from '@visitspakistan/domain';
import type { PrismaClient } from './generated/client';
export type RecoveryDelivery = (email: string, token: string) => Promise<void>;
const invalid = () =>
  new EditorialError(400, 'Invalid or expired recovery proof');
export class StaffPasswordRecovery {
  private timer?: ReturnType<typeof setInterval>;
  private working?: Promise<void>;
  constructor(
    private readonly db: PrismaClient,
    private readonly key: string,
    private readonly deliver?: RecoveryDelivery,
  ) {}
  onModuleInit() {
    if (!this.deliver) return;
    this.timer = setInterval(() => {
      if (!this.working)
        this.working = this.processDelivery()
          .catch(() => {
            console.error('Staff recovery delivery unavailable; retry pending');
          })
          .finally(() => {
            this.working = undefined;
          });
    }, 5000);
    this.timer.unref();
  }
  async onApplicationShutdown() {
    clearInterval(this.timer);
    await this.working;
  }
  async request(email: string) {
    if (!this.deliver)
      throw new EditorialError(503, 'Password recovery is not configured');
    const started = Date.now();
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    // A persisted cooldown and conditional update prevent concurrent request floods.
    await this.db.$transaction(async (tx) => {
      const account = await tx.staffAccount.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (!account?.active) return;
      const claimed = await tx.staffAccount.updateMany({
        where: {
          id: account.id,
          active: true,
          OR: [
            { recoveryRequestedAt: null },
            { recoveryRequestedAt: { lt: new Date(now.getTime() - 60000) } },
          ],
        },
        data: { recoveryRequestedAt: now },
      });
      if (!claimed.count) return;
      await tx.staffPasswordReset.create({
        data: {
          staffId: account.id,
          tokenHash: tokenHash(token),
          passwordVersion: account.passwordHash,
          encryptedToken: encryptMfa(token, this.key),
          expiresAt: new Date(now.getTime() + 15 * 60000),
        },
      });
    });
    await pause(Math.max(0, 150 + randomInt(51) - (Date.now() - started)));
    return {
      message:
        'If this account is eligible, a password recovery link will be sent.',
    };
  }
  async reset(token: string, password: string, otp: string) {
    const passwordHash = await hashPassword(password);
    const proof = await this.db.staffPasswordReset.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { staff: true },
    });
    const now = new Date();
    if (
      !proof ||
      proof.usedAt ||
      proof.failedAttempts >= 5 ||
      proof.expiresAt <= now ||
      !proof.staff.active ||
      proof.passwordVersion !== proof.staff.passwordHash
    )
      throw invalid();
    let step: bigint | null = null;
    try {
      step = await verifyMfa(
        decryptMfa(proof.staff.mfaSecret, this.key),
        otp,
        proof.staff.lastMfaStep,
      );
    } catch {
      /* generic proof error */
    }
    if (step === null) {
      await this.db.staffPasswordReset.updateMany({
        where: { id: proof.id, usedAt: null, failedAttempts: { lt: 5 } },
        data: { failedAttempts: { increment: 1 } },
      });
      throw invalid();
    }
    await this.db.$transaction(async (tx) => {
      const consumed = await tx.staffPasswordReset.updateMany({
        where: {
          id: proof.id,
          usedAt: null,
          failedAttempts: { lt: 5 },
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: now, encryptedToken: null },
      });
      if (!consumed.count) throw invalid();
      const changed = await tx.staffAccount.updateMany({
        where: {
          id: proof.staffId,
          active: true,
          passwordHash: proof.passwordVersion,
          OR: [{ lastMfaStep: null }, { lastMfaStep: { lt: step! } }],
        },
        data: {
          passwordHash,
          lastMfaStep: step,
          failedLogins: 0,
          lockedUntil: null,
        },
      });
      if (!changed.count) throw invalid();
      await tx.staffPasswordReset.updateMany({
        where: { staffId: proof.staffId, usedAt: null },
        data: { usedAt: now, encryptedToken: null },
      });
      await tx.staffSession.updateMany({
        where: { staffId: proof.staffId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.cmsAudit.create({
        data: {
          actorId: proof.staffId,
          resourceId: proof.staffId,
          action: 'staff.password_reset',
        },
      });
    });
    return {
      message:
        'Password updated. Sign in with your new password and a fresh authenticator code.',
    };
  }
  async processDelivery() {
    if (!this.deliver) return;
    const now = new Date();
    await this.db.staffPasswordReset.updateMany({
      where: { encryptedToken: { not: null }, expiresAt: { lte: now } },
      data: { encryptedToken: null },
    });
    const pending = await this.db.staffPasswordReset.findMany({
      where: {
        usedAt: null,
        encryptedToken: { not: null },
        expiresAt: { gt: now },
        nextAttemptAt: { lte: now },
      },
      include: { staff: true },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });
    for (const item of pending) {
      const claim = await this.db.staffPasswordReset.updateMany({
        where: {
          id: item.id,
          usedAt: null,
          encryptedToken: { not: null },
          nextAttemptAt: { lte: now },
        },
        data: {
          nextAttemptAt: new Date(Date.now() + 60000),
          deliveryAttempts: { increment: 1 },
        },
      });
      if (!claim.count) continue;
      if (
        !item.staff.active ||
        item.passwordVersion !== item.staff.passwordHash
      ) {
        await this.db.staffPasswordReset.update({
          where: { id: item.id },
          data: { encryptedToken: null },
        });
        continue;
      }
      try {
        await this.deliver(
          item.staff.email,
          decryptMfa(item.encryptedToken!, this.key),
        );
        await this.db.staffPasswordReset.update({
          where: { id: item.id },
          data: { encryptedToken: null, deliveredAt: new Date() },
        });
      } catch {
        console.error('Staff recovery message delivery failed; retry pending');
      }
    }
  }
}
