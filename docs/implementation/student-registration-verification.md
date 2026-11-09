# Student registration and email verification

Public registration creates student accounts only. The normalized email must
end in `@parsu.edu.ph`, and the selected college must be active. A valid
ParSU-domain mailbox is evidence of mailbox control, not proof that the
registrant is currently enrolled; connect an authoritative student roster if
that stronger eligibility check is required. The exact local-part naming
convention is not enforced because it was not confirmed.

New self-registered and administrator-created student accounts remain
unverified until they enter a one-time six-digit code delivered by Resend. The
code is generated securely, stored only as
an HMAC using `AUTH_SECRET`, expires after 10 minutes, and is invalidated after
five incorrect attempts, successful use, or a later resend. Resending has a
60-second cooldown and a limit of three requests per hour. Verification is
limited per email and source IP; Redis failures reject these operations rather
than silently disabling their limits.

Existing accounts retain access through the `emailVerified` schema default.
New public registrations explicitly set it to `false`; successful code
verification changes it to `true`. A student cannot sign in while this flag is
false. Student email changes remain restricted to `@parsu.edu.ph` and use the
existing confirmation-link flow.

Configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a sender permitted by the
provider), and `RESEND_DEV_TEST_EMAIL`. To route local development mail to one
inbox, set `DEV_EMAIL_REDIRECT_ENABLED=true`; it uses
`RESEND_DEV_TEST_EMAIL` as the recipient, and the subject identifies the
intended recipient. The switch only takes effect when
`NODE_ENV=development`; production and preview deployments always send to the
actual recipient. The development test-email endpoint is POST-only, requires
`DEV_SEED_SECRET`, and sends a non-account code to the configured recipient.

Registration is protected by the shared Upstash Redis rate limiter. Configure
a reachable Redis instance before enabling the flow; signup, code verification,
and resend fail closed if the rate limiter is unavailable. Duplicate account
identifiers, password hashes, role assignment, and active-college validation
are enforced server-side. The registration API and legacy server-action form
have been consolidated so there is no alternate path that can create a
verified student without email confirmation.
