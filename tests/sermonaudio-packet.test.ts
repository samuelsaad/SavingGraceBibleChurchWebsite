import {it,expect} from 'vitest';
import {validateAudioPacket,audioPacketHash} from '../src/staging/sermonaudio-packet';
import {audioReviewPlanSha256} from '../src/domain/sermonaudio-review';
it('bounds scoped synchronization to unique, hashed reviewed mappings without content or credentials',()=>{
 const assessment={planSha256:audioReviewPlanSha256,evidenceSha256:'a'.repeat(64),sourceIdentityVerified:true,explicitRecordingReferenceVerified:true,officialBroadcaster:'savinggrace',serviceDateVerified:true,titleCorroborated:true,speakerCorroborated:true,singleRecordingVerified:true,audioAvailable:true,audioQualityVerified:false,humanApprovalClaimed:false,provider:'OpenAI',executionSurface:'Codex',model:'not_exposed_by_runtime',immutableRevision:'not_exposed_by_runtime',reviewMethod:'explicit-source-reference-and-official-recording-metadata'};
 const p={version:1,planSha256:audioReviewPlanSha256,records:Array.from({length:268},(_,i)=>({link:{sermonId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),sourceWordPressId:100000+i,expectedVersion:1,sermonAudioId:String(100000+i),sourceSha256:'b'.repeat(64),planSha256:audioReviewPlanSha256,evidence:['explicit_source_identity','official_broadcaster_verified'],mediaBeforeSha256:'c'.repeat(64)},assessment})),sha256:''};
 p.sha256=audioPacketHash(p);expect(validateAudioPacket(p).records).toHaveLength(268);
 expect(()=>validateAudioPacket({...p,token:'synthetic'})).toThrow();
 expect(()=>validateAudioPacket({...p,records:p.records.slice(1)})).toThrow();
 const dup={...p,records:[...p.records]};dup.records[1]=dup.records[0]!;dup.sha256=audioPacketHash(dup);expect(()=>validateAudioPacket(dup)).toThrow();
 expect(()=>validateAudioPacket({...p,sha256:'f'.repeat(64)})).toThrow();
});
