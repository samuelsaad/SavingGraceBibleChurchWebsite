/** Read-only source visitor integration; administration retains its existing boundary. */
import type {Pool} from 'pg';
import {createVersionedSourceHandler} from './runtime-snapshot';
import {sourceOrigin} from './source-public-model';
export async function createSourcePublicVisitor(reader:Pool,assetDirectory:string,origin:string,acceptedStageRepository?:import('../server/repositories/sermon-repository').PublicSermonRepository){
 return createVersionedSourceHandler({reader,assetDirectory,...(acceptedStageRepository?{acceptedStageRepository}:{}),releaseIdentity:process.env.RELEASE_COMMIT??'',policy:{environment:'staging',canonicalOrigin:sourceOrigin,rehearsalOrigins:[origin]}});
}
export function retainPrivateRoutes(existing:(request:Request)=>Promise<Response>,visitor:(request:Request)=>Promise<Response>){
 return(request:Request)=>{const path=new URL(request.url).pathname;return /^\/(?:admin|api|cms-preview|cms-editor-frame|cms-assets|frontend-preview|related-themes-evaluation|healthz|health)(?:\/|$)/u.test(path)?existing(request):visitor(request);};
}
