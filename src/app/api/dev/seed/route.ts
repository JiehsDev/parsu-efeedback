// src/app/api/dev/seed/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";
import Office from "@/models/Office";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized environment execution" }, { status: 403 });
  }

  try {
    await connectToDatabase();

    // Clear existing collections for a clean setup
    await User.deleteMany({});
    await Office.deleteMany({});

    // 1. Provision Core Structural Nodes with mandatory 'code' fields
    const collegeOfComputing = await Office.create({
      name: "College of Computing and Information Sciences",
      code: "CCIS",
      type: "college",
      parentOffice: null,
    });

    const registrarOffice = await Office.create({
      name: "Office of the University Registrar",
      code: "OUR",
      type: "service_office",
      parentOffice: null,
    });

    // 2. Generate universal secure hashed password
    const salt = await bcrypt.genSalt(10);
    const commonPasswordHash = await bcrypt.hash("ParSU_test2026", salt);

    // 3. Populate testing accounts matching the unified identity field
    const usersToCreate = [
      {
        firstName: "Rolando",
        lastName: "Abellon",
        email: "student@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "student",
        employeeOrStudentId: "2023-10492", // ◄ Updated to match your schema rule
        collegeRef: collegeOfComputing._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Maria",
        lastName: "Santos",
        email: "staff@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0412", // ◄ Updated to match your schema rule
        officeRef: registrarOffice._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Dr. Juan",
        lastName: "Cruz",
        email: "dean@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "college_dean",
        employeeOrStudentId: "EMP-0015", // ◄ Updated to match your schema rule
        officeRef: collegeOfComputing._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Inactive",
        lastName: "Test",
        email: "inactive@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "student",
        employeeOrStudentId: "2023-00000", // ◄ Updated to match your schema rule
        tokenVersion: 1,
        isActive: false,
      },
    ];

    await User.insertMany(usersToCreate);

    return NextResponse.json({
      message: "Database seeded perfectly. All required schema alignments satisfied.",
      count: usersToCreate.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
