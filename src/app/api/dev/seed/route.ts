// src/app/api/dev/seed/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";
import Office from "@/models/Office";
import Category from "@/models/Category";
import Complaint from "@/models/Complaint";
import Feedback from "@/models/Feedback";
import RoutingRule from "@/models/RoutingRule";
import SLARule from "@/models/SLARule";
import { Counter } from "@/models/Counter";
import { getSettings } from "@/features/settings/services/settings.service";
import { FEEDBACK_CATEGORIES } from "@/features/feedback/constants";
import type { PriorityLevel } from "@/lib/constants";

// --- Small seeding helpers (test data only, not exported/reused elsewhere) ---
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}
function weightedPick<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    if (r < item.weight) return item.value;
    r -= item.weight;
  }
  return items[items.length - 1]!.value;
}
function daysAgo(days: number, hourJitter = 24) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - randInt(0, hourJitter));
  return d;
}
function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

const PRIORITY_SLA_HOURS: Record<
  PriorityLevel,
  { responseHours: number; resolutionHours: number }
> = {
  critical: { responseHours: 4, resolutionHours: 24 },
  high: { responseHours: 8, resolutionHours: 48 },
  medium: { responseHours: 24, resolutionHours: 120 },
  low: { responseHours: 48, resolutionHours: 168 },
};

const FIRST_NAMES = [
  "Juan",
  "Maria",
  "Jose",
  "Ana",
  "Pedro",
  "Rosa",
  "Antonio",
  "Carmen",
  "Manuel",
  "Teresa",
  "Ramon",
  "Josefa",
  "Francisco",
  "Luz",
  "Ricardo",
  "Elena",
  "Eduardo",
  "Cristina",
  "Fernando",
  "Isabel",
  "Rafael",
  "Angela",
  "Miguel",
  "Grace",
  "Roberto",
  "Michelle",
  "Daniel",
  "Katrina",
  "Paolo",
  "Bianca",
  "Marco",
  "Julia",
  "Nathaniel",
  "Andrea",
  "Christian",
  "Samantha",
];
const LAST_NAMES = [
  "Reyes",
  "Santos",
  "Cruz",
  "Bautista",
  "Garcia",
  "Mendoza",
  "Torres",
  "Flores",
  "Ramos",
  "Villanueva",
  "Del Rosario",
  "Aquino",
  "Castillo",
  "Navarro",
  "Gonzales",
  "Fernandez",
  "Pascual",
  "Domingo",
  "Salazar",
  "Rivera",
  "Aguilar",
  "Marquez",
  "Ocampo",
  "Diaz",
  "Espinosa",
  "Lopez",
  "Manalo",
  "Tolentino",
];

const COMPLAINT_TEMPLATES: Record<string, { title: string; description: string }[]> = {
  "Grade Concern": [
    {
      title: "Incorrect grade posted for major subject",
      description:
        "The final grade shown in the portal does not match what was announced in class. Requesting a review of the computation.",
    },
    {
      title: "Missing grade after semester ended",
      description:
        "It has been weeks since the semester ended and my grade for this subject is still not reflected in the system.",
    },
  ],
  "Classroom & Laboratory Facilities": [
    {
      title: "Air conditioner not working in lecture hall",
      description:
        "The AC unit has been broken for over a week, making the room uncomfortably hot during afternoon classes.",
    },
    {
      title: "Projector malfunctioning in computer laboratory",
      description:
        "The projector flickers and shuts off randomly, disrupting lab sessions and demonstrations.",
    },
  ],
  "Restroom & Sanitation": [
    {
      title: "No running water in the building restroom",
      description:
        "The restroom on the ground floor has had no running water for several days now.",
    },
    {
      title: "Unsanitary conditions reported in shared restroom",
      description: "The restroom is rarely cleaned and lacks basic supplies like soap and tissue.",
    },
  ],
  "Campus Wi-Fi & IT Infrastructure": [
    {
      title: "Campus Wi-Fi extremely slow near the library",
      description:
        "Internet connection drops frequently and loads very slowly, affecting research and online submissions.",
    },
    {
      title: "Computer lab units not booting properly",
      description:
        "Several units in the lab fail to start or freeze shortly after login, delaying scheduled activities.",
    },
  ],
  "Document Request Delays": [
    {
      title: "TOR request pending beyond stated processing time",
      description:
        "I requested my Transcript of Records over three weeks ago and have not received any update.",
    },
    {
      title: "Certification of enrollment delayed",
      description:
        "My request for a certification document has exceeded the posted turnaround time with no explanation.",
    },
  ],
  "Staff Service & Responsiveness": [
    {
      title: "Unhelpful response from front desk personnel",
      description:
        "I was dismissed without a clear answer when asking about my document request status.",
    },
    {
      title: "Slow response to email inquiries",
      description:
        "Multiple follow-up emails regarding my concern have gone unanswered for over a week.",
    },
  ],
  "Administrative Process Concerns": [
    {
      title: "Redundant requirements for simple request",
      description:
        "I was asked to submit the same document twice across two different windows for one transaction.",
    },
    {
      title: "Office closed without prior announcement",
      description:
        "The office was unexpectedly closed during posted hours, and no notice was given beforehand.",
    },
  ],
  "Faculty & Teaching Performance": [
    {
      title: "Frequent absences affecting course progress",
      description:
        "The instructor has missed several sessions this term without makeup classes being scheduled.",
    },
    {
      title: "Concerns about instruction quality",
      description:
        "Lecture materials are unclear and questions during class are often left unaddressed.",
    },
  ],
  "Curriculum & Class Scheduling": [
    {
      title: "Class schedule conflict with required subject",
      description:
        "Two required subjects for my program are scheduled at the same time this semester.",
    },
    {
      title: "Overcrowded section affecting learning",
      description:
        "The section has significantly more students than the room can comfortably accommodate.",
    },
  ],
  "Academic Advising & Consultation": [
    {
      title: "Faculty unavailable during posted consultation hours",
      description:
        "I visited during the posted consultation schedule twice but the instructor was not present.",
    },
    {
      title: "Lack of guidance on academic requirements",
      description: "I was unable to get clear advice on remaining requirements for my program.",
    },
  ],
  "Library Services & Resources": [
    {
      title: "Limited access to reference materials",
      description:
        "Several required references for our course are not available for borrowing or online access.",
    },
    {
      title: "Library hours not consistently followed",
      description:
        "The library has closed earlier than its posted hours on multiple occasions this month.",
    },
  ],
  "Campus Safety & Security": [
    {
      title: "Poorly lit pathway near parking area",
      description:
        "The walkway near the parking area has no working lights, making it unsafe at night.",
    },
    {
      title: "Lost item not properly logged by security",
      description:
        "I reported a lost item at the security desk but there is no record of it being logged.",
    },
  ],
  "Student Services & Assistance": [
    {
      title: "Canteen food quality concerns",
      description:
        "Several students have noticed inconsistent food quality and hygiene at the campus canteen.",
    },
    {
      title: "Delay in processing student organization request",
      description:
        "Our student organization's activity request has been pending approval well past the usual turnaround.",
    },
  ],
  "Health & Medical Services": [
    {
      title: "Clinic understaffed during peak hours",
      description:
        "The health clinic had no available staff when I sought assistance during a walk-in visit.",
    },
    {
      title: "Limited stock of basic first aid supplies",
      description:
        "The campus clinic frequently runs out of basic medical supplies needed for minor concerns.",
    },
  ],
  "Scholarships & Financial Assistance": [
    {
      title: "Scholarship disbursement delayed",
      description:
        "My scholarship allowance for this semester has not been released despite meeting all requirements.",
    },
    {
      title: "Unclear grant renewal guidelines",
      description:
        "The requirements for renewing my grant were not clearly communicated before the deadline.",
    },
  ],
  "Student Payment & Cashier Concerns": [
    {
      title: "Delayed posting of tuition payment",
      description:
        "My tuition payment was made over a week ago but is still not reflected in my account, blocking enrollment finalization.",
    },
    {
      title: "Incorrect fee assessment on statement of account",
      description:
        "The assessed fees on my SOA do not match the published fee schedule for my program and year level.",
    },
  ],
};

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
    await Feedback.deleteMany({});
    await RoutingRule.deleteMany({});
    await SLARule.deleteMany({});

    // 1. Provision Core Structural Nodes with mandatory 'code' fields
    const primaryCollege = await Office.create({
      name: "College of Engineering & Computational Sciences",
      code: "CECS",
      type: "college_office",
      parentOffice: null,
    });

    // More colleges so college-comparison analytics has something to
    // compare — the original seed only ever created one.
    const otherColleges = await Office.insertMany([
      { name: "College of Education", code: "CED", type: "college_office", parentOffice: null },
      {
        name: "College of Business & Management",
        code: "CBM",
        type: "college_office",
        parentOffice: null,
      },
      { name: "College of Science", code: "COS", type: "college_office", parentOffice: null },
      {
        name: "College of Arts and Humanities",
        code: "CAH",
        type: "college_office",
        parentOffice: null,
      },
    ]);
    const colleges = [primaryCollege, ...otherColleges];

    const registrarOffice = await Office.create({
      name: "Office of the University Registrar",
      code: "OUR",
      type: "university_office",
      parentOffice: null,
    });
    // Name/scope per the OSAS reference note: student scholarships,
    // student complaints/discipline, organizations, activities, and
    // boarding houses/dormitories.
    const osasOffice = await Office.create({
      name: "Office of Student Affairs and Services (OSAS)",
      code: "OSAS",
      type: "university_office",
      parentOffice: null,
    });

    // Handles institution-wide academic policy concerns (curriculum,
    // academic advising, academic calendar/scheduling, library) per the
    // OVPAA reference doc — distinct from a college's own faculty/teaching
    // complaints, which stay routed to the concerned college office.
    const ovpaaOffice = await Office.create({
      name: "Office of the Vice President for Academic Affairs (OVPAA)",
      code: "OVPAA",
      type: "university_office",
      parentOffice: null,
    });

    // Mirrors OVPAA but for the finance/administration side (cashier,
    // payments) — no dedicated reference doc was provided for this one,
    // but the "vpaf" role already existed to oversee university offices.
    const ovpafOffice = await Office.create({
      name: "Office of the Vice President for Administration and Finance (OVPAF)",
      code: "OVPAF",
      type: "university_office",
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
      type: "university_office",
      parentOffice: null,
    });

    // Handles Campus Facilities complaints (physical plant + campus IT),
    // per the capstone's four-group complaint taxonomy — none of the
    // other seeded offices are a sensible routing target for these.
    const generalServicesOffice = await Office.create({
      name: "General Services Office",
      code: "GSO",
      type: "university_office",
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
    // seeded category above exists but every submission 422s. A category
    // only ever has one active SLA rule, fixed to its own defaultPriority
    // (see src/models/SLARule.ts's partial unique index), so this seeds
    // exactly that one rule rather than one per priority tier.
    async function seedSlaRuleForCategory(categoryId: any, priority: PriorityLevel) {
      await SLARule.create({
        categoryRef: categoryId,
        priority,
        responseHours: PRIORITY_SLA_HOURS[priority].responseHours,
        resolutionHours: PRIORITY_SLA_HOURS[priority].resolutionHours,
        isActive: true,
      });
    }

    await RoutingRule.create({
      categoryRef: complaintCategory._id,
      targetOfficeRef: registrarOffice._id,
      isActive: true,
    });
    await seedSlaRuleForCategory(complaintCategory._id, "medium");

    // Remaining categories, grouped by the capstone doc's four core
    // complaint types (Campus Facilities / Administrative Services /
    // Academic Matters / Student Welfare). "Grade Concern" above already
    // covers one Academic Matters example; these fill out the rest so the
    // category picker reflects realistic, in-scope complaint types instead
    // of a single placeholder.
    const additionalCategories = [
      // --- Campus Facilities (General Services Office) ---
      {
        name: "Classroom & Laboratory Facilities",
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
      // --- Registrar's Office (records custody/issuance, per the URO
      // reference doc: OTR/certification issuance, grade-correction
      // encoding, registration paraphernalia, staff code of conduct) ---
      {
        name: "Document Request Delays",
        description:
          "Delays in issuing TOR, Honorable Dismissal, diploma, or certification requests",
        defaultOfficeRef: registrarOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Staff Service & Responsiveness",
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
      // --- Faculty/teaching complaints stay routed to the concerned
      // college office (not OVPAA) so a college's own performance is
      // tracked at the college level. ---
      {
        name: "Faculty & Teaching Performance",
        description:
          "Excessive absenteeism, late arrivals, poor instruction, or unprofessional behavior",
        defaultOfficeRef: primaryCollege._id,
        defaultPriority: "high",
      },
      {
        name: "Faculty & Teaching Performance - College of Education",
        description: "Teaching quality, faculty attendance, and classroom conduct concerns for CED",
        defaultOfficeRef: otherColleges[0]!._id,
        defaultPriority: "high",
      },
      {
        name: "Faculty & Teaching Performance - College of Business & Management",
        description: "Teaching quality, faculty attendance, and classroom conduct concerns for CBM",
        defaultOfficeRef: otherColleges[1]!._id,
        defaultPriority: "high",
      },
      {
        name: "Faculty & Teaching Performance - College of Science",
        description: "Teaching quality, faculty attendance, and classroom conduct concerns for COS",
        defaultOfficeRef: otherColleges[2]!._id,
        defaultPriority: "high",
      },
      {
        name: "Faculty & Teaching Performance - College of Arts and Humanities",
        description: "Teaching quality, faculty attendance, and classroom conduct concerns for CAH",
        defaultOfficeRef: otherColleges[3]!._id,
        defaultPriority: "high",
      },
      // --- OVPAA (institution-wide academic policy: curriculum, advising,
      // library — per the OVPAA reference doc's "types of inquiries
      // handled" list) ---
      {
        name: "Curriculum & Class Scheduling",
        description:
          "Class scheduling conflicts, overcrowded sections, missing prerequisite subjects",
        defaultOfficeRef: ovpaaOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Academic Advising & Consultation",
        description:
          "Faculty unavailability during posted consultation hours, lack of academic guidance",
        defaultOfficeRef: ovpaaOffice._id,
        defaultPriority: "low",
      },
      {
        name: "Library Services & Resources",
        description: "Limited access to references, inconsistent library operating hours",
        defaultOfficeRef: ovpaaOffice._id,
        defaultPriority: "low",
      },
      // --- OSAS (student affairs: scholarships, complaints/discipline,
      // organizations, activities, dormitories/boarding houses, plus
      // safety/health as student-welfare concerns — per the OSAS
      // reference note) ---
      {
        name: "Campus Safety & Security",
        description:
          "Unsecured areas, lost items, security personnel behavior, harassment concerns",
        defaultOfficeRef: osasOffice._id,
        defaultPriority: "high",
      },
      {
        name: "Student Services & Assistance",
        description: "Canteen hygiene/food quality, student organization/activity concerns",
        defaultOfficeRef: osasOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Health & Medical Services",
        description: "Clinic staffing/availability, first-aid supply concerns",
        defaultOfficeRef: osasOffice._id,
        defaultPriority: "medium",
      },
      {
        name: "Scholarships & Financial Assistance",
        description: "Delayed disbursement of scholarships, unclear grant guidelines",
        defaultOfficeRef: osasOffice._id,
        defaultPriority: "medium",
      },
      // --- OVPAF (administration & finance: payments, cashier concerns) ---
      {
        name: "Student Payment & Cashier Concerns",
        description: "Tuition payment posting delays, fee assessment discrepancies",
        defaultOfficeRef: ovpafOffice._id,
        defaultPriority: "medium",
      },
    ] as const;

    const allCategories: {
      _id: any;
      name: string;
      defaultOfficeRef: any;
      defaultPriority: PriorityLevel;
    }[] = [
      {
        _id: complaintCategory._id,
        name: complaintCategory.name,
        defaultOfficeRef: registrarOffice._id,
        defaultPriority: "medium",
      },
    ];

    for (const cat of additionalCategories) {
      const category = await Category.create({ ...cat, isActive: true });
      await RoutingRule.create({
        categoryRef: category._id,
        targetOfficeRef: cat.defaultOfficeRef,
        isActive: true,
      });
      await seedSlaRuleForCategory(category._id, cat.defaultPriority);
      allCategories.push({
        _id: category._id,
        name: category.name,
        defaultOfficeRef: cat.defaultOfficeRef,
        defaultPriority: cat.defaultPriority,
      });
    }

    // 3. Populate testing accounts matching the unified identity field
    const baseUsers = [
      {
        firstName: "Elliot",
        lastName: "Anderson",
        email: "student@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "student",
        employeeOrStudentId: "2023-10492",
        collegeRef: primaryCollege._id,
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
        firstName: "Liza",
        lastName: "Domingo",
        email: "staff4@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0415",
        officeRef: generalServicesOffice._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Noel",
        lastName: "Aguilar",
        email: "staff5@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0416",
        officeRef: primaryCollege._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Andrea",
        lastName: "Castillo",
        email: "dean.ced@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0419",
        officeRef: otherColleges[0]!._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Christian",
        lastName: "Mendoza",
        email: "dean.cbm@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0420",
        officeRef: otherColleges[1]!._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Rosa",
        lastName: "Navarro",
        email: "dean.cos@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0421",
        officeRef: otherColleges[2]!._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Katrina",
        lastName: "Ocampo",
        email: "dean.cah@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0422",
        officeRef: otherColleges[3]!._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Carlos",
        lastName: "Mercado",
        email: "staff6@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0417",
        officeRef: ovpaaOffice._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Bea",
        lastName: "Salonga",
        email: "staff7@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
        employeeOrStudentId: "EMP-0418",
        officeRef: ovpafOffice._id,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Elena",
        lastName: "Reyes",
        email: "qa@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "office_staff",
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
        firstName: "Dr. Juan",
        lastName: "Cruz",
        email: "vpaa@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "vpaa",
        employeeOrStudentId: "EMP-0015",
        officeRef: ovpaaOffice._id,
        collegeRef: null,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Rosario",
        lastName: "Villanueva",
        email: "vpaf@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "vpaf",
        employeeOrStudentId: "EMP-0016",
        officeRef: ovpafOffice._id,
        collegeRef: null,
        tokenVersion: 1,
        isActive: true,
      },
      {
        firstName: "Cristina",
        lastName: "Bautista",
        email: "osas@parsu.edu.ph",
        passwordHash: commonPasswordHash,
        role: "osas",
        employeeOrStudentId: "EMP-0017",
        officeRef: osasOffice._id,
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

    // A wide student pool spread across every college so college-comparison
    // and VPAA's college-office views have real volume to show, not just
    // the one hand-picked "student@parsu.edu.ph" account.
    const STUDENTS_PER_COLLEGE = 7;
    let studentSeq = 20001;
    const generatedStudents: (typeof baseUsers)[number][] = [];
    for (const college of colleges) {
      for (let i = 0; i < STUDENTS_PER_COLLEGE; i++) {
        const n = studentSeq++;
        generatedStudents.push({
          firstName: pick(FIRST_NAMES),
          lastName: pick(LAST_NAMES),
          email: `student${n}@parsu.edu.ph`,
          passwordHash: commonPasswordHash,
          role: "student",
          employeeOrStudentId: `2024-${n}`,
          collegeRef: college._id,
          tokenVersion: 1,
          isActive: true,
        } as (typeof baseUsers)[number]);
      }
    }

    const insertedUsers = await User.insertMany([...baseUsers, ...generatedStudents]);
    const students = insertedUsers.filter((u) => u.role === "student" && u.isActive);
    const staffByOffice = new Map<string, any[]>();
    for (const u of insertedUsers) {
      if (u.role !== "office_staff" || !u.officeRef) continue;
      const key = u.officeRef.toString();
      if (!staffByOffice.has(key)) staffByOffice.set(key, []);
      staffByOffice.get(key)!.push(u);
    }

    // Manual escalation hierarchy: college offices elevate to VPAA; general
    // university offices elevate to VPAF, while OSAS elevates through VPAA.
    await Office.updateMany(
      { _id: { $in: colleges.map((college) => college._id) } },
      { $set: { parentOffice: ovpaaOffice._id } },
    );
    await Office.updateMany(
      { _id: { $in: [registrarOffice._id, qaOffice._id, generalServicesOffice._id] } },
      { $set: { parentOffice: ovpafOffice._id } },
    );
    await Office.updateOne({ _id: osasOffice._id }, { $set: { parentOffice: ovpaaOffice._id } });

    // Every seeded office has one active staff account designated as its
    // head/dean. This keeps office administration and the login matrix
    // usable immediately after the development seed completes.
    const officeHeadAssignments = [
      [primaryCollege._id, "staff5@parsu.edu.ph"],
      [otherColleges[0]!._id, "dean.ced@parsu.edu.ph"],
      [otherColleges[1]!._id, "dean.cbm@parsu.edu.ph"],
      [otherColleges[2]!._id, "dean.cos@parsu.edu.ph"],
      [otherColleges[3]!._id, "dean.cah@parsu.edu.ph"],
      [registrarOffice._id, "staff@parsu.edu.ph"],
      [osasOffice._id, "osas@parsu.edu.ph"],
      [ovpaaOffice._id, "vpaa@parsu.edu.ph"],
      [ovpafOffice._id, "vpaf@parsu.edu.ph"],
      [qaOffice._id, "qa@parsu.edu.ph"],
      [generalServicesOffice._id, "staff4@parsu.edu.ph"],
    ] as const;
    for (const [officeId, email] of officeHeadAssignments) {
      const head = insertedUsers.find((u) => u.email === email);
      if (!head) throw new Error(`Could not find seeded head account ${email}`);
      await Office.updateOne({ _id: officeId }, { $set: { headUserRef: head._id } });
    }

    // 4. Bulk-reserve a contiguous block of ticket numbers (one atomic
    // increment instead of one Counter round-trip per complaint).
    const COMPLAINT_COUNT = 300;
    const settings = await getSettings();
    const year = new Date().getFullYear();
    const counterId = `ticketNumber:${year}`;
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: COMPLAINT_COUNT } },
      { upsert: true, returnDocument: "after" },
    );
    const startSeq = counter!.seq - COMPLAINT_COUNT + 1;
    const ticketNumbers = Array.from(
      { length: COMPLAINT_COUNT },
      (_, i) => `${settings.ticketNumberPrefix}-${year}-${String(startSeq + i).padStart(6, "0")}`,
    );

    const PRIORITY_WEIGHTS = [
      { value: "low" as const, weight: 20 },
      { value: "medium" as const, weight: 45 },
      { value: "high" as const, weight: 25 },
      { value: "critical" as const, weight: 10 },
    ];
    const STATUS_WEIGHTS = [
      { value: "resolved" as const, weight: 40 },
      { value: "closed" as const, weight: 30 },
      { value: "in_progress" as const, weight: 12 },
      { value: "assigned" as const, weight: 8 },
      { value: "submitted" as const, weight: 5 },
      { value: "escalated" as const, weight: 3 },
      { value: "pending_information" as const, weight: 2 },
    ];
    const OPEN_STATUSES = new Set([
      "submitted",
      "assigned",
      "in_progress",
      "pending_information",
      "escalated",
    ]);
    const now = new Date();

    const complaintDocs = ticketNumbers.map((ticketNumber) => {
      const category = pick(allCategories);
      const priority = weightedPick(PRIORITY_WEIGHTS);
      const student = pick(students);
      const templates = COMPLAINT_TEMPLATES[category.name] ?? [
        {
          title: `${category.name} concern`,
          description: `Reported issue related to ${category.name.toLowerCase()}.`,
        },
      ];
      const template = pick(templates);

      const submittedAt = daysAgo(randInt(0, 180));
      const slaHours = PRIORITY_SLA_HOURS[priority];
      const slaResponseDueAt = addHours(submittedAt, slaHours.responseHours);
      const slaResolutionDueAt = addHours(submittedAt, slaHours.resolutionHours);

      const status = weightedPick(STATUS_WEIGHTS);
      const isResolved = status === "resolved" || status === "closed";

      const officeStaff = staffByOffice.get(category.defaultOfficeRef.toString()) ?? [];
      const assignedStaffRef =
        status === "submitted" || officeStaff.length === 0 ? null : pick(officeStaff)._id;

      let resolvedAt: Date | null = null;
      let closedAt: Date | null = null;
      let studentRating: number | null = null;
      let studentRatingComment = "";
      if (isResolved) {
        // ~80% resolve within SLA, ~20% breach it — enough spread for the
        // SLA-compliance-by-office chart/heatmap to show real variation.
        const withinSla = Math.random() < 0.8;
        const resolutionSpanHours = withinSla
          ? randInt(1, Math.max(1, slaHours.resolutionHours - 2))
          : randInt(slaHours.resolutionHours + 2, slaHours.resolutionHours + 96);
        resolvedAt = addHours(submittedAt, resolutionSpanHours);
        if (resolvedAt > now) resolvedAt = now;
        if (status === "closed") {
          closedAt = addHours(resolvedAt, randInt(1, 72));
          if (closedAt > now) closedAt = now;
        }
        if (Math.random() < 0.65) {
          studentRating = weightedPick([
            { value: 5, weight: 40 },
            { value: 4, weight: 30 },
            { value: 3, weight: 15 },
            { value: 2, weight: 10 },
            { value: 1, weight: 5 },
          ]);
          if (studentRating <= 2) studentRatingComment = "Took longer than expected to resolve.";
        }
      }

      const isOverdue = OPEN_STATUSES.has(status) && slaResolutionDueAt < now;

      return {
        ticketNumber,
        studentRef: student._id,
        categoryRef: category._id,
        title: template.title,
        description: template.description,
        priority,
        status,
        assignedOfficeRef: category.defaultOfficeRef,
        assignedStaffRef,
        slaResponseDueAt,
        slaResolutionDueAt,
        isOverdue,
        resolutionSummary: isResolved ? "Resolved after review by the assigned office." : "",
        studentRating,
        studentRatingComment,
        reopenCount: 0,
        submittedAt,
        resolvedAt,
        closedAt,
        isArchived: false,
        createdAt: submittedAt,
        updatedAt: resolvedAt ?? submittedAt,
      };
    });

    await Complaint.insertMany(complaintDocs);

    // 5. A handful of standalone feedback entries (not tied to any
    // complaint) so the QA Feedback page has something to show too.
    const FEEDBACK_COUNT = 24;
    const feedbackDocs = Array.from({ length: FEEDBACK_COUNT }, () => {
      const isAnonymous = Math.random() < 0.4;
      return {
        studentRef: pick(students)._id,
        category: pick(FEEDBACK_CATEGORIES),
        message: pick([
          "The new online portal is much easier to use than before.",
          "It would help if status updates were sent more frequently.",
          "Overall satisfied with how quickly my last request was handled.",
          "Suggest adding a mobile app for easier access on the go.",
          "Some office staff could be more approachable when asked questions.",
          "The complaint tracking feature is very helpful and transparent.",
        ]),
        isAnonymous,
        createdAt: daysAgo(randInt(0, 150)),
      };
    });
    await Feedback.insertMany(feedbackDocs);

    return NextResponse.json({
      message: "Database seeded with a full data set for analytics.",
      counts: {
        users: insertedUsers.length,
        colleges: colleges.length,
        categories: allCategories.length,
        complaints: complaintDocs.length,
        feedback: feedbackDocs.length,
      },
      offices: {
        primaryCollege: primaryCollege._id,
        registrarOffice: registrarOffice._id,
        osasOffice: osasOffice._id,
        ovpaaOffice: ovpaaOffice._id,
        ovpafOffice: ovpafOffice._id,
        qaOffice: qaOffice._id,
        generalServicesOffice: generalServicesOffice._id,
        complaintCategory: complaintCategory._id,
      },
      verifyRoutingAccounts: {
        note: "Log in as each office_staff account below (password ParSU_test2026) and confirm complaints for that office appear on their dashboard.",
        registrar: ["staff@parsu.edu.ph", "staff3@parsu.edu.ph"],
        osas: ["staff2@parsu.edu.ph"],
        generalServices: ["staff4@parsu.edu.ph"],
        cecs: ["staff5@parsu.edu.ph"],
        ced: ["dean.ced@parsu.edu.ph"],
        cbm: ["dean.cbm@parsu.edu.ph"],
        cos: ["dean.cos@parsu.edu.ph"],
        cah: ["dean.cah@parsu.edu.ph"],
        ovpaa: ["staff6@parsu.edu.ph"],
        ovpaf: ["staff7@parsu.edu.ph"],
        qualityAssurance: ["qa@parsu.edu.ph"],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
