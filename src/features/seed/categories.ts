// OSAS student-affairs categories. Other offices are outside this catalog.
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
] as const;
