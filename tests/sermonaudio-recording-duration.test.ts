import {describe,it,expect} from 'vitest';
import {extractSermonAudioRecordingDuration} from '../src/sermonaudio/recording-duration';

const id='1234567890123';
const recording=(seconds:unknown=2732)=>({sermonID:id,broadcaster:{broadcasterID:'savinggrace'},hasAudio:true,
  audioDurationSeconds:seconds,media:{audio:[{duration:seconds}]}});

describe('official SermonAudio recording duration',()=>{
  it('uses documented audio seconds and corroborates renditions, including longer than one hour',()=>{
    expect(extractSermonAudioRecordingDuration(recording(),id)).toMatchObject({durationSeconds:2732,originalValue:2732,originalUnits:'seconds',field:'audioDurationSeconds',corroboratingAudioRenditions:1});
    expect(extractSermonAudioRecordingDuration(recording(4328),id)?.durationSeconds).toBe(4328);
  });
  it('can use only the documented audio rendition field when the root value is absent',()=>{
    expect(extractSermonAudioRecordingDuration({...recording(null),media:{audio:[{duration:2732},{duration:2732}]}},id)).toMatchObject({durationSeconds:2732,field:'media.audio.duration',corroboratingAudioRenditions:2});
  });
  it('rejects conflicting audio representations rather than guessing one',()=>{
    expect(()=>extractSermonAudioRecordingDuration({...recording(),media:{audio:[{duration:2731}]}},id)).toThrow('audio_rendition_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...recording(null),media:{audio:[{duration:2732},{duration:2733}]}},id)).toThrow('audio_rendition_conflict');
  });
  it('preserves a one-second lower-bitrate variant only when the declared root agrees with highest-bitrate audio',()=>{
    const metadata={...recording(2948),media:{audio:[{duration:2948,bitrate:96},{duration:2949,bitrate:16}]}};
    const result=extractSermonAudioRecordingDuration(metadata,id);
    expect(result).toMatchObject({durationSeconds:2948,originalValue:2948,field:'audioDurationSeconds',renditionDifferences:{classification:'variant_difference_observed',canonicalField:'audioDurationSeconds',canonicalBitrate:96,renditions:[{durationSeconds:2948,bitrate:96},{durationSeconds:2949,bitrate:16}]}});
    expect(()=>extractSermonAudioRecordingDuration({...metadata,audioDurationSeconds:2949},id)).toThrow('audio_rendition_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...metadata,media:{audio:[{duration:2948,bitrate:96},{duration:2950,bitrate:16}]}},id)).toThrow('audio_rendition_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...metadata,media:{audio:[{duration:2948,bitrate:96},{duration:2949}]}},id)).toThrow('audio_rendition_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...metadata,media:{audio:[{duration:2948,bitrate:96},{duration:2949,bitrate:96}]}},id)).toThrow('audio_rendition_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...metadata,media:{audio:[{duration:2948,bitrate:96},{duration:2949,bitrate:16},{duration:null,bitrate:128}]}},id)).toThrow('audio_rendition_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...metadata,media:{audio:[{duration:2948,bitrate:96},{duration:2947,bitrate:16},{duration:2949,bitrate:32}]}},id)).toThrow('audio_rendition_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...metadata,audioDurationSeconds:null},id)).toThrow('audio_rendition_conflict');
  });
  it('requires exact recording and broadcaster identities',()=>{
    expect(()=>extractSermonAudioRecordingDuration(recording(),'9999999999999')).toThrow('recording_identity_conflict');
    expect(()=>extractSermonAudioRecordingDuration({...recording(),broadcaster:{broadcasterID:'another-church'}},id)).toThrow('broadcaster_conflict');
    expect(()=>extractSermonAudioRecordingDuration(recording(),'../invalid')).toThrow('recording_identity_conflict');
  });
  it('does not substitute video duration, transcript timestamps or word counts',()=>{
    expect(extractSermonAudioRecordingDuration({...recording(null),videoDurationSeconds:2732,transcript:{lastTimestamp:2732,wordCount:5000},media:{audio:[],video:[{duration:2732}]}},id)).toBeNull();
    expect(extractSermonAudioRecordingDuration({...recording(),hasAudio:false},id)).toBeNull();
  });
  it('rejects strings, fractional seconds, non-finite and out-of-storage-range values',()=>{
    for(const value of ['2732',0,-1,1.2,NaN,Infinity,2147483648])expect(()=>extractSermonAudioRecordingDuration(recording(value),id)).toThrow('invalid_seconds');
    expect(extractSermonAudioRecordingDuration(recording(2147483647),id)?.durationSeconds).toBe(2147483647);
  });
  it('allows genuinely missing metadata and rejects malformed audio objects',()=>{
    expect(extractSermonAudioRecordingDuration({sermonID:id,broadcaster:{broadcasterID:'savinggrace'},hasAudio:true},id)).toBeNull();
    expect(()=>extractSermonAudioRecordingDuration({...recording(),media:{audio:{duration:2732}}},id)).toThrow('audio_metadata_invalid');
    expect(()=>extractSermonAudioRecordingDuration({...recording(),media:{audio:[null]}},id)).toThrow('audio_metadata_invalid');
  });
});
