# Incident Response & Breach Notification Runbook

This is the operational runbook for security/availability incidents on
PaySwift. It covers severity classification, the response process, on-call,
and — critically for a Kenyan payments product handling personal data — the
data-breach notification obligations under the Kenya Data Protection Act,
2019.

This is a process document, not legal advice. A confirmed personal-data
breach must involve counsel before any external notification wording is
finalized.

## Severity scale

| Sev | Definition | Examples | Response |
|-----|-----------|----------|----------|
| **Sev1** | Money movement broken, or a confirmed data breach | Payments failing platform-wide; payouts double-sent; unauthorized access to merchant data or credentials | Immediate, all-hands; page on-call now |
| **Sev2** | Major degradation, no confirmed data loss | Dashboard down; webhooks not delivering; one Daraja command type failing | Respond within the hour |
| **Sev3** | Minor / contained | Single non-critical endpoint slow; cosmetic bug; a single merchant's misconfiguration | Next business day |

The asymmetric-trust rule (guardrail #4) still holds during incidents: never
mass-flip transactions to failed to "clean up" — surface and reconcile.

## On-call

Even at current scale, on-call is a named rotation (a rotation of one is
still a rotation — write down who and when, don't leave it implicit). The
on-call person owns: acknowledging alerts (Sentry, the `/status` health
checks), classifying severity, and either resolving or escalating.

## Response process (all severities)

1. **Acknowledge & classify.** Assign a Sev level. Open an incident channel /
   doc.
2. **Contain.** Stop the bleeding before root-causing. For a suspected
   credential compromise: rotate the affected secret immediately
   (`ENCRYPTION_KEY` rotation runbook in AGENTS.md; `app_runtime` password via
   `scripts/create-app-runtime-role.ts`; revoke API keys via the dashboard).
3. **Assess data impact.** Determine whether personal data (phone numbers,
   transaction records, KYC documents) was accessed, altered, or lost. This
   determination drives the DPA obligations below.
4. **Recover.** For data loss, follow [`restore-drill.md`](./restore-drill.md).
5. **Communicate.** Update `/status` for availability incidents. For a
   confirmed breach, follow the notification section below.
6. **Postmortem.** Within a week of resolution, write a blameless postmortem
   (template below).

## Data-breach notification (Kenya DPA 2019)

If step 3 confirms a personal-data breach:

- **Notify the ODPC (Office of the Data Protection Commissioner) without undue
  delay, and within 72 hours** of becoming aware, where the breach is likely
  to result in risk to data subjects. Record the time of awareness precisely —
  the 72-hour clock starts there.
- **Notify affected data subjects** (merchants, and where their customers'
  data is involved, coordinate with the merchant) without undue delay when the
  breach is likely to result in high risk to their rights and freedoms.
- **Content of a notification** (draft with counsel): the nature of the breach,
  categories and approximate number of data subjects and records affected, the
  likely consequences, the measures taken/proposed to address it and mitigate
  harm, and a contact point.
- **Document every breach** — even those not meeting the notification
  threshold — with facts, effects, and remedial action, so the record can be
  produced to the ODPC on request.

Engage Kenyan counsel as part of Sev1 handling for any confirmed breach; do
not send an external breach notification without that review.

## Postmortem template

```
# Postmortem: <short title> (<date>)

Severity: Sev<n>
Duration: <detection time> → <resolution time>
Author: <name>

## Summary
<2–3 sentences: what happened, impact, resolution.>

## Impact
<Who/what was affected. Data impact assessment result. Any DPA notification made.>

## Timeline (UTC)
- HH:MM — <event>
- ...

## Root cause
<The actual underlying cause, not just the trigger.>

## What went well / what didn't

## Action items
- [ ] <owner> — <preventive/detective fix> — <due date>
```
