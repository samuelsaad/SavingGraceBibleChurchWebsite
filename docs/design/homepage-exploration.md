# Homepage exploration

## Mechanism and use scene

An actual local congregation welcomes a first-time visitor and gives returning readers a way into Scripture-grounded teaching. The scene is a person on a phone deciding where to go this Sunday; cultural home is the church gathering and its invitations, teaching and fellowship. The first screen must prove who, where, when and what to do, using the actual people rather than a stock landscape.

The category rut is a huge image with a vague welcome and repeated ministry cards; the predictable opposite is an austere academic publication with little sense of people. Neither defines the proposed work.

## Seven grounded visual systems, ordered by resonance

1. **The open church door** — an asymmetrical welcoming photograph beside a legible invitation and practical Sunday details; the threshold leads into congregation and teaching.
2. **A Sunday order of service** — a compact typographic masthead, congregation panorama and an ordered editorial programme with clear reading levels; ceremony without clutter.
3. **The local community noticeboard** — strong modular headings, candid photographs and an immediately useful time/place strip; events behave like an agenda, not promotional cards.
4. **A parish photo essay** — edge-to-edge documentary images interleaved with restrained long-form copy; people supply the identity, typography guides the visit.
5. **The church library catalogue** — a quiet, structured index of belief, Bible books and recent sermons with an attached visitor invitation; strong for repeat readers, weaker first-visit warmth.
6. **A streetside service sign** — bold condensed lettering, two explicit service times and an uncomplicated directional path; very clear but risks looking too institutional.
7. **A family invitation letter** — a large readable greeting, portrait image and personal-scale information in a warm print composition; welcoming but risks diminishing the teaching library.

The set spans spatial welcome, editorial/print, civic wayfinding, documentary photography and library organisation. This is a fresh design exploration, not an endorsement of incumbent presentation.

## Assignment and challenger evaluation

Seed `4dd827e9` assigned the streetside service sign (candidate 6). Six catalog challengers were fused with church facts before judgment on audience identification and product clarity:

| Challenger | Product translation | Verdict and retained discipline |
|---|---|---|
| Annotated uniform code | Callouts linking the gathering to church information | Declined on both axes: implies rules/affiliation before welcome. Retain a disciplined relation between navigation and its destination. |
| Labanotation | A symmetrical Sunday programme | Declined on both: unfamiliar notation and reversed time obstruct the visit. Retain exact alignment and visible morning/evening distinction. |
| Gravity garden | Exploratory groups of church information | Declined on both: invented decorative world competes with actual people. Retain one clear dominant mobile destination, not scattered actions. |
| Raku vessel | Asymmetric dark/light material-led sections | Declined on both: craft material has no church evidence. Retain commitment to one colour system and purposeful asymmetry. |
| Depot destination blind | Strong readable service labels | Competitive in clarity, weaker in audience identification: rigid mechanical states are wrong for a welcome. Retain generous readable type and truthful state labels. |
| Teletext | A highly indexed teaching and information service | Declined on both: unfamiliar numbered navigation burdens newcomers. Retain clear information grouping and direct destinations. |

No foreign imagery, motifs, claims or interactions were copied. No catalog-world visual was adopted.

## Rendered concepts and selection

All three working concepts live in `scripts/design-concepts.ts` and use only tracked public church copy and existing photographs. No database access. Desktop 1440px and mobile 390px renders showed no overflow or broken church images.

- **A — Sunday invitation:** horizontal navigation, bold left-aligned church identity, immediate visit details, edge-to-edge congregation image and practical service information. Strongest in clarity and the sense of the actual gathered church.
- **B — Open door:** warmer serif editorial copy beside a portrait greeting, narrower right-side navigation and a quieter invitation. Most personal image, but too much text delays time/place on mobile.
- **C — Order of service:** centred logo/navigation, formal serif title and inset panorama with ruled programme underneath. Calm for readers but the first-visit action appears too late.

Selected A without a user selection round, following Samuel's explicit delegation. The comparison used temporary fallback typography because the external font request was rejected; the completed system uses licensed offline self-hosted Bitstream Vera. No external request was retried or replaced with a different provider. Other concepts remain reproducible public-copy prototypes, not production routes.

The chosen direction keeps the actual visitor route prominent, uses the welcome-door image later at human scale, and retains scripture/book colour as meaningful library metadata. The homepage does not become a grid of ministry cards. Questions skipped: the user explicitly delegated aesthetic selection and requested implementation of findings without routine pauses.
