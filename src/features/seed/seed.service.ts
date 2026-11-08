import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { join } from "node:path";
import { Office, User, Category, Complaint } from "@/models";
import { SEED_CATEGORIES } from "./categories";
import { migrateComplaintCategories } from "../../../scripts/migrate-complaint-categories.cjs";

const SEEDED_STAFF_EMAIL_MIGRATIONS = [
  ["staff2@parsu.edu.ph", "osas.staff1@parsu.edu"],
  ["osas.staff@parsu.edu.ph", "osas.staff2@parsu.edu.ph"],
  ["vpaa.staff@parsu.edu.ph", "vpaa.staff1@parsu.edu.ph"],
  ["vpaf.staff@parsu.edu.ph", "vpaf.staff1@parsu.edu.ph"],
] as const;

const SEEDED_OFFICES = [
  ["CECS", "College of Engineering & Computational Sciences", "college_office"],
  ["CED", "College of Education", "college_office"],
  ["CBM", "College of Business & Management", "college_office"],
  ["COS", "College of Science", "college_office"],
  ["CAH", "College of Arts and Humanities", "college_office"],
  ["ICTO", "Information and Communications Technology Office", "university_office"],
  ["HSU", "Health Services Unit", "university_office"],
  ["OVPAA", "Office of the Vice President for Academic Affairs", "university_office"],
  ["OVPAF", "Office of the Vice President for Administration and Finance", "university_office"],
] as const;

// Configuration seeding is non-destructive: never reset existing complaint data.
export async function seedDevelopmentData() {
  // Await unique indexes before upserts; first-run model initialization is asynchronous.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
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
  for (const [code, name, type] of SEEDED_OFFICES)
    await Office.updateOne(
      { code },
      { $setOnInsert: { code, name, type, isActive: true } },
      { upsert: true },
    );
  const vpaaOffice = await Office.findOne({ code: "OVPAA" });
  const vpafOffice = await Office.findOne({ code: "OVPAF" });
  const officeByCode = new Map(
    (await Office.find({ code: { $in: SEEDED_OFFICES.map(([code]) => code) } })).map((entry) => [
      entry.code,
      entry,
    ]),
  );
  const additionalOfficeUsers = SEEDED_OFFICES.filter(
    ([code]) => !["OVPAA", "OVPAF"].includes(code),
  ).flatMap(([code]) => {
    const officeRef = officeByCode.get(code)?._id;
    if (!officeRef) throw new Error(`Seeded office ${code} was not created.`);
    const emailPrefix = code.toLowerCase();
    return [
      {
        email: `${emailPrefix}.head@parsu.edu.ph`,
        role: "office_staff",
        firstName: code,
        lastName: "Head",
        employeeOrStudentId: `DEMO-${code}-HEAD`,
        officeRef,
      },
      ...[1, 2, 3].map((number) => ({
        email: `${emailPrefix}.staff${number}@parsu.edu.ph`,
        role: "office_staff",
        firstName: `${code} Staff`,
        lastName: String(number),
        employeeOrStudentId: `DEMO-${code}-STAFF-0${number}`,
        officeRef,
      })),
    ];
  });
  const passwordHash = await bcrypt.hash("ParSU_test2026", 10);

  // Rename existing seeded logins in place so they retain passwords and references.
  for (const [oldEmail, newEmail] of SEEDED_STAFF_EMAIL_MIGRATIONS) {
    const existing = await User.findOne({ email: oldEmail }).select("_id").lean();
    if (!existing) continue;
    const collision = await User.findOne({ email: newEmail }).select("_id").lean();
    if (collision && String(collision._id) !== String(existing._id)) {
      throw new Error(
        `Cannot rename seeded staff login ${oldEmail}: ${newEmail} is already in use.`,
      );
    }
    await User.updateOne({ _id: existing._id }, { $set: { email: newEmail } });
  }

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
      lastName: "Head",
      employeeOrStudentId: "EMP-VPAA",
      officeRef: vpaaOffice!._id,
    },
    {
      email: "vpaf@parsu.edu.ph",
      role: "vpaf",
      firstName: "VPAF",
      lastName: "Head",
      employeeOrStudentId: "EMP-VPAF",
      officeRef: vpafOffice!._id,
    },
    {
      email: "vpaa.staff1@parsu.edu.ph",
      role: "office_staff",
      firstName: "VPAA Staff",
      lastName: "1",
      employeeOrStudentId: "DEMO-VPAA-STAFF-01",
      officeRef: vpaaOffice!._id,
    },
    {
      email: "vpaa.staff2@parsu.edu.ph",
      role: "office_staff",
      firstName: "VPAA Staff",
      lastName: "2",
      employeeOrStudentId: "DEMO-VPAA-STAFF-02",
      officeRef: vpaaOffice!._id,
    },
    {
      email: "vpaa.staff3@parsu.edu.ph",
      role: "office_staff",
      firstName: "VPAA Staff",
      lastName: "3",
      employeeOrStudentId: "DEMO-VPAA-STAFF-03",
      officeRef: vpaaOffice!._id,
    },
    {
      email: "vpaf.staff1@parsu.edu.ph",
      role: "office_staff",
      firstName: "VPAF Staff",
      lastName: "1",
      employeeOrStudentId: "DEMO-VPAF-STAFF-01",
      officeRef: vpafOffice!._id,
    },
    {
      email: "vpaf.staff2@parsu.edu.ph",
      role: "office_staff",
      firstName: "VPAF Staff",
      lastName: "2",
      employeeOrStudentId: "DEMO-VPAF-STAFF-02",
      officeRef: vpafOffice!._id,
    },
    {
      email: "vpaf.staff3@parsu.edu.ph",
      role: "office_staff",
      firstName: "VPAF Staff",
      lastName: "3",
      employeeOrStudentId: "DEMO-VPAF-STAFF-03",
      officeRef: vpafOffice!._id,
    },
    {
      email: "osasdirector@parsu.edu.ph",
      role: "osas",
      firstName: "OSAS",
      lastName: "Director",
      employeeOrStudentId: "EMP-0017",
      officeRef: office._id,
    },
    {
      email: "osas.staff1@parsu.edu",
      role: "office_staff",
      firstName: "OSAS Staff",
      lastName: "1",
      employeeOrStudentId: "EMP-OSAS-1",
      officeRef: office._id,
    },
    {
      email: "osas.staff2@parsu.edu.ph",
      role: "office_staff",
      firstName: "OSAS Staff",
      lastName: "2",
      employeeOrStudentId: "EMP-OSAS-2",
      officeRef: office._id,
    },
    {
      email: "osas.staff3@parsu.edu.ph",
      role: "office_staff",
      firstName: "OSAS Staff",
      lastName: "3",
      employeeOrStudentId: "EMP-OSAS-3",
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
  users.push(...additionalOfficeUsers);
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
  for (const [role, receivingOffice] of [
    ["vpaa", vpaaOffice],
    ["vpaf", vpafOffice],
  ] as const) {
    const receiver = await User.findOne({ role, email: `${role}@parsu.edu.ph` });
    await Office.updateOne(
      { _id: receivingOffice!._id },
      { $set: { headUserRef: receiver!._id, isActive: true } },
    );
  }
  const head = await User.findOne({ email: "osasdirector@parsu.edu.ph" });
  await Office.updateOne({ _id: office._id }, { $set: { headUserRef: head!._id } });
  for (const user of additionalOfficeUsers.filter((candidate) => candidate.lastName === "Head")) {
    const seededHead = await User.findOne({ email: user.email }).select("_id");
    if (!seededHead) throw new Error(`Seeded office head ${user.email} was not created.`);
    await Office.updateOne({ _id: user.officeRef }, { $set: { headUserRef: seededHead._id } });
  }
  await migrateComplaintCategories(mongoose.connection.db!, {
    apply: true,
    categories: SEED_CATEGORIES,
    backupDirectory: join(process.cwd(), ".local-backups", "category-catalog"),
  });
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
