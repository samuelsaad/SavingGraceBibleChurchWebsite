import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {configuredMeasurement} from '../src/seo/measurement-configuration';
import {sha256} from '../src/seo/source-public-model';
const fixture={measurementId:'G-TEST123456',propertyId:'123',streamId:'456',configurationSha256:'a'.repeat(64),enhancedMeasurementDisabled:true,advertisingDisabled:true,existingAnalyticsConsent:'granted'};
it('keeps measurement off by default, on staging and in production-policy rehearsals without reading supplied paths',async()=>{
 expect(await configuredMeasurement({environment:'production',rehearsal:false})).toBeNull();
 for(const input of [{environment:'staging',rehearsal:false},{environment:'local',rehearsal:false},{environment:'production',rehearsal:true}])expect(await configuredMeasurement({...input,filename:'/not-accessed',expectedSha256:'invalid'})).toBeNull();
 await expect(configuredMeasurement({environment:'production',rehearsal:false,filename:'/missing'})).rejects.toThrow('binding');
});
it('requires an exact pinned bounded regular file and strict verified privacy fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sgbc-measurement-'));const filename=join(dir,'configuration.json');const load=(raw:string)=>configuredMeasurement({environment:'production',rehearsal:false,filename,expectedSha256:sha256(raw)});
 try{const raw=JSON.stringify(fixture);await writeFile(filename,raw,{mode:0o600});expect((await load(raw))?.configuration).toEqual(fixture);await expect(load(raw+' ')).rejects.toThrow('integrity');
 for(const bad of [{...fixture,advertisingDisabled:false},{...fixture,propertyId:''},{...fixture,unexpected:'ignored?'}]){const value=JSON.stringify(bad);await writeFile(filename,value);await expect(load(value)).rejects.toThrow();}
 const large=' '.repeat(4097);await writeFile(filename,large);await expect(load(large)).rejects.toThrow('file');
 }finally{await rm(dir,{recursive:true,force:true});}
});
