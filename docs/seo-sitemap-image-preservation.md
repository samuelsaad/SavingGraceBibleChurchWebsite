# Original image sitemap preservation — 20 October 2026

The original preferred-host XML contains 54 page/image associations on 37
verified original page identities. The replacement previously omitted every
image hint. The [association ledger](seo-sitemap-image-associations-20261020.csv)
binds each association to its exact page, original XML response and verified
owned image file. No source XML or image body is committed.

Forty-eight associations use an already retained exact original file. Two old
staging thumbnails use the same attachment's verified original, demonstrated by
the original page's WordPress attachment class and complete responsive srcset.
The remaining four original resized-file requests were unavailable after bounded
retrieval. Each requested dimension appears in the same original attachment's
srcset and identifies the verified original file. The candidate preserves those
image associations and creates exact direct migration redirects; this is not a
claim that the original server returned a redirect or that resized bytes were
retrieved. No resize, re-encoding, guessed portrait or unrelated redirect is used.

The existing versioned source projection stores provenance; published CMS
ownership, explicit noindex, source replacement, revisions and withdrawals govern
sitemap inclusion. Image hashes must match active verified files. Redirects have
independent immutable import/audit evidence and survive a parent withdrawal.

The XML follows [Google's image sitemap format](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
with image:image and image:loc in the image namespace. The acceptance crawler
checks image resources separately from canonical indexable HTML sitemap entries.
Image hints do not guarantee indexing or unchanged rankings.

Rerun anonymous checks with `npx vitest run tests/seo-sitemap-images.test.ts
tests/seo-source-resource-redirects.test.ts`, `npm run test:postgres` on the guarded
disposable target, and `python -m unittest discover -s tests -p '*test.py'`.
Actual full-mapping HTTP, scoped import/recovery and deployed release evidence
are recorded in the main acceptance report; unit checks alone do not establish
complete migration acceptance.
