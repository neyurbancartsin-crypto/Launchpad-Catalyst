import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * A plain Route Handler (not a page), so `notFound()` — which only works
 * inside the App Router's render/action flow — doesn't apply here. A 404
 * JSON response is the direct equivalent: it doesn't confirm this endpoint
 * exists to anyone who isn't the owner.
 */
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await prisma.feedback.findMany({ orderBy: { createdAt: "desc" } });

  const header = ["Date", "Name", "Email", "Type", "Status", "Consent", "Message"];
  const rows = items.map((item) => [
    item.createdAt.toISOString(),
    item.name,
    item.email,
    item.type,
    item.status,
    item.consent ? "yes" : "no",
    item.message,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => csvField(String(value))).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="feedback-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
