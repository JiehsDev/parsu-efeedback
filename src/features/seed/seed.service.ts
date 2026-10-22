import bcrypt from "bcryptjs";
import {
  Office,
  User,
  Category,
  RoutingRule,
  SLARule,
  Complaint,
  ComplaintTimeline,
  ComplaintNote,
  Assignment,
  ArchiveRequest,
  InformationRequest,
  Attachment,
  Notification,
  AuditLog,
} from "@/models";
import { DEFAULT_SLA_HOURS } from "@/lib/constants";
import { SEED_CATEGORIES } from "./categories";
// Explicit development reset of tickets only. Configuration and account IDs are stable.
export async function seedDevelopmentData() {
  for (const model of [
    InformationRequest,
    ArchiveRequest,
    Assignment,
    Attachment,
    ComplaintNote,
    ComplaintTimeline,
  ] as any[])
    await model.deleteMany({});
  await Notification.deleteMany({ relatedComplaintRef: { $ne: null } });
  await Complaint.deleteMany({});
  await AuditLog.deleteMany({
    entityType: {
      $in: [
        "Complaint",
        "Assignment",
        "ArchiveRequest",
        "ComplaintNote",
        "Attachment",
        "InformationRequest",
      ],
    },
  });
  const office = await Office.findOneAndUpdate(
    { code: "OSAS" },
    {
      $set: {
        name: "Office of Student Affairs and Services",
        type: "university_office",
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  for (const [code, name, type] of [
    ["CECS", "College of Engineering & Computational Sciences", "college_office"],
    ["CED", "College of Education", "college_office"],
    ["CBM", "College of Business & Management", "college_office"],
    ["COS", "College of Science", "college_office"],
    ["CAH", "College of Arts and Humanities", "college_office"],
    ["ICTO", "Information and Communications Technology Office", "university_office"],
    ["HSU", "Health Services Unit", "university_office"],
    ["OVPAA", "Office of the Vice President for Academic Affairs", "university_office"],
    ["OVPAF", "Office of the Vice President for Administration and Finance", "university_office"],
  ])
    await Office.updateOne(
      { code },
      { $setOnInsert: { code, name, type, isActive: true } },
      { upsert: true },
    );
  const passwordHash = await bcrypt.hash("ParSU_test2026", 10);
  const users = [
    {
      email: "admin@parsu.edu.ph",
      role: "administrator",
      firstName: "Main",
      lastName: "Administrator",
      employeeOrStudentId: "EMP-ADMIN",
      officeRef: null,
    },
    {
      email: "vpaa@parsu.edu.ph",
      role: "vpaa",
      firstName: "VPAA",
      lastName: "Oversight",
      employeeOrStudentId: "EMP-VPAA",
      officeRef: null,
    },
    {
      email: "vpaf@parsu.edu.ph",
      role: "vpaf",
      firstName: "VPAF",
      lastName: "Oversight",
      employeeOrStudentId: "EMP-VPAF",
      officeRef: null,
    },
    {
      email: "osasdirector@parsu.edu.ph",
      role: "osas",
      firstName: "Cristina",
      lastName: "Bautista",
      employeeOrStudentId: "EMP-0017",
      officeRef: office._id,
    },
    {
      email: "staff2@parsu.edu.ph",
      role: "office_staff",
      firstName: "OSAS",
      lastName: "Staff",
      employeeOrStudentId: "EMP-OSAS-1",
      officeRef: office._id,
    },
    {
      email: "osas.staff@parsu.edu.ph",
      role: "office_staff",
      firstName: "OSAS",
      lastName: "Staff Two",
      employeeOrStudentId: "EMP-OSAS-2",
      officeRef: office._id,
    },
    {
      email: "student@parsu.edu.ph",
      role: "student",
      firstName: "Elliot",
      lastName: "Anderson",
      employeeOrStudentId: "2023-10492",
      officeRef: null,
    },
  ];
  users.push({
    email: "student20002@parsu.edu.ph",
    role: "student",
    firstName: "Another",
    lastName: "Student",
    employeeOrStudentId: "2023-20002",
    officeRef: null,
  });
  const college = await Office.findOne({ code: "CECS" });
  for (const user of users) {
    const { email, employeeOrStudentId, ...data } = user;
    await User.updateOne(
      { email },
      {
        $set: { ...data, collegeRef: user.role === "student" ? college!._id : null },
        $setOnInsert: { email, employeeOrStudentId, passwordHash, isActive: true, tokenVersion: 0 },
      },
      { upsert: true },
    );
  }
  const head = await User.findOne({ email: "osasdirector@parsu.edu.ph" });
  await Office.updateOne({ _id: office._id }, { $set: { headUserRef: head!._id } });
  for (const category of SEED_CATEGORIES)
    await Category.updateOne(
      { name: category.name },
      { $setOnInsert: { ...category, isActive: true, defaultOfficeRef: office._id } },
      { upsert: true },
    );
  // Existing official and custom categories are preserved and centralized as well.
  for (const category of await Category.find()) {
    await Category.updateOne({ _id: category._id }, { $set: { defaultOfficeRef: office._id } });
    if (!category.isActive) continue;
    await RoutingRule.updateOne(
      { categoryRef: category._id, isActive: true },
      {
        $set: { targetOfficeRef: office._id, conditions: {} },
        $setOnInsert: { categoryRef: category._id, isActive: true },
      },
      { upsert: true },
    );
    await SLARule.updateOne(
      { categoryRef: category._id, isActive: true },
      {
        $set: { priority: category.defaultPriority, escalateToOfficeRef: null },
        $setOnInsert: {
          categoryRef: category._id,
          isActive: true,
          ...DEFAULT_SLA_HOURS[category.defaultPriority],
        },
      },
      { upsert: true },
    );
  }
  return {
    office: office._id,
    counts: {
      complaints: await Complaint.countDocuments(),
      categories: await Category.countDocuments(),
      users: await User.countDocuments(),
    },
    accounts: users.map((user) => ({ email: user.email, role: user.role })),
  };
}
