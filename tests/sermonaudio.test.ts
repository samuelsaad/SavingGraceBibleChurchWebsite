import {describe,it,expect} from 'vitest';
import {canonicalSermonAudioUrl,sermonAudioIdFromUrl,sermonAudioPlayerUrl,resolveSermonAudioIdentity} from '../src/domain/sermonaudio';
import {normalizeSermonAudio} from '../src/domain/media';
import {matchSourceRecording,officialPlayerMetadata} from '../src/metadata/sermonaudio-matching';
import {sermonMedia,mediaSection} from '../src/frontend/components/media';
import {audioLoaderSource} from '../src/frontend/scripts/audio-loader';
import {contentSecurityPolicy} from '../src/server/http/frontend-response';
import type {SermonDetail} from '../src/domain/sermon';
const id='101012345678';
const target={sourceWordPressId:123,title:'Example teaching',serviceDate:'2024-01-07',speaker:'Example Speaker'};
const source={...target,speakerNames:['Example Speaker'],passageTexts:[],audioValues:[`<iframe src="https://embed.sermonaudio.com/player/a/${id}/"></iframe>`]};
const recording={id,title:target.title,speaker:target.speaker,broadcasterId:'savinggrace',hasAudio:true,serviceDate:target.serviceDate};
describe('controlled single-sermon SermonAudio',()=>{
 it('recognizes only validated single-record paths and builds canonical links',()=>{
 expect(sermonAudioPlayerUrl(id)).toBe(`https://embed.sermonaudio.com/player/a/${id}/`);
 expect(sermonAudioIdFromUrl(canonicalSermonAudioUrl(id)!)).toBe(id);
 expect(sermonAudioIdFromUrl(`https://www.sermonaudio.com/sermoninfo.asp?SID=${id}`)).toBe(id);
 for(const url of ['https://embed.sermonaudio.com/browser/broadcaster/savinggrace/','https://evil.sermonaudio.com/sermons/'+id,'https://www.sermonaudio.com/sermons/abc','http://www.sermonaudio.com/sermons/'+id,`https://user:secret@www.sermonaudio.com/sermons/${id}`,`https://www.sermonaudio.com:8080/sermons/${id}`,`https://www.sermonaudio.com/sermons/${id}?SID=999`])expect(sermonAudioIdFromUrl(url)).toBeNull();
 expect(resolveSermonAudioIdentity({externalId:id,canonicalUrl:'https://www.sermonaudio.com/sermons/999'})).toBeNull();
 expect(normalizeSermonAudio(source.audioValues[0]!,target.title)?.media.canonicalUrl).toBe(canonicalSermonAudioUrl(id));
 expect(normalizeSermonAudio('<script>bad()</script>'+source.audioValues[0],target.title)).toBeNull();
 expect(normalizeSermonAudio(source.audioValues[0]!+source.audioValues[0],target.title)).toBeNull();
 expect(normalizeSermonAudio(`<iframe data-src="https://embed.sermonaudio.com/player/a/${id}/"></iframe>`,target.title)).toBeNull();
 });
 it('requires exact source identity and owner plus corroboration; upload dates are not service dates',()=>{
 expect(matchSourceRecording(target,source,[recording]).outcome).toBe('verified');
 expect(matchSourceRecording({...target,sourceWordPressId:124},source,[recording]).outcome).toBe('conflicting');
 expect(matchSourceRecording(target,{...source,audioValues:[]},[recording]).outcome).toBe('unmatched');
 expect(matchSourceRecording(target,{...source,audioValues:[...source.audioValues,'https://www.sermonaudio.com/sermons/999']},[recording]).outcome).toBe('ambiguous');
 expect(matchSourceRecording(target,source,[{...recording,broadcasterId:'otherchurch'}]).outcome).toBe('conflicting');
 expect(matchSourceRecording(target,source,[]).outcome).toBe('unavailable');
 expect(matchSourceRecording(target,source,[{...recording,serviceDate:'2024-01-14',uploadDate:target.serviceDate}]).outcome).toBe('conflicting');
 expect(matchSourceRecording(target,source,[{...recording,uploadDate:'2026-01-01'}]).outcome).toBe('verified');
 });
 it('extracts only allowlisted official player metadata with either attribute order',()=>{
 const h=`<meta content="Example teaching | SermonAudio" property='og:title'><a href='/broadcasters/savinggrace/' class='broadcaster'>Church</a><a class='speaker'>Example Speaker</a><script>var init${id}audio = function(){ var player = new saPlayer({id:'${id}',duration:1234}); }; secret='excluded';</script>`;
 const result=officialPlayerMetadata(h,id);expect(result).toEqual({...recording,title:target.title,durationSeconds:1234,serviceDate:undefined});
 expect(JSON.stringify(result)).not.toContain('excluded');
 });
 it('keeps embedded audio and YouTube inert without separate provider links',()=>{
 const sermon={title:'Example teaching',media:[{provider:'sermonaudio',mediaType:'audio',externalId:id,canonicalUrl:canonicalSermonAudioUrl(id),title:'Audio'},{provider:'youtube',mediaType:'video',externalId:'abcdefghijk',canonicalUrl:'https://youtu.be/abcdefghijk',title:'Video'}]} as SermonDetail;
 const html=String(mediaSection(sermon));expect(html).toContain('Load audio player');expect(html).not.toContain('Listen on SermonAudio');expect(html).not.toContain('Watch on YouTube');expect(html).not.toMatch(/<a\b/u);expect(html).toContain('data-load-youtube');expect(html).not.toContain('<iframe');expect(html).not.toContain('embed.sermonaudio.com/player');
 expect(html).toContain('id="play-audio" data-audio-frame data-sermonaudio-id="'+id+'"');
 expect(html).toContain('id="media-heading" class="section__title">Watch or listen</h2>');
 const audioOnly=String(mediaSection({...sermon,media:[sermon.media[0]!]}));
 expect(audioOnly).toContain('id="media-heading" class="section__title">Listen</h2>');expect(audioOnly).not.toContain('currently unavailable');
 const videoOnly=String(mediaSection({...sermon,media:[sermon.media[1]!]}));
 expect(videoOnly).toContain('id="media-heading" class="section__title">Watch</h2>');expect(videoOnly).not.toContain('data-audio-frame');
 expect(html).not.toContain('autoplay');expect(audioLoaderSource).toContain('iframe.title');expect(audioLoaderSource).toContain('iframe.tabIndex = 0');expect(audioLoaderSource).toContain("addEventListener('click'");
 expect(contentSecurityPolicy(html)).toContain('frame-src https://www.youtube-nocookie.com https://embed.sermonaudio.com;');
 expect(contentSecurityPolicy('<script>'+audioLoaderSource+'</script>')).not.toContain('frame-src');
 expect(sermonMedia({...sermon,media:[{...sermon.media[0]!,canonicalUrl:'https://www.sermonaudio.com/sermons/999'}]}).audio).toHaveLength(0);
 });
});
