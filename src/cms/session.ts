import {randomBytes,timingSafeEqual,createHash} from "node:crypto";
import type {ApplicationIdentity} from "../application/authorization";
import type {IdentityProvider} from "../server/auth/identity-provider";
const cookiePrefix="sgbc_cms_admin";
const safeHeaders={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin","X-Frame-Options":"DENY"};
const token=()=>randomBytes(32).toString("base64url");
function same(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function cookie(request:Request,name:string){return (request.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1);}
type Session={csrf:string,expires:number};
export class CmsSessionProvider implements IdentityProvider{
 private readonly sessions=new Map<string,Session>();
 private readonly nonces=new Map<string,number>();
 private attempts:number[]=[];
 readonly identity:ApplicationIdentity;
 readonly origin:string;
 private readonly cookieName:string;
 constructor(private readonly options:{origin:string;secret:string;environment:"local"|"staging";allowLocalDevelopmentEntry?:boolean;now?:()=>number;lifetimeMs?:number}){
  if(options.allowLocalDevelopmentEntry&&options.environment!=="local")throw Error("cms_local_identity_on_staging_refused");
  const url=new URL(options.origin);
  if(url.origin!==options.origin||!["127.0.0.1","localhost","[::1]"].includes(url.hostname)||!["http:","https:"].includes(url.protocol)||!/^[a-f0-9]{64}$/.test(options.secret))throw Error("cms_session_configuration_refused");
  this.cookieName=cookiePrefix+"_"+options.environment+"_"+(url.port||"default");
  this.origin=url.origin;this.identity={subject:options.environment==="staging"?"staging-cms-admin":options.allowLocalDevelopmentEntry?"local-admin-0001":"local-cms-admin",role:"admin"};
 }
 get localDevelopmentIdentity(){return this.options.allowLocalDevelopmentEntry===true;}
 private now(){return this.options.now?.()??Date.now();}
 private hash(value:string){return createHash("sha256").update(value).digest("hex");}
 private trusted(request:Request){const url=new URL(request.url),host=request.headers.get("host");return url.origin===this.origin&&(!host||host===new URL(this.origin).host);}
 private session(request:Request){if(!this.trusted(request))return null;const value=cookie(request,this.cookieName);if(!value)return null;const key=this.hash(value),session=this.sessions.get(key);if(!session)return null;if(session.expires<=this.now()){this.sessions.delete(key);return null;}return session;}
 sessionKey(request:Request){return this.session(request)?this.hash(cookie(request,this.cookieName)!):null;}
 async authenticate(request:Request){return this.session(request)?this.identity:null;}
 authorizeMutation(request:Request){const session=this.session(request);return Boolean(session&&request.headers.get("origin")===this.origin&&same(request.headers.get("x-csrf-token")??"",session.csrf));}
 private cookie(value:string,age:number){return `${this.cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${this.origin.startsWith("https:")?"; Secure":""}`;}
 loginPage():string{
  for(const [key,expiry] of this.nonces)if(expiry<=this.now())this.nonces.delete(key);
  if(this.nonces.size>=100)this.nonces.delete(this.nonces.keys().next().value!);
  const nonce=token();this.nonces.set(nonce,this.now()+600000);
  const entry=this.localDevelopmentIdentity?'<p>Local development identity · not personal sign-in. Access is restricted to this computer.</p><button>Open local administration</button>':'<label for="secret">Administrator access key</label><input id="secret" name="secret" type="password" autocomplete="current-password" required maxlength="64"><button>Sign in</button>';
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Website administration — Saving Grace</title><style>body{font:18px/1.6 system-ui;background:#f4f5f2;color:#18251f;max-width:32rem;margin:12vh auto;padding:24px}h1{line-height:1.2}label,input,button{display:block}input{font:inherit;box-sizing:border-box;width:100%;padding:12px;margin:8px 0 24px}button{font:inherit;padding:12px 20px;background:#1f503b;color:white;border:0;cursor:pointer}:focus-visible{outline:3px solid #165fd1;outline-offset:3px}p{color:#55665e}</style></head><body><main><h1>Website administration</h1><p>Protected ${this.options.environment} CMS access. This is a single administrator session, not church-owned production sign-in.</p><form method="post" action="/admin/session"><input type="hidden" name="nonce" value="${nonce}">${entry}</form></main></body></html>`;
 }
 async handle(request:Request):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!["/admin/login","/admin/login/","/admin/session","/api/v1/admin/cms/session"].includes(path))return null;
  const response=(body:string|null,status=200,extra:Record<string,string>={})=>new Response(body,{status,headers:{...safeHeaders,...extra}});
  if(!this.trusted(request))return response("Request refused",403);
  if(path==="/admin/login"||path==="/admin/login/"){
   if(request.method!=="GET")return response("Method not allowed",405,{Allow:"GET"});
   return response(this.loginPage(),200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
  }
  if(path==="/admin/session"){
   if(request.method!=="POST")return response("Method not allowed",405,{Allow:"POST"});
   if(request.headers.get("origin")!==this.origin||!(request.headers.get("content-type")??"").startsWith("application/x-www-form-urlencoded"))return response("Request refused",403);
   this.attempts=this.attempts.filter(t=>t>this.now()-60000);
   if(this.attempts.length>=10)return response("Please wait before trying again",429,{"Retry-After":"60"});
   this.attempts.push(this.now());const body=await request.text();if(body.length>1024)return response("Request refused",413);
   const form=new URLSearchParams(body),nonce=form.get("nonce")??"",expiry=this.nonces.get(nonce);this.nonces.delete(nonce);
   if(!expiry||expiry<=this.now()||(!this.localDevelopmentIdentity&&!same(form.get("secret")??"",this.options.secret)))return response("Access key was not accepted. Return to sign in and try again.",401);
   const previous=cookie(request,this.cookieName);if(previous)this.sessions.delete(this.hash(previous));
   for(const [key,value] of this.sessions)if(value.expires<=this.now())this.sessions.delete(key);
   if(this.sessions.size>=50)return response("Too many active sessions",429);
   const value=token(),lifetime=this.options.lifetimeMs??28800000;this.sessions.set(this.hash(value),{csrf:token(),expires:this.now()+lifetime});
   return response(null,303,{Location:"/admin/cms","Set-Cookie":this.cookie(value,Math.floor(lifetime/1000))});
  }
  const session=this.session(request);if(!session)return response(JSON.stringify({error:{code:"authentication_required"}}),401,{"Content-Type":"application/json"});
  if(request.method==="GET")return response(JSON.stringify({identity:this.identity,csrfToken:session.csrf,environment:this.options.environment,developmentIdentity:this.localDevelopmentIdentity}),200,{"Content-Type":"application/json"});
  if(request.method==="DELETE"){
   if(!this.authorizeMutation(request))return response("Request refused",403);
   this.sessions.delete(this.hash(cookie(request,this.cookieName)!));return response(null,204,{"Set-Cookie":this.cookie("",0)});
  }
  return response("Method not allowed",405,{Allow:"GET, DELETE"});
 }
}
