import { requestPasswordResetAction } from "@/actions/auth.actions";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata = { title: "Reset password · Launchpad Catalyst" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm action={requestPasswordResetAction} />;
}
