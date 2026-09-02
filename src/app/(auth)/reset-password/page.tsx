import Link from "next/link";
import { resetPasswordAction } from "@/actions/auth.actions";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Card } from "@/components/ui";

export const metadata = { title: "Set a new password · Launchpad Catalyst" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card>
        <h1 className="text-base font-semibold text-foreground">
          This link is incomplete
        </h1>
        <p className="mt-1 text-sm text-muted">
          Request a new password reset link.
        </p>
        <p className="mt-5 text-sm">
          <Link href="/forgot-password" className="font-medium text-brand hover:underline">
            Request a new link
          </Link>
        </p>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} action={resetPasswordAction} />;
}
