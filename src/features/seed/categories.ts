// Classification is independent of initial ownership: every category starts at OSAS.
export const SEED_CATEGORIES = [
  {
    name: "Student Conduct & Peer Concerns",
    description: "Bullying, harassment, conflicts, and misconduct involving other students",
    domain: "student_services",
    defaultPriority: "high",
  },
  {
    name: "Campus Safety & Security",
    description: "Unsecured areas, lost items, security personnel behavior, harassment concerns",
    domain: "student_services",
    defaultPriority: "high",
  },
  {
    name: "Student Services & Assistance",
    description: "Canteen hygiene/food quality, student organization/activity concerns",
    domain: "student_services",
    defaultPriority: "medium",
  },
  {
    name: "Health & Medical Services",
    description: "Clinic staffing/availability, first-aid supply concerns",
    domain: "student_services",
    defaultPriority: "medium",
  },
  {
    name: "Scholarships & Financial Assistance",
    description: "Delayed disbursement of scholarships, unclear grant guidelines",
    domain: "student_services",
    defaultPriority: "medium",
  },
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
