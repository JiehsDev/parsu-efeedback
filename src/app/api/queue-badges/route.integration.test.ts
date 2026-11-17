import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));

import { connectTestDb, disconnectTestDb, clearTestDb } from "@/test/setup-db";
import { createTestCategory, createTestOffice, createTestUser } from "@/test/fixtures";
import { Complaint } from "@/models/Complaint";
import { Assignment } from "@/models/Assignment";
import { ArchiveRequest } from "@/models/ArchiveRequest";
import { Office } from "@/models/Office";
import { GET, POST } from "./route";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

function login(user: any) {
  mocks.auth.mockResolvedValue({
    user: {
      id: String(user._id),
      role: user.role,
      officeRef: user.officeRef ? String(user.officeRef) : null,
    },
  });
}

async function counts() {
  return (await GET()).json() as Promise<{ counts: Record<string, number> }>;
}

async function check(key: string) {
  return POST(
    new NextRequest("http://localhost/api/queue-badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }),
  );
}

describe("queue badges", () => {
  it("starts with a baseline, counts a newly visible complaint, and clears only the checking user", async () => {
    const office = await createTestOffice({ code: "OSAS" });
    const category = await createTestCategory({ defaultOfficeRef: office._id });
    const student = await createTestUser();
    const staffA = await createTestUser({ role: "office_staff", officeRef: office._id });
    const staffB = await createTestUser({ role: "office_staff", officeRef: office._id });
    const old = await Complaint.create({
      ticketNumber: "BADGE-OLD",
      studentRef: student._id,
      categoryRef: category._id,
      title: "Earlier complaint",
      description: "Already in the list",
      priority: "medium",
      assignedOfficeRef: office._id,
    });
    await Office.updateOne({ _id: office._id }, { headUserRef: staffA._id });
    login(staffA);
    expect((await counts()).counts.complaints).toBe(0);
    login(staffB);
    expect((await counts()).counts.complaints).toBe(0);
    const newer = await Complaint.create({
      ticketNumber: "BADGE-NEW",
      studentRef: student._id,
      categoryRef: category._id,
      title: "New complaint",
      description: "Recently submitted",
      priority: "medium",
      assignedOfficeRef: office._id,
    });
    await ArchiveRequest.create({
      complaintRef: newer._id,
      requestedByRef: staffB._id,
      officeRef: office._id,
      reason: "Review archive request",
      reasonText: "Review archive request",
    });
    login(staffA);
    expect((await counts()).counts.complaints).toBe(1);
    expect((await counts()).counts.archive).toBe(1);
    expect((await check("complaints")).status).toBe(200);
    expect((await counts()).counts.complaints).toBe(0);
    expect((await counts()).counts.archive).toBe(1);
    login(staffB);
    expect((await counts()).counts.complaints).toBe(1);
    expect((await check("archive")).status).toBe(403);
    login(student);
    expect((await counts()).counts.archive).toBeUndefined();
    expect((await check("archive")).status).toBe(403);
    expect(old.ticketNumber).toBe("BADGE-OLD");
  });

  it("counts forwarding into a receiving office even when the complaint was submitted earlier", async () => {
    const osas = await createTestOffice({ code: "OSAS" });
    const receiving = await createTestOffice({ code: "OVPAA", type: "college_office" });
    const category = await createTestCategory({ defaultOfficeRef: osas._id });
    const student = await createTestUser();
    const head = await createTestUser({ role: "vpaa", officeRef: receiving._id });
    const complaint = await Complaint.create({
      ticketNumber: "BADGE-FORWARD",
      studentRef: student._id,
      categoryRef: category._id,
      title: "Forwarded complaint",
      description: "Created before check",
      priority: "medium",
      assignedOfficeRef: osas._id,
    });
    login(head);
    expect((await counts()).counts.complaints).toBe(0);
    complaint.assignedOfficeRef = receiving._id;
    complaint.assignedStaffRef = head._id;
    complaint.forwardedToRole = "vpaa";
    complaint.forwardedAt = new Date();
    await complaint.save();
    await Assignment.create({
      complaintRef: complaint._id,
      destinationOfficeRef: receiving._id,
      sourceOfficeRef: osas._id,
      assignedToRef: head._id,
      actionType: "forward",
    });
    expect((await counts()).counts.complaints).toBe(1);
  });
});
