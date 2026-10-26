type NotificationCopy = { type: string; title: string; body: string };

/** Present older saved notices in the same language as newly created notices. */
export function notificationCopy(notification: NotificationCopy, student: boolean) {
  if (!student) return notification;
  const reference = notification.body.match(/\b[\w-]+-\d{4}-\d+\b/)?.[0];
  const subject = reference ? `Your complaint ${reference}` : "Your complaint";
  if (notification.type === "complaint_submitted")
    return {
      title: "Complaint submitted",
      body: `${subject} has been received. Open it to check its progress.`,
    };
  if (notification.type === "complaint_assigned")
    return { title: "Complaint under review", body: `${subject} is now under review.` };
  if (
    notification.type === "status_updated" &&
    ["Complaint forwarded", "Complaint routed to another office", "Complaint escalated"].includes(
      notification.title,
    )
  )
    return {
      title: "Complaint update",
      body: `${subject} is being reviewed. Open it to check for updates.`,
    };
  return notification;
}
