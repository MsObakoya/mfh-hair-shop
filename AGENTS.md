# MFH Hair project instructions

## Project context

This is a beginner-built HNG 15 Lesson 2 shop project for **MFH Hair**, a ponytail, wig, and hair extension business. The product requirements and phased plan are in [`PRD.md`](PRD.md). Keep the required integration flow real: Google authentication, Supabase persistence, customer-owned order history, and Mailgun confirmation email.

## Working style

- Explain decisions and steps in plain language suitable for a beginner. Prefer small, understandable changes over clever abstractions.
- Before making implementation choices, inspect the existing app and preserve its conventions where reasonable.
- Keep the README and this context file current when project setup or implementation materially changes.
- Do not invent MFH Hair’s real prices, policies, contact details, or product claims. Use clearly marked sample content until the owner provides them.
- Treat the PRD as the product source of truth; update it when requirements change.

## Security and integrations

- Never commit secrets. Keep local environment files ignored and provide a placeholder-only `.env.example` when needed.
- Never expose Supabase service-role keys or Mailgun credentials to browser code.
- Enforce customer ownership in server logic and Supabase Row Level Security; UI filtering alone is not security.
- Validate checkout input and calculate prices from trusted product data on the server, not from client-submitted totals.
- Save the order before sending its confirmation email. Report email delivery problems clearly without losing the saved order.
- Use test mode for any optional payment integration.

## Completion notes

At the end of a work session, summarize what changed, what was verified, what still needs the owner’s external account setup, and the next concrete step. Do not claim an integration works until it has been configured and exercised.
