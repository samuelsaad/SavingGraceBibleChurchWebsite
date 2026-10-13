# D-182 measurement implementation and activation gate

The captured live homepage has one GA4 configuration call. Its identifier is retained
privately, bound to source response SHA-256
`f9c47c81b8d2e44ca0f474b560b72ab8e06bd5fa4ca3f76eb80e7be27f92c43a`.
Public tagging does not prove the account property, web-stream ownership, consent
settings, enhanced-measurement settings or a church-owned test stream.

`src/seo/measurement.ts` supplies production-only integration through the existing
SEO HTTP adapter. Activation requires verified property/stream identifiers, a
configuration evidence hash, disabled advertising/enhanced measurement and the
existing consent grant. The staging runtime supplies no measurement configuration.
This task has not enabled production tracking or modified WordPress.

The tag loads only from `https://www.googletagmanager.com/gtag/js` with the verified
measurement identifier. CSP permits collection only at
`https://www.google-analytics.com/g/collect` and
`https://region1.google-analytics.com/g/collect`. No advertising destinations,
Google Signals, GTM container, remarketing or custom interaction events are added.

Application-supplied fields are sanitized `page_location` (origin/path only),
public `page_title`, `send_to`, and the explicit `page_view` event name. Official
GA4 supplies standard pseudonymous client/session and session/engagement values
and receives normal IP/browser network metadata. Automatic pageviews are disabled
and one explicit pageview is sent per document. Advertising consent is denied,
Google Signals and advertising personalization are disabled. Query/fragment,
search/form/contact data, administrator identities, drafts and enrichment prose
are excluded. Search, noindex, private, local and staging documents do not emit.

Referrer is currently suppressed to prevent unreviewed URL leakage. This affects
acquisition attribution and must be reconciled with the verified church stream's
existing configuration before continuity is accepted. Do not silently describe
that reduced payload as equivalent organic-channel reporting.

Unit/stub verification uses synthetic configuration and sends no Google requests.
A live request requires a verified church-owned test stream; none is currently
available. Missing account/property/stream/consent and test-stream evidence keeps
activation and live continuity verification outstanding. Production activation
requires the separate cutover authorization.

References: [GA4 configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config),
[explicit pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views).
