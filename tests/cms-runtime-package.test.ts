import {execFileSync} from 'node:child_process';
import {describe,expect,it} from 'vitest';
import {gitArchiveCommit,permittedCmsRuntimePath} from '../deployment/package-cms-runtime.mjs';

describe('offline CMS runtime archive',()=>{
 it('reads the Git commit from only the header even when the archive is large',()=>{
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const archive=execFileSync('git',['archive','--format=tar',commit,'--','package.json']);
  expect(gitArchiveCommit(Buffer.concat([archive,Buffer.alloc(8*1024*1024)]))).toBe(commit);
  expect(()=>gitArchiveCommit(Buffer.alloc(512))).toThrow('cms_runtime_archive_header');
 });
 it('admits only bundled runtime code, the exact admin artifact paths and SQL migrations',()=>{
  for(const path of ['app/server.cjs','app/cms-maintenance.cjs','app/source-public-sync.cjs','app/admin/index.html','app/admin/_astro/cms-admin.js','app/admin/_astro/cms-admin.css','app/db/migrations/0027_modular_cms.sql'])expect(permittedCmsRuntimePath(path)).toBe(true);
  for(const path of ['app/private/data.json','app/node_modules/native.node','app/server.cjs.map','app/other.js','app/admin/_astro/other.js','app/db/migrations/notes.md','app/../server.cjs','app/.env','app/secret.key'])expect(permittedCmsRuntimePath(path)).toBe(false);
 });
});
