import { Suspense } from "react";
import { loginAction } from "@/actions/auth.actions";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in · Launchpad Catalyst" };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" action={loginAction} />
    </Suspense>
  );
}
