/** Compress only public source-backed visitor text. Admin/form/media responses
 * retain their existing representation, and identity verification requests stay raw.
 */
export function publicTextTransfer(response:Response,request:Request):Response{
 let path:string;try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return response;}
 if(!['GET','HEAD'].includes(request.method)||response.status!==200||request.method!=='HEAD'&&!response.body||!response.headers.has('X-SEO-Candidate')||response.headers.has('Content-Encoding')||response.headers.has('ETag')||response.headers.has('Content-Range')||request.headers.has('Range')||/^\/(?:admin|api|frontend-preview|draft-preview|cms-preview|cms-editor-frame|related-themes-evaluation|__local|__cms)(?:\/|$)/u.test(path)||! /^(?:text\/html|application\/xml|text\/xml)(?:;|$)/iu.test(response.headers.get('Content-Type')??''))return response;
 const headers=new Headers(response.headers),vary=new Set((headers.get('Vary')??'').split(',').map(v=>v.trim()).filter(Boolean));
 if(![...vary].some(v=>v.toLowerCase()==='accept-encoding'))vary.add('Accept-Encoding');headers.set('Vary',[...vary].join(', '));
 const gzip=(request.headers.get('Accept-Encoding')??'').split(',').some(part=>{const [coding,...parameters]=part.trim().split(';');if(coding?.trim().toLowerCase()!=='gzip')return false;const quality=parameters.find(p=>p.trim().startsWith('q='))?.trim().slice(2);return quality===undefined||/^(?:0(?:\.[0-9]{1,3})?|1(?:\.0{1,3})?)$/u.test(quality)&&Number(quality)>0;});
 if(!gzip)return new Response(response.body,{status:response.status,headers});
 headers.set('Content-Encoding','gzip');headers.delete('Content-Length');
 return new Response(request.method==='HEAD'?null:response.body!.pipeThrough(new CompressionStream('gzip')),{status:response.status,headers});
}
