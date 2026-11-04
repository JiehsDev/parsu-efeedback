/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit, append-only analytics fixtures. Normal configuration seeding stays ticket-free.
const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { MongoClient, ObjectId, BSON } = require("mongodb");
const { addSlaHours } = require("../src/lib/sla-calendar.ts");
const DATASET = "analytics-demo-v1";
const HOUR = 3600000;
const idFor = (key) =>
  new ObjectId(createHash("sha256").update(`${DATASET}:${key}`).digest("hex").slice(0, 24));
const digest = (rows) => createHash("sha256").update(BSON.EJSON.stringify(rows)).digest("hex");

async function seedAnalyticsDemo(db, { apply = false, now = new Date(), backupDirectory } = {}) {
  const markerId = idFor("manifest");
  const previous = await db.collection("audit_logs").findOne({ _id: markerId });
  if (previous) {
    if (previous.action !== "demo.analytics.seeded") throw new Error("Demo manifest ID collision.");
    return { applied: false, alreadySeeded: true, ...previous.afterState.summary };
  }
  const offices = await db
    .collection("offices")
    .find({ isActive: true })
    .sort({ code: 1 })
    .toArray();
  const byCode = (code) => offices.find((office) => office.code === code);
  const osas = byCode("OSAS");
  const vpaa = byCode("OVPAA");
  const vpaf = byCode("OVPAF");
  const colleges = offices.filter((office) => office.type === "college_office");
  if (!osas || !vpaa || !vpaf || colleges.length < 2)
    throw new Error("Configure OSAS, VPAA, VPAF and at least two active colleges first.");
  const users = await db.collection("users").find({ isActive: true }).toArray();
  const head = users.find(
    (user) =>
      String(user._id) === String(osas.headUserRef) &&
      ["osas", "office_staff"].includes(user.role) &&
      String(user.officeRef) === String(osas._id),
  );
  const receivers = {
    vpaa: users.find(
      (user) =>
        user.role === "vpaa" &&
        String(user._id) === String(vpaa.headUserRef) &&
        String(user.officeRef) === String(vpaa._id),
    ),
    vpaf: users.find(
      (user) =>
        user.role === "vpaf" &&
        String(user._id) === String(vpaf.headUserRef) &&
        String(user.officeRef) === String(vpaf._id),
    ),
  };
  if (!head || !receivers.vpaa || !receivers.vpaf)
    throw new Error("Designated active OSAS and receiving-office heads are required.");
  const staff = users.filter(
    (user) => user.role === "office_staff" && String(user.officeRef) === String(osas._id),
  );
  if (!staff.length) staff.push(head);
  const categories = await db
    .collection("categories")
    .find({ isActive: true })
    .sort({ name: 1 })
    .toArray();
  if (!categories.length) throw new Error("Active categories are required.");
  const rules = await db.collection("sla_rules").find({ isActive: true }).toArray();
  const ruleFor = (category) =>
    rules.find(
      (rule) =>
        String(rule.categoryRef) === String(category._id) &&
        rule.priority === category.defaultPriority,
    ) ??
    rules.find((rule) => rule.categoryRef == null && rule.priority === category.defaultPriority);
  for (const category of categories) {
    const rule = ruleFor(category);
    if (
      !rule ||
      !Number.isFinite(rule.responseHours) ||
      !Number.isFinite(rule.resolutionHours) ||
      rule.responseHours <= 0 ||
      rule.resolutionHours <= 0
    )
      throw new Error(`Configure a positive-duration SLA rule for ${category.name} first.`);
  }
  const settings = await db.collection("settings").findOne({ _id: "global" });
  const holidays = settings?.slaHolidays ?? [];
  const docs = {
    users: [],
    complaints: [],
    assignments: [],
    complaint_timeline: [],
    forwarding_requests: [],
    information_requests: [],
    audit_logs: [],
  };
  // No usable credentials or active synthetic accounts are introduced.
  for (const [index, college] of colleges.entries()) {
    for (let student = 0; student < 3; student++)
      docs.users.push({
        _id: idFor(`student:${index}:${student}`),
        employeeOrStudentId: `DEMO-ANALYTICS-${index}-${student}`,
        firstName: "Demo",
        lastName: `${college.code} Student ${student + 1}`,
        email: `analytics.${index}.${student}@demo.invalid`,
        passwordHash: require("bcryptjs").hashSync(randomBytes(32).toString("hex"), 10),
        role: "student",
        officeRef: null,
        collegeRef: college._id,
        isActive: false,
        tokenVersion: 0,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: now,
        updatedAt: now,
      });
  }
  let sequence = 0;
  const statuses = [
    "closed",
    "resolved",
    "in_progress",
    "closed",
    "pending_information",
    "assigned",
    "closed",
    "resolved",
    "submitted",
    "escalated",
    "withdrawn",
    "closed",
  ];
  const latestMonthOffset =
    now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) < 24 * HOUR ? -1 : 0;
  const high = categories.filter((category) => category.defaultPriority === "high");
  const low = categories.filter((category) => category.defaultPriority === "low");
  for (let month = 0; month < 6; month++) {
    const count = 20 + month * 4;
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + month + latestMonthOffset, 1),
    );
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    // Retain enough time for assignment/forwarding/resolution without future events.
    const last = Math.min(end.getTime() - 2 * HOUR, now.getTime() - 12 * HOUR);
    for (let slot = 0; slot < count; slot++) {
      const index = sequence++;
      const category = (
        slot % 7 === 0 && high.length ? high : slot % 9 === 0 && low.length ? low : categories
      )[
        index %
          (slot % 7 === 0 && high.length
            ? high.length
            : slot % 9 === 0 && low.length
              ? low.length
              : categories.length)
      ];
      const student = docs.users[index % docs.users.length];
      const submittedAt = new Date(start.getTime() + (last - start.getTime()) * (slot / count));
      const rule = ruleFor(category);
      const slaResponseDueAt = addSlaHours(submittedAt, rule.responseHours, holidays);
      const slaResolutionDueAt = addSlaHours(submittedAt, rule.resolutionHours, holidays);
      const assignedAt = new Date(submittedAt.getTime() + (1 + (index % 5)) * HOUR);
      const forwardedAt = new Date(assignedAt.getTime() + HOUR);
      const status = statuses[(slot + month) % statuses.length];
      const hasHandler = !["submitted", "withdrawn"].includes(status);
      const terminal = status === "closed" || status === "resolved";
      const destination =
        ["vpaa", "vpaf"].includes(category.group) &&
        hasHandler &&
        status !== "assigned" &&
        index % 3 !== 0
          ? category.group
          : null;
      const target = destination === "vpaa" ? vpaa : destination === "vpaf" ? vpaf : osas;
      const handler = destination ? receivers[destination] : staff[index % staff.length];
      const plannedResolution =
        index % 4 === 0
          ? new Date(slaResolutionDueAt.getTime() + (6 + (index % 24)) * HOUR)
          : addSlaHours(
              submittedAt,
              Math.max(8, rule.resolutionHours * (0.25 + (index % 3) * 0.15)),
              holidays,
            );
      const resolvedAt = terminal
        ? new Date(Math.min(plannedResolution.getTime(), now.getTime() - 2 * HOUR))
        : null;
      const closedAt = status === "closed" ? new Date(resolvedAt.getTime() + HOUR) : null;
      const isArchived = terminal && !destination && index % 19 === 0;
      const rated = status === "closed" && index % 3 !== 0;
      const complaintId = idFor(`complaint:${index}`);
      const complaint = {
        _id: complaintId,
        ticketNumber: `DEMO-ANALYTICS-${String(index + 1).padStart(4, "0")}`,
        studentRef: student._id,
        categoryRef: category._id,
        title: `[DEMO] ${category.name} — example ${index + 1}`,
        description:
          "Synthetic analytics demonstration record. This is not an actual student complaint. Use it to explore charts, report filters, SLA compliance, and handling history.",
        priority: category.defaultPriority,
        status,
        assignedOfficeRef: target._id,
        assignedStaffRef: hasHandler ? handler._id : null,
        initialOfficeRef: osas._id,
        forwardedToRole: destination,
        forwardedAt: destination ? forwardedAt : null,
        slaResponseDueAt,
        slaResolutionDueAt,
        slaCalendarRevision: null,
        slaPolicy: {
          version: 1,
          holidays,
          startedAt: submittedAt,
          responseHours: rule.responseHours,
          resolutionHours: rule.resolutionHours,
          warningThresholdPercent: rule.warningThresholdPercent ?? 80,
        },
        isOverdue: terminal
          ? resolvedAt > slaResolutionDueAt
          : status !== "withdrawn" && now > slaResolutionDueAt,
        supervisorReviewRequired: status === "escalated",
        lastWarningNotifiedAt: null,
        lastResponseWarningNotifiedAt: null,
        resolutionSummary: terminal
          ? "[DEMO] Service concern reviewed and addressed for analytics demonstration."
          : "",
        studentRating: rated ? 1 + (index % 5) : null,
        studentRatingComment: rated ? "[DEMO] Synthetic satisfaction rating." : "",
        reopenCount: 0,
        submittedAt,
        resolvedAt,
        resolvedByRef: terminal ? handler._id : null,
        closedAt,
        closureType: status === "closed" ? (rated ? "rated" : "without_rating") : null,
        closedByRef: status === "closed" ? student._id : null,
        isArchived,
        archivedAt: isArchived ? new Date(resolvedAt.getTime() + 2 * HOUR) : null,
        archivedByRef: isArchived ? head._id : null,
        archiveReason: isArchived ? "[DEMO] Archived demonstration case." : "",
        archiveSource: isArchived ? "office_head_direct" : null,
        createdAt: submittedAt,
        updatedAt: closedAt ?? resolvedAt ?? assignedAt,
      };
      docs.complaints.push(complaint);
      const event = (key, eventType, at, actorRef, fromValue, toValue, message) =>
        docs.complaint_timeline.push({
          _id: idFor(`timeline:${index}:${key}`),
          complaintRef: complaintId,
          eventType,
          actorRef,
          fromValue,
          toValue,
          message: `[DEMO] ${message}`,
          resolutionSummary: eventType === "resolved" ? complaint.resolutionSummary : "",
          createdAt: at,
        });
      const assignment = (
        key,
        at,
        assignedByRef,
        assignedToRef,
        sourceOfficeRef,
        destinationOfficeRef,
        actionType,
      ) =>
        docs.assignments.push({
          _id: idFor(`assignment:${index}:${key}`),
          complaintRef: complaintId,
          assignedByRef,
          assignedToRef,
          sourceOfficeRef,
          destinationOfficeRef,
          actionType,
          reason: "[DEMO] Simulated handling history for analytics.",
          createdAt: at,
        });
      event(
        "submitted",
        "submitted",
        submittedAt,
        student._id,
        null,
        "submitted",
        "Synthetic complaint submitted to OSAS.",
      );
      event(
        "routed",
        "assigned",
        submittedAt,
        null,
        null,
        "OSAS",
        "Initial OSAS intake, independent of category classification.",
      );
      assignment("intake", submittedAt, null, null, null, osas._id, "assign");
      if (hasHandler) {
        assignment(
          "handler",
          assignedAt,
          head._id,
          staff[index % staff.length]._id,
          osas._id,
          osas._id,
          "assign",
        );
        event(
          "assigned",
          "assigned",
          assignedAt,
          head._id,
          "submitted",
          "assigned",
          "OSAS head assigned an OSAS handler.",
        );
      }
      if (hasHandler && status !== "assigned")
        event(
          "progress",
          "status_changed",
          new Date(assignedAt.getTime() + HOUR / 2),
          staff[index % staff.length]._id,
          "assigned",
          "in_progress",
          "Handler began review.",
        );
      if (destination) {
        const requestedAt = new Date(assignedAt.getTime() + HOUR / 2);
        docs.forwarding_requests.push({
          _id: idFor(`forwarding:${index}`),
          complaintRef: complaintId,
          fromOfficeRef: osas._id,
          destinationOfficeRef: target._id,
          requestedDestination: destination,
          requestedByUserRef: staff[index % staff.length]._id,
          reason: "[DEMO] Simulated referral requiring the receiving office's service.",
          status: "approved",
          requestedAt,
          reviewedByUserRef: head._id,
          reviewedAt: forwardedAt,
          reviewReason: "[DEMO] Simulated approval by the designated OSAS Office Head.",
        });
        event(
          "request",
          "forwarding_requested",
          requestedAt,
          staff[index % staff.length]._id,
          null,
          destination,
          "OSAS handler requested formal forwarding.",
        );
        event(
          "approved",
          "forwarding_approved",
          forwardedAt,
          head._id,
          "pending",
          "approved",
          "Simulated OSAS Office Head approval; original SLA deadlines retained.",
        );
        event(
          "forwarded",
          "complaint_forwarded",
          forwardedAt,
          head._id,
          "OSAS",
          destination.toUpperCase(),
          "Ownership transferred after formal approval.",
        );
        assignment("forward", forwardedAt, head._id, handler._id, osas._id, target._id, "forward");
      }
      if (terminal)
        event(
          "resolved",
          "resolved",
          resolvedAt,
          handler._id,
          "in_progress",
          "resolved",
          "Synthetic resolution with original SLA monitoring.",
        );
      else if (["pending_information", "escalated", "withdrawn"].includes(status))
        event(
          "state",
          "status_changed",
          hasHandler
            ? new Date((destination ? forwardedAt : assignedAt).getTime() + HOUR)
            : assignedAt,
          status === "withdrawn" ? student._id : handler._id,
          hasHandler ? "in_progress" : "submitted",
          status,
          "Demonstration lifecycle state; no automatic office transfer.",
        );
      if (status === "pending_information") {
        const requestedAt = new Date((destination ? forwardedAt : assignedAt).getTime() + HOUR);
        docs.information_requests.push({
          _id: idFor(`information:${index}`),
          complaintRef: complaintId,
          requestedByRef: handler._id,
          requestMessage: "[DEMO] Please provide supporting details for this demonstration case.",
          context: "Synthetic analytics fixture",
          status: "open",
          requestedAt,
          respondedAt: null,
          responseMessage: "",
          responseAttachmentRefs: [],
          createdAt: requestedAt,
          updatedAt: requestedAt,
        });
        event(
          "information",
          "information_requested",
          requestedAt,
          handler._id,
          null,
          "open",
          "Handler requested supporting information.",
        );
      }
      if (closedAt)
        event(
          "closed",
          "closed",
          closedAt,
          student._id,
          "resolved",
          "closed",
          rated ? "Closed with a synthetic rating." : "Closed without a rating.",
        );
      if (isArchived)
        event(
          "archived",
          "archived",
          complaint.archivedAt,
          head._id,
          null,
          "archived",
          "Demonstration case archived.",
        );
      docs.audit_logs.push({
        _id: idFor(`audit:${index}`),
        actorRef: null,
        action: "demo.analytics.complaint_imported",
        entityType: "Complaint",
        entityId: complaintId,
        beforeState: null,
        afterState: {
          dataset: DATASET,
          synthetic: true,
          ticketNumber: complaint.ticketNumber,
          forwardingRequestRef: destination ? idFor(`forwarding:${index}`) : null,
        },
        ipAddress: null,
        userAgent: "analytics-demo-seed",
        createdAt: now,
      });
    }
  }
  const summary = {
    dataset: DATASET,
    complaints: docs.complaints.length,
    demoStudents: docs.users.length,
    colleges: colleges.length,
    months: 6,
    categories: new Set(docs.complaints.map((row) => String(row.categoryRef))).size,
    forwarded: docs.forwarding_requests.length,
    archived: docs.complaints.filter((row) => row.isArchived).length,
    statuses: Object.fromEntries(
      statuses
        .filter((value, index, array) => array.indexOf(value) === index)
        .map((status) => [status, docs.complaints.filter((row) => row.status === status).length]),
    ),
  };
  if (!apply) return { applied: false, alreadySeeded: false, ...summary };
  if (!backupDirectory)
    throw new Error("An append-manifest directory is required before inserting demo data.");
  // Check every planned identity, ticket, and synthetic account before any writes.
  for (const [name, rows] of Object.entries(docs))
    if (await db.collection(name).findOne({ _id: { $in: rows.map((row) => row._id) } }))
      throw new Error(`Demo identity collision in ${name}; no data was inserted.`);
  if (
    await db
      .collection("complaints")
      .findOne({ ticketNumber: { $in: docs.complaints.map((row) => row.ticketNumber) } })
  )
    throw new Error("Demo ticket number collision; no data was inserted.");
  if (
    await db.collection("users").findOne({
      $or: [
        { email: { $in: docs.users.map((row) => row.email) } },
        { employeeOrStudentId: { $in: docs.users.map((row) => row.employeeOrStudentId) } },
      ],
    })
  )
    throw new Error("Demo account identity collision; no data was inserted.");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const manifestFile = path.join(
    backupDirectory,
    `analytics-demo-${Date.now()}-${randomUUID()}.json`,
  );
  const original = {};
  for (const name of Object.keys(docs))
    original[name] = {
      sha256: digest(await db.collection(name).find().sort({ _id: 1 }).toArray()),
      insertedIds: docs[name].map((row) => String(row._id)),
    };
  original.audit_logs.insertedIds.push(String(markerId));
  fs.writeFileSync(
    manifestFile,
    JSON.stringify({ dataset: DATASET, createdAt: now, summary, collections: original }, null, 2),
    { flag: "wx" },
  );
  docs.audit_logs.push({
    _id: markerId,
    actorRef: null,
    action: "demo.analytics.seeded",
    entityType: "DemoDataset",
    entityId: DATASET,
    beforeState: null,
    afterState: { synthetic: true, summary, anchorAt: now },
    ipAddress: null,
    userAgent: "analytics-demo-seed",
    createdAt: now,
  });
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [name, rows] of Object.entries(docs))
        if (rows.length) await db.collection(name).insertMany(rows, { session });
    });
  } finally {
    await session.endSession();
  }
  // Verify old documents by excluding only this import's IDs, never by counts alone.
  for (const name of Object.keys(docs)) {
    const preserved = await db
      .collection(name)
      .find({ _id: { $nin: docs[name].map((row) => row._id) } })
      .sort({ _id: 1 })
      .toArray();
    if (digest(preserved) !== original[name].sha256)
      throw new Error(`Existing ${name} changed during the seed; review the append manifest.`);
  }
  return {
    applied: true,
    alreadySeeded: false,
    ...summary,
    existingRecordsPreserved: true,
    manifestFile,
  };
}
module.exports = { seedAnalyticsDemo };
if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  (async () => {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try {
      await client.connect();
      console.log(
        JSON.stringify(
          await seedAnalyticsDemo(client.db(), {
            apply: process.argv.includes("--apply"),
            backupDirectory: path.resolve(".local-backups/analytics-demo"),
          }),
          null,
          2,
        ),
      );
    } finally {
      await client.close();
    }
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
