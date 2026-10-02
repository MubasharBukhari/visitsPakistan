import { randomBytes } from 'node:crypto';
import type { PrismaClient } from './generated/client';
import {
  decryptMfa,
  tokenHash,
  verifyMfa,
  verifyPassword,
  hashPassword,
} from '@visitspakistan/auth';
import { EditorialError, type CmsActor } from '@visitspakistan/domain';
const safeStaff = { id: true, displayName: true, roles: true } as const;
export class StaffAuth {
  private dummyHash = hashPassword('constant-dummy-not-a-login-password');
  constructor(
    private readonly db: PrismaClient,
    private readonly key: string,
  ) {}
  async login(email: string, password: string, otp: string) {
    const account = await this.db.staffAccount.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    const valid = await verifyPassword(
      account?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (
      !account ||
      !valid ||
      !account.active ||
      (account.lockedUntil && account.lockedUntil > new Date())
    ) {
      if (account) await this.failure(account.id);
      throw new EditorialError(401, 'Invalid staff credentials');
    }
    let step: bigint | null = null;
    try {
      step = await verifyMfa(
        decryptMfa(account.mfaSecret, this.key),
        otp,
        account.lastMfaStep,
      );
    } catch {
      /* same authentication error */
    }
    if (step === null) {
      await this.failure(account.id);
      throw new EditorialError(401, 'Invalid staff credentials');
    }
    const token = randomBytes(32).toString('base64url');
    await this.db.$transaction(async (tx) => {
      const result = await tx.staffAccount.updateMany({
        where: {
          id: account.id,
          active: true,
          OR: [{ lastMfaStep: null }, { lastMfaStep: { lt: step! } }],
        },
        data: { lastMfaStep: step, failedLogins: 0, lockedUntil: null },
      });
      if (result.count !== 1)
        throw new EditorialError(401, 'Invalid staff credentials');
      await tx.staffSession.create({
        data: {
          staffId: account.id,
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        },
      });
      await tx.cmsAudit.create({
        data: {
          actorId: account.id,
          action: 'staff.login',
          resourceId: account.id,
        },
      });
    });
    return {
      token,
      staff: {
        id: account.id,
        displayName: account.displayName,
        roles: account.roles,
      },
    };
  }
  private async failure(id: string) {
    await this.db.staffAccount.update({
      where: { id },
      data: { failedLogins: { increment: 1 } },
    });
    await this.db.staffAccount.updateMany({
      where: { id, failedLogins: { gte: 5 } },
      data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
    });
  }
  async authenticate(token: string): Promise<CmsActor> {
    if (!/^[a-zA-Z0-9_-]{43}$/.test(token))
      throw new EditorialError(401, 'Staff sign-in required');
    const session = await this.db.staffSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { staff: { select: { ...safeStaff, active: true } } },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      Date.now() - session.lastSeenAt.getTime() > 30 * 60 * 1000 ||
      !session.staff.active
    )
      throw new EditorialError(401, 'Staff sign-in required');
    await this.db.staffSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
    return {
      id: session.staff.id,
      displayName: session.staff.displayName,
      roles: session.staff.roles,
    };
  }
  async logout(token: string) {
    await this.db.staffSession.updateMany({
      where: { tokenHash: tokenHash(token) },
      data: { revokedAt: new Date() },
    });
  }
}
