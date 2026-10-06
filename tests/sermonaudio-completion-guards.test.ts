import {describe,it,expect} from 'vitest';
import {encodedUnicodeSlug,canonicalStoredSermonSlug,sermonSlugPathSegment,validateLegacySlug} from '../src/domain/slug';
import {d175AcceptanceSql,assertD175SourceMembership} from '../src/domain/sermonaudio-completion';
describe('D-175 compatibility and permanent guards',()=>{
 it('retains exact legacy Arabic URL bytes without double encoding',()=>{const encoded=encodeURIComponent('مقالة-تجريبية').toLowerCase();expect(encodedUnicodeSlug(encoded)).toBe(encoded);expect(validateLegacySlug(encoded)).toBe(encoded);expect(canonicalStoredSermonSlug('مقالة-تجريبية')).toBe(encoded);expect(sermonSlugPathSegment(encoded)).toBe(encoded);});
 it.each(['%2fsecret','%2e%2e','%252f','a%00b','%d8','a/b','UPPERCASE','%61'])('rejects unsafe or noncanonical slug %s',s=>expect(validateLegacySlug(s)).toBeNull());
 it('does not change ordinary English slugs',()=>{expect(validateLegacySlug('synthetic-sermon')).toBe('synthetic-sermon');expect(sermonSlugPathSegment('synthetic-sermon')).toBe('synthetic-sermon');});
 it('rejects another membership and duplicate sources',()=>{expect(()=>assertD175SourceMembership([1])).toThrow();expect(()=>assertD175SourceMembership(Array(119).fill(1))).toThrow();});
 it('retains draft, publication timestamp, current version, full dependency and system audit gates',()=>{const sql=d175AcceptanceSql();for(const fragment of ["status='draft'","published_at IS NULL","deleted_at IS NULL","row_version::text","dependencySha256","actor_role='system'","humanApprovalClaimed","everyOrderedQuestionAnswerRead","sourceMembershipSha256","broadcaster"]){expect(sql).toContain(fragment);}expect(()=>d175AcceptanceSql('s;drop')).toThrow();});
});
