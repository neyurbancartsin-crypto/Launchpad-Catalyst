import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";

/**
 * The future-launch list: only people who explicitly checked the consent
 * box, and only their email — no other fields, since nothing else is needed
 * to contact them later. See export/route.ts for why this checks admin
 * status directly instead of via `requireAdmin()`.
 */
export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.feedback.findMany({
    where: { consent: true },
    select: { email: true },
    distinct: ["email"],
    orderBy: { email: "asc" },
  });

  const csv = ["Email", ...rows.map((row) => row.email)].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consented-emails-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
