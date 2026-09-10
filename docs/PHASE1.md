# Phase 1 scope and workbook mapping

Source: `Dealer_App_Role_Settings_Dashboard_Matrix.xlsx`, `Role Matrix`. Phase values are inherited through blank cells: Phase 1 runs from **Appointment capacity** through **Tier rules**. Phase 2 starts at **Service recommendation / package**. The customer-journey workbook supplies context; it does not override this phase boundary.

## Implemented and reviewable now

| Matrix area          | Implementation                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Appointments         | Customer requests, Manager status transitions, rescheduling/cancellation, branch capacity and closures; Admin guardrails                 |
| Manager alerts       | Open/overdue recovery queue with customer, owner, deadline and case drill-down                                                           |
| CRM / retention      | Explicit last-visit segments and filtered worklist; consented campaign audience; new customers are not counted as lapsed                 |
| Feedback / recovery  | Completed-visit feedback, low-rating case creation, timed first-response deadline, contact history, reopen/resolve with required outcome |
| Role / branch access | Customer, Manager, Administrator; protected membership table, branch/customer RLS and command checks                                     |
| Customer / vehicle   | Stable IDs, profile/contact preferences, vehicle requests and manual verification                                                        |
| Campaigns / vouchers | Campaign drafts, budget ceiling and approval; configured reward values. No outbound campaign delivery                                    |
| Loyalty governance   | Signed-points ledger, adjustment requests, independent above-threshold approval, atomic nonnegative posting and duplicate prevention     |
| Admin rules          | Appointment, segmentation, recovery, earning/redemption/tier/expiry and campaign configuration                                           |
| Governance           | Timestamped consent, access/suspension changes, server audit with before/after snapshots, missing-contact/duplicate-registration counts  |
| Vehicle health       | Customer reads supplied/imported inspection records; checklist version is retained                                                       |

## Intentionally held or remaining

- **Service Advisor interface and actions:** held by the user's September 9 correction. Existing assignment references do not grant access.
- Full retention cohorts, repeat/reactivation rates, attribution, historical KPI trends and revenue dashboards need validated imported historical data. No invented metrics are shown.
- Workflow templates/status mappings, inspection checklist editing, scheduled segment/tier/expiry jobs and advanced role permission editing are not implemented. Roles and valid appointment transitions are explicitly defined in code/SQL.
- Automated SMS/email/push delivery, win-back sending, campaign ROI, frequency caps and suppression execution need a messaging provider and event worker. Approved campaigns are not sent.
- Automatic points earning/redemption against paid transactions belongs to the Phase 2 transaction connection. Phase 1 stores configuration and authorised corrections, but does not mark transactions paid or invent qualifying events.
- Staff invitations, multi-branch switching, ownership transfer history, secure evidence attachments, duplicate merges and DMS sync remain setup/integration work.
- The original quotation/payment demo is preserved outside this deliverable in the working archive; it is not exposed as a Phase 1 production feature.

## UI direction

The customer page follows the new supplied Stitch reference: vehicle photo, single priority action, three quick actions, loyalty summary, promotion, appointment and health report. Responsive staff pages use summaries, tables, queues and configuration forms. The supplied dealer name/image are demonstration content; production branding and policies must be confirmed.
