// Classification only. Every category still enters OSAS intake.
export const OSAS_CATEGORIES = [
  {
    name: "Guidance and Counseling Services",
    description: "Counseling appointments, student guidance, follow-up, and referrals.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
  {
    name: "Dormitory and Accommodation",
    description: "Dormitory facilities, accommodation, maintenance, cleanliness, and fee concerns.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
  {
    name: "Medical and Dental Services",
    description:
      "University clinic services, medical assistance, dental services, and clinic concerns.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
    legacyNames: ["Health & Medical Services"],
  },
  {
    name: "Food and Canteen Services",
    description: "Food quality, sanitation, canteen facilities, and service concerns.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
  {
    name: "Library Services",
    description: "Library facilities, schedules, resource access, borrowing, and service concerns.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
  {
    name: "Scholarships and Financial Assistance",
    description:
      "Scholarship applications, eligibility, requirements, financial assistance, and processing.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
    legacyNames: ["Scholarships & Financial Assistance"],
  },
  {
    name: "Student Organizations and Activities",
    description:
      "Student Council, publications, organizations, and cultural and sports activities.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
  {
    name: "Student Assistantship and Incentives",
    description:
      "Assistantship applications, compensation, incentives, eligibility, and benefit inquiries.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
  {
    name: "Student Conduct and Peer-Related Concerns",
    description:
      "Student conflicts, disrespectful behavior, bullying, harassment reports, and other peer concerns. Proposed reporting category; it does not establish disciplinary policy.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "high",
    legacyNames: ["Student Conduct & Peer Concerns"],
  },
  {
    name: "Other Student Services Concerns",
    description: "Student service concerns that do not fit the other available categories.",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
] as const;

// Recovered from git 12fe619, src/app/api/dev/seed/route.ts, lines 546-601.
// IDs and 72-hour SLA configuration corroborated by the pre-cleanup EJSON backup
// non-osas-cleanup-1792720853751.json. Never replace an existing category ID.
export const RESTORED_VPAA_CATEGORIES = [
  {
    name: "Curriculum & Class Scheduling",
    description: "Class scheduling conflicts, overcrowded sections, missing prerequisite subjects",
    domain: "academic",
    group: "vpaa",
    defaultPriority: "medium",
    historicalId: "6ad241a70973070a28daa440",
    historicalSlaId: "6ad241a70973070a28daa442",
  },
  {
    name: "Academic Advising & Consultation",
    description:
      "Faculty unavailability during posted consultation hours, lack of academic guidance",
    domain: "academic",
    group: "vpaa",
    defaultPriority: "low",
    historicalId: "6ad241a70973070a28daa443",
    historicalSlaId: "6ad241a80973070a28daa445",
  },
  {
    name: "Library Services & Resources",
    description: "Limited access to references, inconsistent library operating hours",
    domain: "academic",
    group: "vpaa",
    defaultPriority: "low",
    historicalId: "6ad241a80973070a28daa446",
    historicalSlaId: "6ad241a80973070a28daa448",
  },
] as const;
export const RESTORED_VPAF_CATEGORIES = [
  {
    name: "Student Payment & Cashier Concerns",
    description: "Tuition payment posting delays, fee assessment discrepancies",
    domain: "administrative",
    group: "vpaf",
    defaultPriority: "medium",
    historicalId: "6ad241ab0973070a28daa455",
    historicalSlaId: "6ad241ab0973070a28daa457",
  },
] as const;

export const CATEGORY_CATALOG = [
  ...OSAS_CATEGORIES,
  ...RESTORED_VPAA_CATEGORIES,
  ...RESTORED_VPAF_CATEGORIES,
  // Existing OSAS categories remain available; they are not silently retired.
  {
    name: "Campus Safety & Security",
    description: "Unsecured areas, lost items, security personnel behavior, harassment concerns",
    domain: "student_services",
    group: "osas",
    defaultPriority: "high",
  },
  {
    name: "Student Services & Assistance",
    description: "Canteen hygiene/food quality, student organization/activity concerns",
    domain: "student_services",
    group: "osas",
    defaultPriority: "medium",
  },
] as const;

// Keep the generic categories already provided by the development seed. They
// are not added to existing installations by the focused catalog migration.
export const SEED_CATEGORIES = [
  ...CATEGORY_CATALOG,
  {
    name: "Academic Concerns",
    description: "Teaching, coursework, assessment, and academic services",
    domain: "academic",
    defaultPriority: "medium",
  },
  {
    name: "Administrative Concerns",
    description: "Administrative procedures and university services",
    domain: "administrative",
    defaultPriority: "medium",
  },
  {
    name: "Finance Concerns",
    description: "Fees, payments, and financial services",
    domain: "finance",
    defaultPriority: "medium",
  },
  {
    name: "ICT Concerns",
    description: "University systems, connectivity, and technical services",
    domain: "ict",
    defaultPriority: "medium",
  },
  {
    name: "Facilities Concerns",
    description: "Buildings, rooms, equipment, and campus facilities",
    domain: "facilities",
    defaultPriority: "medium",
  },
  {
    name: "Other Concerns",
    description: "Concerns that do not fit another category",
    domain: "other",
    defaultPriority: "medium",
  },
] as const;
