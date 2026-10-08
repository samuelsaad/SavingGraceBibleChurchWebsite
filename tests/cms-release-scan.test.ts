import {describe,it,expect} from 'vitest';
import {cmsSecretClasses,excludedCmsPath,fragmentHashes} from '../scripts/scan-cms-release';
describe('CMS outgoing scan contracts',()=>{
 it('detects excluded file classes without mistaking source code paths for raw evidence',()=>{
  for(const path of ['private/recovery.json','data/captions.vtt','evidence/words.srt','copy.private.json','.aws/credentials','release/database.dump','models/model.onnx','advanced-sermons-pro/plugin.php','cookies.json','client_secret.json','.env.local'])expect(excludedCmsPath(path)).toBe(true);
  for(const path of ['src/cms/session.ts','src/cms/postgres-repository.ts','db/migrations/0027_modular_cms.sql','docs/cms-content-inventory.md','dist-staging/cms-maintenance.inputs.json'])expect(excludedCmsPath(path)).toBe(false);
 });
 it('detects credential, session, provider, caption and proprietary source classes using synthetic pieces',()=>{
  expect(cmsSecretClasses('ghp_'+'A'.repeat(36))).toContain('provider_token');
  expect(cmsSecretClasses('postgresql:'+'//name:synthetic@example.test/db')).toContain('database_credentials');
  expect(cmsSecretClasses('sgbc_cms_admin='+'A'.repeat(43))).toContain('session_material');
  expect(cmsSecretClasses(JSON.stringify({['refresh_'+'token']:'synthetic-token-value'}))).toContain('credential_export');
  expect(cmsSecretClasses('WEB'+'VTT\n\n00:00:01.000 --> 00:00:02.000')).toContain('caption_export');
  expect(cmsSecretClasses('Plugin '+'Name: Advanced '+'Sermons')).toContain('proprietary_source');
  expect(cmsSecretClasses('const password = await readCmsSecret(path);')).toEqual([]);
 });
 it('matches normalized body windows across JSON/HTML formatting and rejects unrelated wording',()=>{
  const text='One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen.';
  const hashes=fragmentHashes(text);expect(hashes.length).toBe(3);
  expect(fragmentHashes('<p>One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen</p>')).toContain(hashes[0]);
  expect(fragmentHashes('One two three four five six seven eight\\nnine ten eleven twelve thirteen fourteen fifteen sixteen')).toContain(hashes[0]);
  expect(fragmentHashes('Entirely unrelated short anonymous words.')).toEqual([]);
 });
});
