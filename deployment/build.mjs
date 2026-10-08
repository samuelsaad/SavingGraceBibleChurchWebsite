import { build } from "esbuild";
import {buildCmsAdmin} from "./build-cms-admin.mjs";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist-staging", { recursive: true });
await buildCmsAdmin();
for (const [name, entry] of Object.entries({
  server: "src/staging/server.ts",
  "cms-maintenance": "src/cms/staging-maintenance.ts",
  database: "src/staging/database-cli.ts",
  "draft-preview": "src/staging/draft-preview-server.ts",
  "sermonaudio-sync": "src/staging/sermonaudio-sync.ts",
  "completed-sync": "src/staging/completed-sync.ts",
  "sermonaudio-completion-sync": "src/staging/sermonaudio-completion-sync.ts",
  "sermon-durations-sync": "deployment/sermon-durations-sync.ts",
  "related-themes-sync": "src/staging/related-themes-sync.ts",
  "d160-sync": "deployment/d160-sync.ts",
  "d161-sync": "deployment/d161-sync.ts",
  "d167-protected-sync": "deployment/d167-protected-sync.ts"
})) {
  const result = await build({ entryPoints: [entry], outfile: `dist-staging/${name}.cjs`, bundle: true,
    // The minimal archive intentionally excludes the Astro workspace config.
    // Keep strict-mode semantics identical in local and isolated image builds.
    tsconfigRaw: { compilerOptions: { alwaysStrict: true } },
    platform: "node", target: "node24", format: "cjs", external: ["pg-native"], metafile: true,
    sourcemap: false, legalComments: "none", logLevel: "silent" });
  if (Object.keys(result.metafile.inputs).some((path) => /(?:local-test-identity|local-dashboard-static|googleapis|transformers)/i.test(path)||(!path.includes("/node_modules/")&&/(?:private\/|development-data\/)/i.test(path)))) {
    throw new Error("prohibited_staging_bundle_input");
  }
  await writeFile(`dist-staging/${name}.inputs.json`, JSON.stringify(Object.keys(result.metafile.inputs).sort()));
}
