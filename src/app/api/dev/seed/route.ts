// src/app/api/dev/seed/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";
import Office from "@/models/Office";
import Category from "@/models/Category";
import Complaint from "@/models/Complaint";
import RoutingRule from "@/models/RoutingRule";
import SLARule from "@/models/SLARule";
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized environment execution" }, { status: 403 });
  }

  try {
    await connectToDatabase();

    // Clear existing collections for a clean setup
    await User.deleteMany({});
    await Office.deleteMany({});
    await Category.deleteMany({});
    await Complaint.deleteMany({});
    await RoutingRule.deleteMany({});
    await SLARule.deleteMany({});

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
    const osasOffice = await Office.create({
      name: "Office of the University OSAS",
      code: "OSAS",
      type: "service_office",
      parentOffice: null,
    });

    // QA office doesn't scope to a specific college/office per your RBAC
    // doc (§6: "qa → no office scope, institution-wide read"), but the
    // schema still wants *an* officeRef for staff-shaped roles — using a
    // dedicated QA office row keeps that consistent rather than leaving
    // it null and creating a special case.
    const qaOffice = await Office.create({
      name: "Quality Assurance Office",
      code: "QAO",
      type: "service_office",
      parentOffice: null,
    });

    // Handles Campus Facilities complaints (physical plant + campus IT),
    // per the capstone's four-group complaint taxonomy — none of the
    // other seeded offices are a sensible routing target for these.
    const generalServicesOffice = await Office.create({
      name: "General Services Office",
      code: "GSO",
      type: "service_office",
      parentOffice: null,
    });

    // Administrator doesn't belong to any office/college per BR — it's a
    // distinct permission set, not staff+extra (architecture.md §6).
    // officeRef/collegeRef stay null for this role.

    // 2. Generate universal secure hashed password
    const salt = await bcrypt.genSalt(10);
    const commonPasswordHash = await bcrypt.hash("ParSU_test2026", salt);
    const complaintCategory = await Category.create({
      name: "Grade Concern",
      description: "Issues related to grade posting, computation, or disputes",
      defaultOfficeRef: registrarOffice._id,
      defaultPriority: "medium",
      isActive: true,
    });

    // BR-023/BR-029: a category needs both an active routing rule and an
    // active SLA rule before a complaint can actually be submitted against
    // it (see resolveRoutingOffice/resolveSlaRule) — without these, the
    // seeded category above exists but every submission 422s.
    await RoutingRule.create({
      categoryRef: complaintCategory._id,
      targetOfficeRef: registrarOffice._id,
      isActive: true,
    });
    await SLARule.create({
      categoryRef: complaintCategory._id,
      priority: "medium",
      responseHours: 24,
      resolutionHours: 120,
      isActive: true,
    });

    // Remaining categories, grouped by the capstone doc's four core
    // complaint types (Campus Facilities / Administrative Services /
    // Academic Matters / Student Welfare). "Grade Concern" above already
    // covers one Academic Matters example; these fill out the rest so the
    // category picker reflects realistic, in-scope complaint types instead
    // of a single placeholder.
    const additionalCategories = [
      // --- Campus Facilities ---
      {
        name: "Classroom & Laboratory Equipment",
        description:
          "Broken air conditioners/fans, malfunctioning projectors, damaged desks or chairs",
        defaultOfficeRef: generalServicesOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Restroom & Sanitation",
        description: "Lack of running water, unsanitary conditions, damaged plumbing/fixtures",
        defaultOfficeRef: generalServicesOffice._id,
        defaultPriority: "high",
      },
      {
        name: "Campus Wi-Fi & IT Infrastructure",
        description: "Slow or non-functional campus Wi-Fi, computer lab hardware/software issues",
        defaultOfficeRef: generalServicesOffice._id,
        defaultPriority: "medium",
      },
      // --- Administrative Services ---
      {
        name: "Document Request Delays",
        description:
          "Delays in issuing TOR, Honorable Dismissal, diploma, or certification requests",
        defaultOfficeRef: registrarOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Staff Responsiveness",
        description: "Unhelpful, slow, or unprofessional conduct from office personnel",
        defaultOfficeRef: registrarOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Administrative Process Concerns",
        description:
          "Redundant requirements, cumbersome procedures, or unannounced office closures",
        defaultOfficeRef: registrarOffice._id,
        defaultPriority: "low",
      },
      // --- Academic Matters ---
      {
        name: "Faculty & Teaching Performance",
        description:
          "Excessive absenteeism, late arrivals, poor instruction, or unprofessional behavior",
        defaultOfficeRef: collegeOfComputing._id,
        defaultPriority: "high",
      },
      {
        name: "Curriculum & Scheduling",
        description:
          "Class scheduling conflicts, overcrowded sections, missing prerequisite subjects",
        defaultOfficeRef: collegeOfComputing._id,
        defaultPriority: "medium",
      },
      {
        name: "Consultation & Advising",
        description:
          "Faculty unavailability during posted consultation hours, lack of academic guidance",
        defaultOfficeRef: collegeOfComputing._id,
        defaultPriority: "low",
      },
      // --- Student Welfare ---
      {
        name: "Campus Safety & Security",
        description:
          "Unsecured areas, lost items, security personnel behavior, harassment concerns",
        defaultOfficeRef: osasOffice._id,
        defaultPriority: "high",
      },
      {
        name: "Student Services",
        description:
          "Canteen hygiene/food quality, health services/clinic operations, guidance and counseling",
        defaultOfficeRef: osasOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Financial Assistance & Scholarships",
        description: "Delayed disbursement of scholarships, unclear grant guidelines",
        defaultOfficeRef: osasOffice._id,
        defaultPriority: "medium",
      },
    ] as const;

    for (const cat of additionalCategories) {
      const category = await Category.create({ ...cat, isActive: true });
      await RoutingRule.create({
        categoryRef: category._id,
        targetOfficeRef: cat.defaultOfficeRef,
        isActive: true,
      });
      await SLARule.create({
        categoryRef: category._id,
        priority: cat.defaultPriority,
        responseHours: 24,
        resolutionHours: 120,
        isActive: true,
      });
    }

    // 3. Populate testing accounts matching the unified identity field
    const usersToCreate = [
      {
        firstName: "Elliot",
        lastName: "Anderson",
        email: "student@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "student",
        employeeOrStudentId: "2023-10492",
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
        employeeOrStudentId: "EMP-0412",
        officeRef: registrarOffice._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Pedro",
        lastName: "Penduko",
        email: "staff2@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0413",
        officeRef: osasOffice._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Pedro",
        lastName: "Penduko",
        email: "staff3@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0414",
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
        employeeOrStudentId: "EMP-0015",
        collegeRef: collegeOfComputing._id, // ← was officeRef, now collegeRef
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Elena",
        lastName: "Reyes",
        email: "qa@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "qa_office",
        employeeOrStudentId: "EMP-0099",
        officeRef: qaOffice._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "System",
        lastName: "Administrator",
        email: "admin@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "administrator",
        employeeOrStudentId: "EMP-0001",
        officeRef: null,
        collegeRef: null,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Inactive",
        lastName: "Test",
        email: "inactive@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "student",
        employeeOrStudentId: "2023-00000",
        tokenVersion: 1,
        isActive: false,
      },
    ];

    await User.insertMany(usersToCreate);

    return NextResponse.json({
      message: "Database seeded perfectly. All required schema alignments satisfied.",
      count: usersToCreate.length,
      offices: {
        collegeOfComputing: collegeOfComputing._id,
        registrarOffice: registrarOffice._id,
        qaOffice: qaOffice._id,
        complaintCategory: complaintCategory._id,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
