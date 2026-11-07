# Profile management

The shared profile page is available to students, staff, and administrators.
Users can edit their own first and last names and change their password after
confirming their current password. A password change invalidates existing
sessions, so the user must sign in again.

Users can request a login-email change after confirming their current password.
The address remains unchanged until the user follows the single-use link sent
to the new address. Links expire after 30 minutes and are stored as hashes.
After confirmation, existing sessions are invalidated and a notice is sent to
the old address. In local development, email delivery follows the configured
`RESEND_DEV_TEST_EMAIL` behavior described in the environment setup. The
email-change route is public because possession of its
high-entropy, one-time token authorizes the confirmation.

Role, student/employee ID, and office/college assignment are displayed as
account information but remain administrator-managed. They are intentionally
not accepted by the self-service profile API.

The design follows OWASP guidance to reauthenticate for email changes, verify
the new address, and notify the current address:
[Email Validation and Verification Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html#email-change-workflows).
