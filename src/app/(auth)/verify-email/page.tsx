import Link from "next/link";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/auth-tokens";
import { Card } from "@/components/ui";

export const metadata = { title: "Confirm your email · Launchpad Catalyst" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const consumed = token ? await consumeToken(token, "EMAIL_VERIFICATION") : null;

  if (consumed) {
    await prisma.user.update({
      where: { id: consumed.userId },
      data: { emailVerified: new Date() },
    });
  }

  return (
    <Card>
      <h1 className="text-base font-semibold text-foreground">
        {consumed ? "Email confirmed" : "This link is not valid"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {consumed
          ? "Thanks — your email address is confirmed."
          : "The link may have expired or already been used. You can request a new one from Settings."}
      </p>
      <p className="mt-5 text-sm">
        <Link href="/dashboard" className="font-medium text-brand hover:underline">
          Go to your dashboard
        </Link>
      </p>
    </Card>
  );
}
