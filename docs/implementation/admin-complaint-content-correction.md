# Administrator Complaint Content Correction

Administrators can correct a complaint title and description from its detail
page, including after staff have picked it up or resolved it. Archived complaints
must be restored before they can be corrected. The endpoint does not change
status, assignment, resolution data, or other complaint fields.

Every correction requires an explanation and atomically records the previous
and replacement title/description in the audit log, along with an immutable
complaint timeline event. Only users with the `administrator` role can call the
correction endpoint; scoped administrator roles and staff cannot.
