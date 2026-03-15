import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    dateOfBirth,
    phoneNumber,
    petName,
    petBreed,
    petType,
    petDesexed,
    petGender,
    petDateOfBirth,
    address,
    insuranceCommencementDate,
  } = body as {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    petName?: string;
    petBreed?: string;
    petType?: string;
    petDesexed?: boolean;
    petGender?: string;
    petDateOfBirth?: string;
    address?: string;
    insuranceCommencementDate?: string;
  };

  if (!firstName || !lastName || !dateOfBirth || !phoneNumber) {
    return NextResponse.json(
      { error: "Missing required fields: firstName, lastName, dateOfBirth, phoneNumber" },
      { status: 400 }
    );
  }

  // Validate phone format: digits only, 10-15 chars
  const phoneCleaned = phoneNumber.replace(/[\s\-()]+/g, "");
  if (!/^\d{10,15}$/.test(phoneCleaned)) {
    return NextResponse.json(
      { error: "Invalid phone number. Must be 10-15 digits." },
      { status: 400 }
    );
  }

  // Check uniqueness
  const existing = await prisma.patient.findUnique({
    where: { phoneNumber: phoneCleaned },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A pet profile with this owner phone number already exists." },
      { status: 409 }
    );
  }

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      dateOfBirth: new Date(dateOfBirth),
      phoneNumber: phoneCleaned,
      clinicId: user.clinicId as string,
      petName: petName ?? undefined,
      petBreed: petBreed ?? undefined,
      petType: petType ?? undefined,
      petDesexed: petDesexed ?? undefined,
      petGender: petGender ?? undefined,
      petDateOfBirth: petDateOfBirth ? new Date(petDateOfBirth) : undefined,
      address: address ?? undefined,
      insuranceCommencementDate: insuranceCommencementDate
        ? new Date(insuranceCommencementDate)
        : undefined,
    },
  });

  return NextResponse.json(patient, { status: 201 });
}
