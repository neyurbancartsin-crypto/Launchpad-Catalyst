import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        That page does not exist, or you do not have access to it.
      </p>
      <div className="mt-6">
        <Link href="/dashboard">
          <Button>Go to your dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
