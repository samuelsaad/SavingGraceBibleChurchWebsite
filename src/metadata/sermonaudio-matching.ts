import {normalizeSermonAudio} from '../domain/media';
import {assessSermonTitle} from '../domain/sermon-title';
import {sermonAudioIdPattern} from '../domain/sermonaudio';
export const officialChurchBroadcasterId = 'savinggrace';
const decode=(v:string)=>v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const text=(v:string)=>decode(v.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const attr=(tag:string,key:string)=>decode(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(["\'])(.*?)\\1','i').exec(tag)?.[2]??'');
/** Reads metadata only; never executes imported markup or retains transcript,
 * player configuration, script, cookies or media-download URLs. */
export function officialPlayerMetadata(html:string,id:string){
 if(!sermonAudioIdPattern.test(id))throw Error('sermonaudio_identity_invalid');
 const tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]);
 const meta=(key:string)=>attr(tags.find(t=>(attr(t,'property')||attr(t,'name'))===key)??'','content');
 const anchors=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
 const broadcaster=anchors.find(a=>attr(a[1]!,'class').split(/\s+/).includes('broadcaster'));
 const speaker=anchors.find(a=>attr(a[1]!,'class').split(/\s+/).includes('speaker'));
 const href=broadcaster?attr(broadcaster[1]!,'href'):'';
 let broadcasterId:string|null=null;
 try{const u=new URL(href,'https://www.sermonaudio.com');if(['www.sermonaudio.com','sermonaudio.com'].includes(u.hostname)&&u.protocol==='https:')broadcasterId=/^\/(?:broadcasters|solo)\/([^/?#]+)/.exec(u.pathname)?.[1]??null;}catch{}
 // The official audio embed leaves its OG stream URLs empty. Its own audio
 // initializer and positive duration are metadata evidence, not an audio read.
 const initializer=new RegExp('var\\s+init'+id+'audio\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,500}?new\\s+saPlayer\\s*\\(\\{[\\s\\S]{0,500}?duration:\\s*(\\d+)').exec(html);
 const durationSeconds=initializer?Number(initializer[1]):null;
 return {id,title:meta('og:title').replace(/ \| SermonAudio$/u,''),speaker:speaker?text(speaker[2]!):'',broadcasterId,
   hasAudio:Boolean(meta('og:audio')||meta('og:audio:url')||meta('og:audio:secure_url')||(durationSeconds&&durationSeconds>0)),durationSeconds};
}
export type RecordingMetadata={id:string;title:string;speaker:string;broadcasterId:string|null;hasAudio:boolean;serviceDate?:string|null;uploadDate?:string|null};
export type MappingOutcome='verified'|'unmatched'|'ambiguous'|'conflicting'|'unavailable';
export interface SourceMediaEvidence {sourceWordPressId:number;title:string;serviceDate:string;speakerNames:string[];passageTexts:string[];audioValues:string[];}
export interface TargetMediaIdentity {sourceWordPressId:number;title:string;serviceDate:string;speaker:string|null;}
const key=(v:string)=>v.normalize('NFKC').toLocaleLowerCase('en-AU').replace(/[‘’]/gu,"'").replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** Strong identity first. An absent explicit link is not repaired by fuzzy
 * title similarity, upload dates, typical speakers or passage similarity. */
export function matchSourceRecording(target:TargetMediaIdentity,source:SourceMediaEvidence|null,recordings:readonly RecordingMetadata[]):{outcome:MappingOutcome;reason:string;id?:string;corroboration?:{title:boolean;speaker:boolean;serviceDate:boolean}}{
 if(!source)return{outcome:'unavailable',reason:'source_identity_unavailable'};
 if(target.sourceWordPressId!==source.sourceWordPressId)return{outcome:'conflicting',reason:'source_identity_mismatch'};
 const links=source.audioValues.map(v=>normalizeSermonAudio(v,source.title)).filter(v=>v!==null);
 const ids=[...new Set(links.map(v=>v.media.externalId!))];
 if(ids.length>1)return{outcome:'ambiguous',reason:'multiple_explicit_recordings'};
 if(!ids.length)return{outcome:'unmatched',reason:'no_verified_explicit_recording'};
 const found=recordings.filter(r=>r.id===ids[0]);
 if(found.length>1)return{outcome:'ambiguous',reason:'conflicting_recording_metadata'};
 const r=found[0];if(!r||!r.hasAudio||!r.title||!r.broadcasterId)return{outcome:'unavailable',reason:'recording_metadata_unavailable'};
 if(r.broadcasterId!==officialChurchBroadcasterId)return{outcome:'conflicting',reason:'broadcaster_mismatch'};
 const sourceTitle=assessSermonTitle(source.title,{passageTexts:source.passageTexts,sourceTitles:[source.title]}).title;
 const corroboration={title:key(r.title)===key(target.title)||key(r.title)===key(sourceTitle),speaker:[target.speaker??'',...source.speakerNames].some(v=>!!v&&key(v)===key(r.speaker)),serviceDate:target.serviceDate===source.serviceDate&&(!r.serviceDate||r.serviceDate===source.serviceDate)};
 if(!corroboration.serviceDate||(!corroboration.title&&!corroboration.speaker))return{outcome:'conflicting',reason:'corroborating_metadata_conflict',corroboration};
 return{outcome:'verified',reason:'explicit_source_identity_and_official_broadcaster',id:r.id,corroboration};
}
