import {describe,it,expect} from 'vitest';
import {valuableOriginalTaxonomyQuery} from '../src/seo/source-query-indexing';
const content=[{tag:'a',href:'https://www.savinggrace.org.au/sermons/anonymous-original/',text:'Anonymous result'}];
describe('valuable observed original taxonomy archives',()=>{
 it('recognizes a real single-term original archive despite a broken inherited base canonical',()=>{expect(valuableOriginalTaxonomyQuery('/sermons/?sermon_book=genesis',content)).toBe(true);expect(valuableOriginalTaxonomyQuery('/sermons/page/12/?sermon_speaker=anonymous',content)).toBe(true);});
 it('does not create eligibility for empty, search, campaign, multiple-filter or calendar URL spaces',()=>{for(const path of ['/sermons/?s=example','/sermons/?sermon_book=genesis&utm_source=example','/sermons/?sermon_book=genesis&sermon_speaker=anonymous','/events/?eventDisplay=month'])expect(valuableOriginalTaxonomyQuery(path,content)).toBe(false);expect(valuableOriginalTaxonomyQuery('/sermons/?sermon_book=unknown',[])).toBe(false);});
});
