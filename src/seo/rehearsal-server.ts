/** Loopback-only rehearsal, with a caller-supplied hash of the frozen code package. */
import {createServer} from 'node:http';
import {createCmsLocalPool,verifyCmsLocalIdentity} from '../cms/local-database';
import {createVersionedSourceHandler} from './runtime-snapshot';
import {sourceOrigin} from './source-public-model';
import {toWebRequest} from '../server/http/node-request-adapter';
async function main(){
 const port=Number(process.env.SEO_REHEARSAL_PORT??4440),mode=process.env.SEO_REHEARSAL_MODE??'production',code=process.env.SEO_REHEARSAL_CODE_SHA256??'';
 if(!Number.isInteger(port)||port<1024||port>65535||!['production','staging'].includes(mode)||process.env.SEO_REHEARSAL_HOST!=='127.0.0.1'||!process.env.CMS_STORAGE_DIRECTORY||!/^[a-f0-9]{64}$/u.test(code))throw Error('seo_rehearsal_configuration');
 const pool=await createCmsLocalPool(true);await verifyCmsLocalIdentity(pool);
 const handler=await createVersionedSourceHandler({reader:pool,assetDirectory:process.env.CMS_STORAGE_DIRECTORY,releaseIdentity:code,
  policy:{environment:mode as 'production'|'staging',canonicalOrigin:sourceOrigin,...(mode==='production'?{redirectOrigins:['http://www.savinggrace.org.au','http://savinggrace.org.au','https://savinggrace.org.au']}:{rehearsalOrigins:[`http://127.0.0.1:${port}`]})}});
 const server=createServer(async(incoming,outgoing)=>{try{
  if(incoming.headers.host!==`127.0.0.1:${port}`)throw Error('seo_rehearsal_host');
  const requested=incoming.headers['x-seo-rehearsal-origin'],origin=mode==='production'?(typeof requested==='string'?requested:sourceOrigin):`http://127.0.0.1:${port}`;
  const response=await handler(await toWebRequest(incoming,origin,0));outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
 }catch{outgoing.writeHead(400,{'X-Robots-Tag':'noindex','Cache-Control':'no-store'});outgoing.end('request_refused');}});
 server.requestTimeout=15000;server.headersTimeout=10000;
 server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({outcome:'seo_rehearsal_ready',mode,port,codeSha256:code})));
 const close=()=>server.close(()=>void pool.end().then(()=>process.exit(0)));process.once('SIGINT',close);process.once('SIGTERM',close);
}
main().catch(()=>{console.error('seo_rehearsal_startup_refused');process.exitCode=1;});
