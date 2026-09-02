import { Suspense } from "react";
import { signupAction } from "@/actions/auth.actions";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Create account · Launchpad Catalyst" };

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" action={signupAction} />
    </Suspense>
  );
}
