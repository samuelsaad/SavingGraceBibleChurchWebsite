/** Mail bodies and addresses are never logged, persisted or included in telemetry. */
import {contactForm,emptyContactFields,type ContactFields} from '../../frontend/contact-form';
import {pageShell} from '../../frontend/shell';
import {html} from '../../frontend/html';
import {frontendResponse} from './frontend-response';
import type {FrontendRenderContext} from '../../frontend/routes';
export type ContactDelivery=(message:ContactFields)=>Promise<void>;
export function createContactHandler(options:{origin:string;deliver?:ContactDelivery;context?:FrontendRenderContext;now?:()=>number}){
 let window=0,count=0;
 return async(request:Request):Promise<Response|null>=>{
  if(new URL(request.url).pathname!=='/contact/send/')return null;
  const context=options.context??{mode:'restricted',basePath:''};
  const render=(status:number,fields:ContactFields,errors:Partial<Record<keyof ContactFields,string>>,notice:string)=>frontendResponse(pageShell({title:'Contact Us',canonicalPath:'/contact/',robots:'noindex, follow',body:html`<h1>Contact Us</h1>${contactForm(fields,errors,notice)}`},context),{status,headers:{'X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store'}});
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST','X-Robots-Tag':'noindex'}});
  if(request.headers.get('origin')!==options.origin||request.headers.get('sec-fetch-site')==='cross-site')return render(403,emptyContactFields,{},'Please open the contact page on this website and try again.');
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return render(415,emptyContactFields,{},'Please submit the message using the contact form.');
  const reader=request.body?.getReader();let bytes=0;const chunks:Uint8Array[]=[];
  try{if(reader)while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>24000){await reader.cancel();return render(413,emptyContactFields,{},'Your message is too long. Please keep it under 5,000 characters.');}chunks.push(next.value);}}finally{reader?.releaseLock();}
  const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  const data=new URLSearchParams(new TextDecoder().decode(buffer)),values={...emptyContactFields};
  for(const key of Object.keys(values) as (keyof ContactFields)[])values[key]=(data.get(key)??'').trim();
  const errors:Partial<Record<keyof ContactFields,string>>={};
  if(values.name.length<2||values.name.length>120||/[\r\n\u0000]/u.test(values.name))errors.name='Enter your name, using 2–120 characters.';
  if(values.email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(values.email))errors.email='Enter a valid email address so we can reply.';
  if(values.subject.length>200||/[\r\n\u0000]/u.test(values.subject))errors.subject='Keep the subject to one line, up to 200 characters.';
  if(values.message.length<10||values.message.length>5000||values.message.includes('\u0000'))errors.message='Write a message between 10 and 5,000 characters.';
  if(Object.keys(errors).length)return render(422,values,errors,'Your message has not been sent.');
  if(data.get('website'))return render(422,values,{},'Please leave the website field empty and try again.');
  const now=(options.now??Date.now)();if(now-window>60000){window=now;count=0;}if(++count>10)return render(429,values,{},'Too many messages have been submitted. Please wait a minute and try again.');
  if(!options.deliver)return render(503,values,{},'Your message could not be sent. Your text is still below. Please email or call us, or try again later.');
  try{await options.deliver(values);}catch{return render(503,values,{},'Your message could not be sent. Your text is still below. Please email or call us, or try again later.');}
  return render(200,emptyContactFields,{},'Thank you. Your message has been sent to the church.');
 };
}
