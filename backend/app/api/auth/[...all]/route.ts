import { NextResponse } from "next/server";

function legacyAuthRetiredResponse() {
  return NextResponse.json(
    {
      error: {
        code: "LEGACY_AUTH_RETIRED",
        message: "Legacy Better Auth endpoints have been retired. Coal dashboard auth now runs through Privy.",
      },
    },
    { status: 410 },
  );
}

export async function GET() {
  return legacyAuthRetiredResponse();
}

export async function POST() {
  return legacyAuthRetiredResponse();
}
