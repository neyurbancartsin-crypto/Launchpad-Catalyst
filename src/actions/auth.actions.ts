"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { appUrl, consumeToken, issueToken } from "@/lib/auth-tokens";
import { getMailer } from "@/lib/mailer";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

export interface AuthFormState {
  error?: string;
  notice?: string;
}

const emailField = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "That password is too long");

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: emailField,
  password: passwordField,
});

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const { name, email, password } = parsed.data;

  const limited = rateLimit(`signup:${email}`, LIMITS.signup.limit, LIMITS.signup.windowSeconds);
  if (!limited.allowed) {
    return { error: "Too many attempts. Try again later." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });

  await sendVerificationEmail(user.id, email, name);

  // signIn redirects on success; a thrown redirect must not be swallowed.
  await signIn("credentials", {
    email,
    password,
    redirectTo: "/onboarding",
  });

  return {};
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "") || "/dashboard";

  if (!email || !password) {
    return { error: "Enter your email and password" };
  }

  const limited = rateLimit(`login:${email}`, LIMITS.login.limit, LIMITS.login.windowSeconds);
  if (!limited.allowed) {
    return {
      error: `Too many sign-in attempts. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minutes.`,
    };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password" };
    }
    throw error;
  }

  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// --- Password reset ---------------------------------------------------------

/**
 * Always reports success, whether or not the address has an account — telling
 * an anonymous caller which emails are registered is an information leak.
 */
export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailField.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Enter a valid email address" };
  }
  const email = parsed.data;

  const notice =
    "If that email has an account, a reset link is on its way. The link expires in an hour.";

  const limited = rateLimit(
    `pwreset:${email}`,
    LIMITS.passwordReset.limit,
    LIMITS.passwordReset.windowSeconds,
  );
  if (!limited.allowed) return { notice };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (user) {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);

    await getMailer().send({
      to: email,
      subject: "Reset your Launchpad Catalyst password",
      body: [
        `Hi${user.name ? ` ${user.name}` : ""},`,
        "",
        "Use this link to set a new password. It expires in one hour and can only be used once.",
        "",
        link,
        "",
        "If you did not request this, you can ignore this email — your password will not change.",
      ].join("\n"),
    });
  }

  return { notice };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: passwordField,
});

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const consumed = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!consumed) {
    return {
      error: "That reset link is invalid or has expired. Request a new one.",
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: consumed.userId },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
    }),
    // A password reset invalidates existing sessions.
    prisma.session.deleteMany({ where: { userId: consumed.userId } }),
  ]);

  return { notice: "Password updated. You can sign in now." };
}

// --- Email verification -----------------------------------------------------

export async function sendVerificationEmail(
  userId: string,
  email: string,
  name?: string | null,
): Promise<void> {
  const token = await issueToken(userId, "EMAIL_VERIFICATION");
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);

  await getMailer().send({
    to: email,
    subject: "Confirm your email for Launchpad Catalyst",
    body: [
      `Hi${name ? ` ${name}` : ""},`,
      "",
      "Confirm your email address:",
      "",
      link,
      "",
      "This link expires in 24 hours.",
    ].join("\n"),
  });
}

export async function resendVerificationAction(): Promise<AuthFormState> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in first" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  if (!user) return { error: "Account not found" };
  if (user.emailVerified) return { notice: "Your email is already confirmed." };

  await sendVerificationEmail(user.id, user.email, user.name);
  return { notice: "Confirmation email sent." };
}
