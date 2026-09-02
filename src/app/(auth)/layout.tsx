import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center">
          <span className="text-lg font-semibold text-foreground">
            Launchpad Catalyst
          </span>
          <span className="mt-1 block text-sm text-muted">
            Find the right conversations. Get your first users.
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
