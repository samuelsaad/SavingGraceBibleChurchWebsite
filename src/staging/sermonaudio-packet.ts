import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sermonAudioLinkSchema} from '../metadata/sermonaudio-linking';
import {audioAssessmentSchema,audioReviewPlanSha256} from '../domain/sermonaudio-review';
const packet=z.object({version:z.literal(1),planSha256:z.literal(audioReviewPlanSha256),
 records:z.array(z.object({link:sermonAudioLinkSchema,assessment:audioAssessmentSchema}).strict()).length(268),
 sha256:z.string().regex(/^[a-f0-9]{64}$/u)}).strict();
export const audioPacketHash=(p:unknown)=>createHash('sha256').update(JSON.stringify({...p as object,sha256:''})).digest('hex');
export function validateAudioPacket(raw:unknown){
 const p=packet.parse(raw);
 if(audioPacketHash(p)!==p.sha256||new Set(p.records.map(r=>r.link.sermonId)).size!==p.records.length
 ||new Set(p.records.map(r=>r.link.sourceWordPressId)).size!==p.records.length
 ||new Set(p.records.map(r=>r.link.sermonAudioId)).size!==p.records.length
 ||p.records.some(r=>r.link.planSha256!==p.planSha256))throw Error('audio_sync_packet_refused');
 return p;
}
