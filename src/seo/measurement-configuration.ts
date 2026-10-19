/** Protected optional production configuration; never load it in a rehearsal. */
import {lstat,readFile,realpath} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {z} from 'zod';
import {sha256} from './source-public-model';
import type {VerifiedGa4Configuration} from './measurement';
const configuration=z.object({measurementId:z.string().regex(/^G-[A-Z0-9]{6,20}$/u),propertyId:z.string().regex(/^\d{1,20}$/u),streamId:z.string().regex(/^\d{1,20}$/u),configurationSha256:z.string().regex(/^[a-f0-9]{64}$/u),enhancedMeasurementDisabled:z.literal(true),advertisingDisabled:z.literal(true),existingAnalyticsConsent:z.enum(['granted','denied'])}).strict();
export async function configuredMeasurement(input:{environment:string;rehearsal:boolean;filename?:string|undefined;expectedSha256?:string|undefined}):Promise<{configuration:VerifiedGa4Configuration;fileSha256:string}|null>{
 if(input.environment!=='production'||input.rehearsal)return null;
 if(!input.filename&&!input.expectedSha256)return null;
 if(!input.filename||!isAbsolute(input.filename)||!/^[a-f0-9]{64}$/u.test(input.expectedSha256??''))throw Error('measurement_configuration_binding');
 const path=resolve(input.filename),stat=await lstat(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096||await realpath(path)!==path||(process.platform!=='win32'&&(stat.mode&0o077)!==0))throw Error('measurement_configuration_file');
 const raw=await readFile(path);if(raw.length>4096||sha256(raw)!==input.expectedSha256)throw Error('measurement_configuration_integrity');
 return {configuration:configuration.parse(JSON.parse(raw.toString('utf8'))),fileSha256:input.expectedSha256!};
}
