# Self-hosted Bitstream Vera Sans

These are the original, unmodified Bitstream Vera Sans Release 1.10 font files
bundled with ReportLab 4.4.9 in the installed Codex workspace runtime
26.909.12148. They were obtained entirely offline from the installed package's
`reportlab/fonts/Vera.ttf` and `reportlab/fonts/VeraBd.ttf` on 28 September 2026.
There was no network retrieval, glyph modification, subsetting or conversion.
The original TrueType format preserves the complete font and its embedded
copyright, trademark and license metadata.
The license path has Git text conversion disabled so checkouts preserve its
original bytes, including its original line endings and trailing whitespace.

Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. Bitstream Vera is a
trademark of Bitstream, Inc. The full accompanying copyright, permission,
conditions and FAQ are retained unchanged in `bitstream-vera-license.txt`.
This license permits bundling and redistribution with software, requires the
copyright and permission notices, and forbids selling the fonts by themselves.

| Local file and served URL under `/brand/fonts/` | Weight | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `bitstream-vera-sans-regular.ttf` | 400 | 65,932 | `c4c45690b345435b2cba52ecabe275f05e49b389b39fe68ad03afbb551288d3d` |
| `bitstream-vera-sans-bold.ttf` | 700 | 58,716 | `cc037385e4d55bfde89b13e03091ee93bf40c0c52ddd391ff031ab276f13b8e9` |
| `bitstream-vera-license.txt` | — | 5,954 | `3361d054759a2fc686a2c058be82deaf9c2e6fe549be9004d7935a6c1736315d` |

Use family `"Bitstream Vera Sans"`, style `normal`, `format("truetype")` and
`font-display: swap`. No serif or italic face is included. The two font files
total 124,648 bytes before HTTP compression. The source files and embedded
representations are byte-identical, including the complete license.

`../fonts.ts` exposes a fixed allowlist. The shared asset handler and the static
Astro endpoint both use `../font-bytes.ts`; the license is emitted alongside the
fonts in every runtime and static build. No font directory is exposed. Font
requests remain same-origin, under `font-src 'self'`, with no runtime provider
request, remote stylesheet or `unsafe-inline` permission.

Regenerate the embedded module offline from this repository root:

```text
node src/frontend/assets/fonts/embed.mjs
```

The regeneration script reads only the three fixed filenames above. It does not
download, alter or discover fonts and adds no package dependency.
