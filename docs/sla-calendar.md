# SLA calendar

New complaints count response and resolution hours around the clock on Monday
through Friday, in Philippine time (Asia/Manila, UTC+8). Saturdays, Sundays and
configured holiday dates contribute no time. For example, 10 SLA hours starting
Friday at 6 PM end Monday at 4 AM. If Monday is configured as a holiday, the
deadline becomes Tuesday at 4 AM.

In **Admin → System Settings → SLA calendar**, enter holidays and university
closures as YYYY-MM-DD dates, one per line, and save. Maintain dates for each
year; the app does not automatically fetch a national holiday list. Weekend
holidays are excluded once. A deadline exactly at the start of an excluded day
moves to midnight on the next eligible day.

Every new complaint stores its calendar, SLA hour allowances and warning
threshold. Warnings, elapsed durations and dashboard averages use this snapshot.
Changing holidays or SLA rules does not silently change existing complaints.
Existing complaints without a snapshot retain their original calendar-hour
deadlines and duration calculations; reports identify the calendar used.

To update existing unresolved complaints, save the calendar, then use **Preview
new deadlines** under System Settings. Review the sample and count, then apply.
The preview uses current active SLA rules and the original clock start. Stale
previews are rejected, and complaints changed during application are skipped.
Resolved, closed, withdrawn and archived complaints are excluded. Application
resets warning flags and records recalculation in the timeline and audit log;
it does not reverse assignment or escalation history. If a revised deadline is
already overdue, the regular SLA check handles escalation.
