import {describe,it,expect} from 'vitest';
import {normalizedRecordingDuration,verifiedDurationEvidenceSchema,sermonDurationUpdateSchema} from '../src/metadata/sermon-duration-update';
import {durationRefreshedEligibilitySql,durationOriginalReceiptSql} from '../src/domain/recording-duration-receipt';

const proof={provider:'sermonaudio',recordingId:'1234567890123',broadcasterId:'savinggrace',originalValue:4328,originalUnits:'seconds',durationSeconds:4328,field:'audioDurationSeconds',retrievedAt:'2026-10-07T00:00:00.000Z',metadataSha256:'a'.repeat(64),identityVerified:true,broadcasterVerified:true,sourceKind:'official_api'};
describe('verified recording duration metadata',()=>{
 it('accepts exact documented seconds and rejects estimates, fractions, strings, zero, overflow and different units',()=>{
  expect(normalizedRecordingDuration(4328,'seconds')).toBe(4328);
  for(const value of [null,undefined,0,-1,4.5,'4328',Infinity,NaN,2147483648])expect(normalizedRecordingDuration(value,'seconds')).toBeNull();
  expect(normalizedRecordingDuration(4328,'milliseconds')).toBeNull();
  expect(normalizedRecordingDuration(4328000,'milliseconds')).toBe(4328);
  expect(verifiedDurationEvidenceSchema.parse(proof).durationSeconds).toBe(4328);
  for(const patch of [{durationSeconds:4329},{originalUnits:'minutes'},{field:'transcriptFinalTimestamp'},{broadcasterId:'another-church'},{identityVerified:false},{broadcasterVerified:false},{provider:'youtube'},{recordingId:'<iframe>'},{token:'synthetic-secret'},{metadataSha256:'unverified'}])expect(verifiedDurationEvidenceSchema.safeParse({...proof,...patch}).success).toBe(false);
 });
 it('keeps already verified YouTube cache durations associated with their own provider and exact milliseconds',()=>{
  const cached={provider:'youtube',recordingId:'abcdefghijk',expectedChannelId:'UCabcdefghijklmnopqrstuv',originalValue:4328000,originalUnits:'milliseconds',durationSeconds:4328,field:'contentDetails.duration(normalized_cache)',retrievedAt:'2026-10-07T00:00:00.000Z',metadataSha256:'a'.repeat(64),retrievalTimeBasis:'retained_transcript_receipt_upper_bound',identityVerified:true,channelVerified:true,sourceKind:'cached_official_youtube'};
  expect(verifiedDurationEvidenceSchema.safeParse(cached).success).toBe(true);
  for(const patch of [{sourceKind:'official_api'},{originalValue:4328001},{expectedChannelId:'unverified'},{channelVerified:false},{broadcasterId:'savinggrace'}])expect(verifiedDurationEvidenceSchema.safeParse({...cached,...patch}).success).toBe(false);
 });
 it('allows a retained official player value only with its exact page hash and correct field',()=>{
  const player={...proof,sourceKind:'cached_official_player',field:'official_audio_player.duration',pageSha256:'b'.repeat(64)};
  expect(verifiedDurationEvidenceSchema.safeParse(player).success).toBe(true);
  expect(verifiedDurationEvidenceSchema.safeParse({...player,pageSha256:undefined}).success).toBe(false);
  expect(verifiedDurationEvidenceSchema.safeParse({...proof,pageSha256:'b'.repeat(64)}).success).toBe(false);
 });
 it('preserves a one-second rendition difference only when every highest-bitrate recording matches the declared duration',()=>{
  const variants={classification:'variant_difference_observed',canonicalField:'audioDurationSeconds',canonicalBitrate:96,renditions:[{durationSeconds:4328,bitrate:96},{durationSeconds:4329,bitrate:16}]};
  expect(verifiedDurationEvidenceSchema.safeParse({...proof,renditionDifferences:variants}).success).toBe(true);
  for(const patch of [{canonicalBitrate:16},{renditions:[{durationSeconds:4329,bitrate:96},{durationSeconds:4328,bitrate:16}]},{renditions:[{durationSeconds:4328,bitrate:96},{durationSeconds:4330,bitrate:16}]},{renditions:[{durationSeconds:4328,bitrate:96},{durationSeconds:4328,bitrate:16}]},{renditions:[{durationSeconds:4328,bitrate:96},{durationSeconds:4329,bitrate:96}]}])expect(verifiedDurationEvidenceSchema.safeParse({...proof,renditionDifferences:{...variants,...patch}}).success).toBe(false);
  expect(verifiedDurationEvidenceSchema.safeParse({...proof,field:'media.audio.duration',renditionDifferences:variants}).success).toBe(false);
 });
 it('requires optimistic identity/version/media hashes and forbids arbitrary write fields',()=>{
  const plan={sermonId:'10000000-0000-4000-8000-000000000001',sourceWordPressId:900001,expectedVersion:2,mediaId:'20000000-0000-4000-8000-000000000001',mediaBeforeSha256:'b'.repeat(64),planSha256:'c'.repeat(64),evidence:proof};
  expect(sermonDurationUpdateSchema.safeParse(plan).success).toBe(true);
  for(const patch of [{expectedVersion:0},{mediaBeforeSha256:null},{summary:'Synthetic unexpected content'},{status:'published'}])expect(sermonDurationUpdateSchema.safeParse({...plan,...patch}).success).toBe(false);
 });
 it('rejects untrusted SQL identifiers or cohorts rather than interpolating them',()=>{
  expect(()=>durationOriginalReceiptSql('s;drop','d175')).toThrow('alias');
  expect(()=>durationRefreshedEligibilitySql('s','invalid' as any,'true','true')).toThrow('selector');
 });
});
