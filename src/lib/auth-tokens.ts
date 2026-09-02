import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { TokenPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Single-use, expiring tokens for password reset and email verification.
 *
 * The raw token is returned once (to put in the link) and only its SHA-256
 * hash is stored, so a database leak cannot be replayed against the app.
 */

const TTL_MINUTES: Record<TokenPurpose, number> = {
  PASSWORD_RESET: 60,
  EMAIL_VERIFICATION: 60 * 24,
};

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  // A new token invalidates any outstanding one for the same purpose.
  await prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } });

  await prisma.authToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000),
    },
  });

  return token;
}

export interface ConsumedToken {
  userId: string;
}

/**
 * Validates and burns a token. Returns null for anything invalid — expired,
 * already used, wrong purpose, or unknown — without distinguishing between
 * them to the caller.
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<ConsumedToken | null> {
  if (!token) return null;

  const candidate = await prisma.authToken.findUnique({
    where: { tokenHash: hash(token) },
    select: {
      id: true,
      userId: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
      tokenHash: true,
    },
  });

  if (!candidate) return null;

  const expected = Buffer.from(candidate.tokenHash, "hex");
  const actual = Buffer.from(hash(token), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  if (
    candidate.purpose !== purpose ||
    candidate.usedAt !== null ||
    candidate.expiresAt < new Date()
  ) {
    return null;
  }

  // Mark used inside a conditional update so two concurrent redemptions
  // cannot both succeed.
  const burned = await prisma.authToken.updateMany({
    where: { id: candidate.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (burned.count === 0) return null;

  return { userId: candidate.userId };
}

export function appUrl(path: string): string {
  const base =
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return new URL(path, base).toString();
}
