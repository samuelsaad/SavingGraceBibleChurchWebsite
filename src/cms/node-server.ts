import {createServer} from "node:http";
import {IncomingRequestTooLargeError,toWebRequest} from "../server/http/node-request-adapter";
import {cmsUploadMaximum} from "./assets";
export function listenLocalCmsServer(options:{origin:string;port:number;handler:(request:Request)=>Promise<Response>;shutdown:()=>Promise<void>}){
 const server=createServer(async(incoming,outgoing)=>{
  try{const request=await toWebRequest(incoming,options.origin,cmsUploadMaximum+1024);const response=await options.handler(request);outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));}
  catch(error){outgoing.writeHead(error instanceof IncomingRequestTooLargeError?413:400,{"Cache-Control":"no-store","X-Robots-Tag":"noindex","Content-Type":"text/plain"});outgoing.end("request_refused");}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;server.listen(options.port,"127.0.0.1",()=>process.stdout.write("cms_runtime_ready\n"));
 const shutdown=()=>server.close(()=>{void options.shutdown().then(()=>process.exit(0));});process.once("SIGINT",shutdown);process.once("SIGTERM",shutdown);return server;
}

