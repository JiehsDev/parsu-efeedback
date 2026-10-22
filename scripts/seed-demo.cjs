/* eslint-disable @typescript-eslint/no-require-imports */
// Additive, opt-in development fixtures. Never call the destructive base seed here.
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const { createHash } = require("node:crypto");
const { addSlaHours } = require("../src/lib/sla-calendar.ts");

const PREFIX = "DEMO-OSAS-";
const PASSWORD = "ParSU_test2026";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function seedDemo(db, { now = new Date() } = {}) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  const office = await db.collection("offices").findOne({ code: "OSAS", isActive: true });
  if (!office) throw new Error("Configure the active OSAS office before adding demo data.");
  const head = await db.collection("users").findOne({
    _id: office.headUserRef,
    officeRef: office._id,
    isActive: true,
    role: { $in: ["osas", "office_staff"] },
  });
  if (!head) throw new Error("Configure an active OSAS head before adding demo data.");
  const categories = await db
    .collection("categories")
    .find({ isActive: true })
    .sort({ name: 1 })
    .toArray();
  if (!categories.length) throw new Error("At least one active category is required.");
  const colleges = await db
    .collection("offices")
    .find({ type: "college_office", isActive: true })
    .toArray();
  if (!colleges.length) throw new Error("At least one active student college is required.");
  const settings = await db.collection("settings").findOne({});
  const holidays = settings?.slaHolidays ?? [];
  const hash = await bcrypt.hash(PASSWORD, 10);
  const accounts = [];
  async function account(email, role, firstName, lastName, collegeRef = null) {
    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      if (
        !existing.isActive ||
        existing.role !== role ||
        (role === "office_staff" && String(existing.officeRef) !== String(office._id))
      ) {
        throw new Error(
          `Demo account ${email} exists with incompatible access; no account was changed.`,
        );
      }
      accounts.push({ email, created: false });
      return existing;
    }
    const user = {
      _id: new ObjectId(),
      email,
      employeeOrStudentId: `DEMO-${email.split("@")[0].toUpperCase()}`,
      firstName,
      lastName,
      role,
      passwordHash: hash,
      officeRef: role === "office_staff" ? office._id : null,
      collegeRef,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      tokenVersion: 0,
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("users").insertOne(user);
    accounts.push({ email, created: true });
    return user;
  }
  const staff = [
    await account("osas.demo.staff@parsu.edu.ph", "office_staff", "Mika", "Demo"),
    await account("osas.demo.staff2@parsu.edu.ph", "office_staff", "Rafael", "Demo"),
  ];
  const students = [];
  for (let i = 0; i < 6; i++)
    students.push(
      await account(
        i === 0 ? "demo.student@parsu.edu.ph" : `demo.student${i + 1}@parsu.edu.ph`,
        "student",
        ["Andrea", "Paolo", "Bea", "Carlo", "Diana", "Enzo"][i],
        "Demo",
        colleges[i % colleges.length]?._id ?? null,
      ),
    );
  // Find a submission time that produces the requested deadline using the real calendar.
  function submittedForDeadline(target) {
    let lower = target.getTime() - 400 * DAY;
    let upper = target.getTime();
    while (upper - lower > 1) {
      const mid = Math.floor((lower + upper) / 2);
      if (addSlaHours(new Date(mid), 72, holidays).getTime() < target.getTime()) lower = mid;
      else upper = mid;
    }
    return new Date(upper);
  }
  const showcases = [
    { label: "New complaint ready for assignment", status: "submitted", age: 2 / 24 },
    { label: "Unassigned complaint nearing SLA", status: "submitted", due: 12 },
    { label: "Overdue unassigned complaint", status: "submitted", due: -24 },
    { label: "Staff handling with public update", status: "in_progress", age: 1 },
    {
      label: "Another staff member's private queue",
      status: "in_progress",
      age: 1,
      otherStaff: true,
    },
    { label: "Head handling personally", status: "in_progress", age: 1, head: true },
    {
      label: "Awaiting student information",
      status: "pending_information",
      age: 2,
      information: "open",
    },
    {
      label: "Student information received",
      status: "in_progress",
      age: 2,
      information: "responded",
    },
    { label: "Due soon assigned complaint", status: "in_progress", due: 8 },
    {
      label: "Overdue complaint for supervisor review",
      status: "in_progress",
      due: -48,
      head: true,
      review: true,
    },
    { label: "Resolved complaint ready to rate or close", status: "resolved", age: 9 },
    { label: "Closed complaint with student rating", status: "closed", age: 10, rating: 5 },
    { label: "Closed without a rating", status: "closed", age: 11 },
    { label: "Withdrawn before assignment", status: "withdrawn", age: 3 },
    {
      label: "Pending archive request for approval",
      status: "in_progress",
      age: 2,
      archiveRequest: true,
    },
    {
      label: "Archived complaint ready to restore",
      status: "closed",
      age: 15,
      archived: true,
      rating: 4,
    },
    {
      label: "Reopened complaint with preserved history",
      status: "in_progress",
      age: 8,
      reopened: true,
    },
    {
      label: "Released complaint awaiting reassignment",
      status: "submitted",
      age: 1,
      released: true,
    },
    {
      label: "Rejected archive request with review reason",
      status: "in_progress",
      age: 2,
      archiveRejected: true,
    },
    { label: "Resolved complaint ready for reopening", status: "resolved", age: 12 },
  ];
  const scenarios = [...showcases];
  // Two records per category: recent and historical, spanning six months.
  for (let i = 0; i < categories.length * 2; i++)
    scenarios.push({
      label: `Sample ${categories[i % categories.length].name.toLowerCase()} follow-up`,
      status: i % 5 === 0 ? "resolved" : "closed",
      age: i < categories.length ? 8 + (i % 20) : 35 + ((i * 7) % 140),
      rating: i % 4 === 0 ? null : 2 + (i % 4),
      late: i % 6 === 0,
      category: categories[i % categories.length],
    });
  let created = 0;
  for (const [index, scenario] of scenarios.entries()) {
    const ticketNumber = `${PREFIX}${String(index + 1).padStart(4, "0")}`;
    if (await db.collection("complaints").findOne({ ticketNumber })) continue;
    const complaintId = new ObjectId(
      createHash("sha256").update(ticketNumber).digest("hex").slice(0, 24),
    );
    // Stable IDs let a rerun replace children left by an interrupted fixture insertion.
    for (const name of [
      "assignments",
      "complaint_timeline",
      "complaint_notes",
      "information_requests",
      "archive_requests",
    ]) {
      await db.collection(name).deleteMany({ complaintRef: complaintId });
    }
    await db.collection("notifications").deleteMany({ relatedComplaintRef: complaintId });
    await db
      .collection("audit_logs")
      .deleteMany({ entityType: "Complaint", entityId: complaintId });
    const category = scenario.category ?? categories[index % categories.length];
    const student = index < showcases.length ? students[0] : students[index % students.length];
    const submittedAt =
      scenario.due !== undefined
        ? submittedForDeadline(new Date(now.getTime() + scenario.due * HOUR))
        : new Date(now.getTime() - scenario.age * DAY);
    const due = addSlaHours(submittedAt, 72, holidays);
    const completed = ["resolved", "closed"].includes(scenario.status);
    const handler = scenario.head ? head : staff[scenario.otherStaff ? 1 : index % 2];
    const assigned = !["submitted", "withdrawn"].includes(scenario.status);
    const assignedAt = addSlaHours(submittedAt, scenario.late ? 80 : 1, holidays);
    const resolvedAt = completed
      ? addSlaHours(submittedAt, scenario.late ? 96 : 24, holidays)
      : null;
    const closedAt = scenario.status === "closed" ? new Date(resolvedAt.getTime() + HOUR) : null;
    const overdue = (resolvedAt ?? now) > due && scenario.status !== "withdrawn";
    const complaint = {
      _id: complaintId,
      ticketNumber,
      studentRef: student._id,
      categoryRef: category._id,
      title: `[Demo] ${scenario.label}`,
      description: `Demonstration complaint about ${category.name}. ${category.description ?? ""}\n\nThe student requests assistance and a clear update from OSAS. This sample record can be used to try the complaint workflow.`,
      priority: ["low", "medium", "high", "critical"][index % 4],
      status: scenario.status,
      assignedOfficeRef: office._id,
      assignedStaffRef: assigned ? handler._id : null,
      slaResponseDueAt: due,
      slaResolutionDueAt: due,
      slaCalendarRevision: null,
      slaPolicy: {
        version: 1,
        holidays,
        startedAt: submittedAt,
        responseHours: 72,
        resolutionHours: 72,
        warningThresholdPercent: 80,
      },
      isOverdue: overdue,
      supervisorReviewRequired: !!scenario.review,
      lastWarningNotifiedAt: null,
      lastResponseWarningNotifiedAt: null,
      resolutionSummary: completed
        ? "OSAS reviewed the concern, coordinated the necessary action, and confirmed the result with the student."
        : "",
      studentRating: scenario.status === "closed" ? (scenario.rating ?? null) : null,
      studentRatingComment: scenario.rating
        ? "Thank you for the update and assistance with my concern."
        : "",
      reopenCount: scenario.reopened ? 1 : 0,
      submittedAt,
      resolvedAt,
      resolvedByRef: completed ? handler._id : null,
      closedAt,
      closureType: closedAt ? (scenario.rating ? "rated" : "without_rating") : null,
      closedByRef: closedAt ? student._id : null,
      isArchived: !!scenario.archived,
      archivedAt: scenario.archived ? closedAt : null,
      archivedByRef: scenario.archived ? head._id : null,
      archiveReason: scenario.archived ? "Demo completed case archived for retention." : "",
      archiveSource: scenario.archived ? "office_head_direct" : null,
      restoredAt: null,
      restoredByRef: null,
      restoreReason: "",
      createdAt: submittedAt,
      updatedAt: closedAt ?? resolvedAt ?? assignedAt,
    };
    const timeline = [];
    function event(eventType, actorRef, createdAt, fromValue, toValue, message) {
      timeline.push({
        _id: new ObjectId(),
        complaintRef: complaint._id,
        eventType,
        actorRef,
        createdAt,
        fromValue,
        toValue,
        message,
        resolutionSummary: eventType === "resolved" ? complaint.resolutionSummary : "",
      });
    }
    event(
      "submitted",
      student._id,
      submittedAt,
      null,
      "submitted",
      "Complaint submitted and routed to OSAS.",
    );
    const assignments = [
      {
        _id: new ObjectId(),
        complaintRef: complaint._id,
        assignedByRef: null,
        assignedToRef: null,
        sourceOfficeRef: null,
        destinationOfficeRef: office._id,
        reason: "Initial OSAS routing",
        actionType: "assign",
        createdAt: submittedAt,
      },
    ];
    if (assigned || scenario.released) {
      assignments.push({
        _id: new ObjectId(),
        complaintRef: complaint._id,
        assignedByRef: head._id,
        assignedToRef: handler._id,
        sourceOfficeRef: office._id,
        destinationOfficeRef: office._id,
        reason: "OSAS head assigned a handler for this concern.",
        actionType: "assign",
        createdAt: assignedAt,
      });
      event(
        "assigned",
        head._id,
        assignedAt,
        null,
        String(handler._id),
        "OSAS head assigned the complaint to a handler.",
      );
      event(
        "status_changed",
        handler._id,
        assignedAt,
        "submitted",
        "in_progress",
        "We have reviewed your concern and are coordinating the next action. Please check here for updates.",
      );
    }
    if (scenario.released) {
      const releasedAt = new Date(assignedAt.getTime() + HOUR);
      assignments.push({
        _id: new ObjectId(),
        complaintRef: complaint._id,
        assignedByRef: handler._id,
        assignedToRef: null,
        sourceOfficeRef: office._id,
        destinationOfficeRef: office._id,
        reason: "Handler unavailable; returned to OSAS head for reassignment.",
        actionType: "release",
        createdAt: releasedAt,
      });
      event(
        "assignment_released",
        handler._id,
        releasedAt,
        "in_progress",
        "submitted",
        "Returned to the OSAS assignment queue.",
      );
    }
    if (assigned) {
      await db
        .collection("complaint_notes")
        .insertOne({
          complaintRef: complaint._id,
          authorRef: handler._id,
          body: "Demo internal note: verify the supporting details before advising the student. Visible only to authorized personnel.",
          isInternal: true,
          createdAt: assignedAt,
        });
      event("note_added", handler._id, assignedAt, null, null, "Internal note added.");
    }
    if (scenario.information) {
      const requestedAt = new Date(assignedAt.getTime() + HOUR);
      const respondedAt =
        scenario.information === "responded" ? new Date(requestedAt.getTime() + 2 * HOUR) : null;
      await db
        .collection("information_requests")
        .insertOne({
          complaintRef: complaint._id,
          requestedByRef: handler._id,
          requestMessage:
            "Please provide the date, location, and reference number related to your concern.",
          context: "These details will help OSAS verify the concern.",
          status: scenario.information,
          requestedAt,
          respondedAt,
          responseMessage: respondedAt
            ? "The concern occurred yesterday at the main campus. Reference: DEMO-1042."
            : "",
          responseAttachmentRefs: [],
          createdAt: requestedAt,
          updatedAt: respondedAt ?? requestedAt,
        });
      event(
        "information_requested",
        handler._id,
        requestedAt,
        "in_progress",
        "pending_information",
        "Please provide the date, location, and reference number related to your concern.",
      );
      if (respondedAt)
        event(
          "information_submitted",
          student._id,
          respondedAt,
          "pending_information",
          "in_progress",
          "The student supplied the requested details.",
        );
    }
    if (scenario.review)
      event(
        "escalated",
        head._id,
        new Date(now.getTime() - HOUR),
        "in_progress",
        "in_progress",
        "SLA breached. OSAS head review is required.",
      );
    if (scenario.reopened) {
      const previousResolution = addSlaHours(submittedAt, 24, holidays);
      event(
        "resolved",
        handler._id,
        previousResolution,
        "in_progress",
        "resolved",
        "Initial action completed.",
      );
      event(
        "reopened",
        head._id,
        new Date(previousResolution.getTime() + HOUR),
        "resolved",
        "in_progress",
        "Student reported that the issue persists; additional verification required.",
      );
    }
    if (completed)
      event(
        "resolved",
        handler._id,
        resolvedAt,
        "in_progress",
        "resolved",
        complaint.resolutionSummary,
      );
    if (closedAt) {
      if (scenario.rating)
        event(
          "rated",
          student._id,
          closedAt,
          null,
          String(scenario.rating),
          complaint.studentRatingComment,
        );
      event(
        "closed",
        student._id,
        closedAt,
        "resolved",
        "closed",
        scenario.rating
          ? "Student rated and closed the complaint."
          : "Student closed without rating.",
      );
    }
    if (scenario.status === "withdrawn")
      event(
        "withdrawn",
        student._id,
        new Date(submittedAt.getTime() + HOUR),
        "submitted",
        "withdrawn",
        "Student withdrew the duplicate concern.",
      );
    if (scenario.archiveRequest || scenario.archiveRejected) {
      const requestedAt = new Date(assignedAt.getTime() + HOUR);
      await db
        .collection("archive_requests")
        .insertOne({
          complaintRef: complaint._id,
          requestedByRef: handler._id,
          officeRef: office._id,
          reasonCode: "duplicate",
          reasonText: "Student confirmed this concern duplicates an earlier request.",
          reason: "Duplicate complaint",
          supportingNote: "Please review before archiving.",
          status: scenario.archiveRejected ? "rejected" : "pending",
          reviewedByRef: scenario.archiveRejected ? head._id : null,
          reviewedAt: scenario.archiveRejected ? new Date(requestedAt.getTime() + HOUR) : null,
          rejectionReason: scenario.archiveRejected
            ? "The concern has distinct supporting details. Continue processing."
            : "",
          createdAt: requestedAt,
          updatedAt: requestedAt,
        });
      event(
        "archive_requested",
        handler._id,
        requestedAt,
        null,
        "pending",
        "Archive requested: duplicate complaint.",
      );
      if (scenario.archiveRejected)
        event(
          "archive_rejected",
          head._id,
          new Date(requestedAt.getTime() + HOUR),
          "pending",
          "rejected",
          "The concern has distinct supporting details. Continue processing.",
        );
    }
    if (scenario.archived)
      event("archived", head._id, closedAt, null, null, complaint.archiveReason);
    complaint.updatedAt = new Date(Math.max(...timeline.map((item) => item.createdAt.getTime())));
    // Write parent last: a rerun repairs a partially written fixture without duplicating children.
    await db.collection("assignments").insertMany(assignments);
    await db.collection("complaint_timeline").insertMany(timeline);
    await db.collection("notifications").insertMany([
      {
        userRef: student._id,
        type: completed ? "complaint_resolved" : "status_updated",
        title: `Demo: ${scenario.label}`,
        body: completed
          ? complaint.resolutionSummary
          : "Your complaint has an update. Open it to see the latest status and messages.",
        relatedComplaintRef: complaint._id,
        isRead: index % 3 === 0,
        createdAt: complaint.updatedAt,
      },
      {
        userRef: assigned ? handler._id : head._id,
        type: assigned ? "complaint_assigned" : "complaint_submitted",
        title: `Demo: ${ticketNumber}`,
        body: scenario.label,
        relatedComplaintRef: complaint._id,
        isRead: index >= showcases.length,
        createdAt: complaint.updatedAt,
      },
    ]);
    await db
      .collection("audit_logs")
      .insertOne({
        actorRef: head._id,
        action: "demo_seed",
        entityType: "Complaint",
        entityId: complaint._id,
        beforeState: null,
        afterState: { ticketNumber, status: complaint.status },
        ipAddress: null,
        userAgent: "development-demo-seed",
        createdAt: now,
      });
    await db.collection("complaints").insertOne(complaint);
    created++;
  }
  const distribution = await db
    .collection("complaints")
    .aggregate([
      { $match: { ticketNumber: { $regex: `^${PREFIX}` } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  return {
    created,
    skipped: scenarios.length - created,
    totalDemo: distribution.reduce((sum, item) => sum + item.count, 0),
    distribution,
    headEmail: head.email,
    accounts,
  };
}

if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  (async () => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Demo seeding is disabled in production.");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    try {
      console.log(JSON.stringify(await seedDemo(client.db()), null, 2));
    } finally {
      await client.close();
    }
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { seedDemo, PREFIX };
