import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await getAuth();
    return NextResponse.json({
      userId: auth.userId,
      userEmail: auth.userEmail,
      isClient: auth.isClient,
      companyId: auth.companyId,
    });
  } catch {
    return NextResponse.json(
      { userId: null, userEmail: null, isClient: false, companyId: null },
      { status: 200 }
    );
  }
}
