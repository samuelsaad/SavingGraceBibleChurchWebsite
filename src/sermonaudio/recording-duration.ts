import {sermonAudioIdPattern} from '../domain/sermonaudio';
import {officialChurchBroadcasterId} from '../metadata/sermonaudio-matching';

export interface SermonAudioRecordingDuration {
  provider:'sermonaudio';
  recordingId:string;
  broadcasterId:'savinggrace';
  durationSeconds:number;
  originalValue:number;
  originalUnits:'seconds';
  field:'audioDurationSeconds'|'media.audio.duration';
  corroboratingAudioRenditions:number;
  renditionDifferences?:{
    classification:'variant_difference_observed';
    canonicalField:'audioDurationSeconds';
    canonicalBitrate:number;
    renditions:Array<{durationSeconds:number;bitrate:number}>;
  };
}

function object(value:unknown):Record<string,unknown>|null {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}

function optionalSeconds(value:unknown):number|null {
  if(value===undefined||value===null)return null;
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0||value>2147483647)throw Error('sermonaudio_duration_invalid_seconds');
  return value;
}

/** Official v2 Sermon.audioDurationSeconds and Media.duration are seconds.
 * Only audio renditions corroborate an audio recording. Video and transcript
 * timestamps cannot supply or override this value. No media URL is fetched. */
export function extractSermonAudioRecordingDuration(raw:unknown,expectedRecordingId:string):SermonAudioRecordingDuration|null {
  const recording=object(raw);
  if(!sermonAudioIdPattern.test(expectedRecordingId)||!recording||recording.sermonID!==expectedRecordingId)throw Error('sermonaudio_duration_recording_identity_conflict');
  if(object(recording.broadcaster)?.broadcasterID!==officialChurchBroadcasterId)throw Error('sermonaudio_duration_broadcaster_conflict');
  if(recording.hasAudio!==true)return null;
  const primary=optionalSeconds(recording.audioDurationSeconds);
  const media=recording.media===null||recording.media===undefined?null:object(recording.media);
  if(recording.media!==null&&recording.media!==undefined&&!media)throw Error('sermonaudio_duration_audio_metadata_invalid');
  const audio=media?.audio;
  if(audio!==null&&audio!==undefined&&!Array.isArray(audio))throw Error('sermonaudio_duration_audio_metadata_invalid');
  const audioRenditions=((audio as unknown[]|undefined|null)??[]).map(value=>{
    const rendition=object(value);if(!rendition)throw Error('sermonaudio_duration_audio_metadata_invalid');
    return {durationSeconds:optionalSeconds(rendition.duration),bitrate:
      typeof rendition.bitrate==='number'&&Number.isSafeInteger(rendition.bitrate)&&rendition.bitrate>0?rendition.bitrate:null};
  });
  const renditions=audioRenditions.filter((value):value is {durationSeconds:number;bitrate:number|null}=>value.durationSeconds!==null);
  const durations=renditions.map(value=>value.durationSeconds);
  const distinct=new Set(primary===null?durations:[primary,...durations]);
  let renditionDifferences:SermonAudioRecordingDuration['renditionDifferences'];
  if(distinct.size>1){
    // Observed official responses may differ by one second between encoded
    // renditions. The declared sermon-level value remains canonical only when
    // the highest-bitrate audio corroborates it. Preserve the difference; do
    // not infer why the provider's renditions differ or normalize their values.
    if(primary===null||audioRenditions.some(value=>value.bitrate===null)||renditions.some(value=>Math.abs(value.durationSeconds-primary)>1)
      ||Math.max(...durations)-Math.min(...durations)>1)throw Error('sermonaudio_duration_audio_rendition_conflict');
    const verified=renditions as Array<{durationSeconds:number;bitrate:number}>;
    const highest=Math.max(...audioRenditions.map(value=>value.bitrate!));
    if(audioRenditions.filter(value=>value.bitrate===highest).some(value=>value.durationSeconds!==primary))throw Error('sermonaudio_duration_audio_rendition_conflict');
    renditionDifferences={classification:'variant_difference_observed',canonicalField:'audioDurationSeconds',canonicalBitrate:highest,renditions:verified};
  }
  const seconds=primary??durations[0];
  if(seconds===undefined)return null;
  return {provider:'sermonaudio',recordingId:expectedRecordingId,broadcasterId:'savinggrace',
    durationSeconds:seconds,originalValue:seconds,originalUnits:'seconds',
    field:primary===null?'media.audio.duration':'audioDurationSeconds',
    corroboratingAudioRenditions:durations.length,...(renditionDifferences?{renditionDifferences}:{})};
}
