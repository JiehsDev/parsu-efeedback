export const SEED_CATEGORIES = [
  {
    name: "Grade Concern",
    description: "Issues related to grade posting, computation, or disputes",
    defaultPriority: "medium",
    domain: "academic",
  },
  // --- Campus Facilities (General Services Office) ---
  {
    name: "Classroom & Laboratory Facilities",
    description: "Broken air conditioners/fans, malfunctioning projectors, damaged desks or chairs",
    domain: "facilities",
    defaultPriority: "medium",
  },
  {
    name: "Restroom & Sanitation",
    description: "Lack of running water, unsanitary conditions, damaged plumbing/fixtures",
    domain: "facilities",
    defaultPriority: "high",
  },
  {
    name: "Campus Wi-Fi & IT Infrastructure",
    description: "Slow or non-functional campus Wi-Fi, computer lab hardware/software issues",
    domain: "facilities",
    defaultPriority: "medium",
  },
  // --- Registrar's Office (records custody/issuance, per the URO
  // reference doc: OTR/certification issuance, grade-correction
  // encoding, registration paraphernalia, staff code of conduct) ---
  {
    name: "Document Request Delays",
    description: "Delays in issuing TOR, Honorable Dismissal, diploma, or certification requests",
    domain: "administrative",
    defaultPriority: "medium",
  },
  {
    name: "Staff Service & Responsiveness",
    description: "Unhelpful, slow, or unprofessional conduct from office personnel",
    domain: "administrative",
    defaultPriority: "medium",
  },
  {
    name: "Administrative Process Concerns",
    description: "Redundant requirements, cumbersome procedures, or unannounced office closures",
    domain: "administrative",
    defaultPriority: "low",
  },
  // --- Faculty/teaching complaints stay routed to the concerned
  // college office (not OVPAA) so a college's own performance is
  // tracked at the college level. ---
  {
    name: "Faculty & Non Teaching Performance",
    description:
      "Excessive absenteeism, late arrivals, poor instruction, or unprofessional behavior",
    domain: "academic",
    defaultPriority: "high",
  },
  {
    name: "Faculty & Non Teaching Performance - College of Education",
    description: "Teaching quality, faculty attendance, and classroom conduct concerns for CED",
    domain: "academic",
    defaultPriority: "high",
  },
  {
    name: "Faculty & Non Teaching Performance - College of Business & Management",
    description: "Teaching quality, faculty attendance, and classroom conduct concerns for CBM",
    domain: "academic",
    defaultPriority: "high",
  },
  {
    name: "Faculty & Non Teaching Performance - College of Science",
    description: "Teaching quality, faculty attendance, and classroom conduct concerns for COS",
    domain: "academic",
    defaultPriority: "high",
  },
  {
    name: "Faculty & Non Teaching Performance - College of Arts and Humanities",
    description: "Teaching quality, faculty attendance, and classroom conduct concerns for CAH",
    domain: "academic",
    defaultPriority: "high",
  },
  // --- OVPAA (institution-wide academic policy: curriculum, advising,
  // library — per the OVPAA reference doc's "types of inquiries
  // handled" list) ---
  {
    name: "Curriculum & Class Scheduling",
    description: "Class scheduling conflicts, overcrowded sections, missing prerequisite subjects",
    domain: "academic",
    defaultPriority: "medium",
  },
  {
    name: "Academic Advising & Consultation",
    description:
      "Faculty unavailability during posted consultation hours, lack of academic guidance",
    domain: "academic",
    defaultPriority: "low",
  },
  {
    name: "Library Services & Resources",
    description: "Limited access to references, inconsistent library operating hours",
    domain: "academic",
    defaultPriority: "low",
  },
  // --- OSAS (student affairs: scholarships, complaints/discipline,
  // organizations, activities, dormitories/boarding houses, plus
  // safety/health as student-welfare concerns — per the OSAS
  // reference note) ---
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
  // --- OVPAF (administration & finance: payments, cashier concerns) ---
  {
    name: "Student Payment & Cashier Concerns",
    description: "Tuition payment posting delays, fee assessment discrepancies",
    domain: "administrative",
    defaultPriority: "medium",
  },
  // --- University Health Services Unit ---
  {
    name: "Consultation",
    description: "General request for health consultation",
    domain: "health",
    defaultPriority: "medium",
  },
  {
    name: "Physical Examination",
    description: "Request or concern related to physical examination",
    domain: "health",
    defaultPriority: "medium",
  },
  {
    name: "Weight and Height Monitoring",
    description: "Request for weight and height monitoring",
    domain: "health",
    defaultPriority: "low",
  },
  {
    name: "BP Monitoring",
    description: "Request for blood pressure monitoring",
    domain: "health",
    defaultPriority: "medium",
  },
  {
    name: "Blood Chemistry",
    description: "Inquiry or request related to blood chemistry",
    domain: "health",
    defaultPriority: "high",
  },
  {
    name: "Wound Treatment",
    description: "Request for wound treatment or care",
    domain: "health",
    defaultPriority: "high",
  },
  {
    name: "Issuance of Medicines",
    description: "Request or inquiry regarding medicines issued by the university clinic",
    domain: "health",
    defaultPriority: "medium",
  },
  {
    name: "Issuance of Medical Certificate for Off-Campus Activity",
    description: "Request for a medical certificate required for off-campus activity",
    domain: "health",
    defaultPriority: "medium",
  },
  {
    name: "Speakership Invitation for Health Education Campaign",
    description: "Request or invitation for HSU participation in a health education campaign",
    domain: "health",
    defaultPriority: "low",
  },
  // --- ICTO (information technology services and support) ---
  {
    name: "User Accounts",
    description:
      "Student PBox, institutional email, password reset, account activation, faculty/staff accounts, and other ICT credentials",
    domain: "ict",
    defaultPriority: "medium",
  },
  {
    name: "Online System Support",
    description:
      "Enrollment system, Student Clearance, Entrant's Applications, Student Accounts, and other supported university online systems",
    domain: "ict",
    defaultPriority: "medium",
  },
  {
    name: "Internet and Network",
    description: "Wi-Fi connectivity, internet connection, and network access",
    domain: "ict",
    defaultPriority: "high",
  },
  {
    name: "ICT Equipment Servicing",
    description:
      "Desktop and laptop repair, printer concerns, software installation, troubleshooting, and technical support",
    domain: "ict",
    defaultPriority: "medium",
  },
  {
    name: "Website and Digital Services",
    description: "Website access, online services, and system/service availability",
    domain: "ict",
    defaultPriority: "medium",
  },
  {
    name: "Multimedia",
    description:
      "Livestreaming technical support, video coverage, remote audit/accreditation support, and LED panel troubleshooting and maintenance",
    domain: "ict",
    defaultPriority: "medium",
  },
  {
    name: "ICT Facilities",
    description: "ICT laboratory access, network facilities, and ICT equipment access",
    domain: "ict",
    defaultPriority: "medium",
  },
  {
    name: "Cybersecurity",
    description:
      "Phishing, leaked passwords, suspicious emails, and unauthorized access or password concerns",
    domain: "ict",
    defaultPriority: "critical",
  },
  {
    name: "System Errors",
    description: "Login errors, unavailable systems, and technical or system issues",
    domain: "ict",
    defaultPriority: "high",
  },
  {
    name: "General ICT Inquiry",
    description: "ICT services, ICT procedures, and general technical assistance",
    domain: "ict",
    defaultPriority: "low",
  },
] as const;
