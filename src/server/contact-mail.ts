/** Optional existing SMTP submission over verified implicit TLS; no fallback plaintext. */
import {connect,type TLSSocket} from 'node:tls';
import {readFile,lstat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {z} from 'zod';
import type {ContactDelivery} from './http/contact';
const email=z.email().max(254).refine(v=>!/[\r\n<>]/u.test(v));
const config=z.object({host:z.string().regex(/^[a-z0-9.-]+$/iu),port:z.literal(465),username:z.string().min(1).max(254),password:z.string().min(1).max(1000),from:email,recipient:email,approvedTestRecipient:email.optional(),environment:z.enum(['production','test'])}).strict();
export async function configuredContactDelivery(path:string|undefined,environment:'local'|'staging'|'production'):Promise<ContactDelivery|undefined>{
 if(!path)return undefined;if(!isAbsolute(path))throw Error('contact_configuration_refused');
 const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)throw Error('contact_configuration_refused');
 const selected=config.parse(JSON.parse(await readFile(path,'utf8')));
 if(environment==='production'&&selected.environment!=='production')throw Error('contact_production_configuration_required');
 if(environment!=='production'&&(selected.environment!=='test'||!selected.approvedTestRecipient||selected.recipient!==selected.approvedTestRecipient))throw Error('contact_test_recipient_required');
 return message=>new Promise<void>((resolve,reject)=>{
  let socket:TLSSocket;let buffer='',stage=0,done=false;
  const fail=()=>{if(done)return;done=true;socket?.destroy();reject(Error('contact_delivery_failed'));};
  const send=(line:string)=>socket.write(line+'\r\n');
  socket=connect({host:selected.host,port:selected.port,servername:selected.host,rejectUnauthorized:true,minVersion:'TLSv1.2'});
  socket.setTimeout(15000,fail);socket.on('error',fail);socket.on('close',()=>{if(!done)fail();});
  socket.on('data',chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>32768)return fail();let end:number;
   while((end=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);if(!/^\d{3}[- ]/u.test(line))return fail();if(line[3]==='-')continue;const code=Number(line.slice(0,3));
    if(stage===0&&code===220){stage=1;send('EHLO www.savinggrace.org.au');continue;}
    if(stage===1&&code===250){stage=2;send('AUTH PLAIN '+Buffer.from('\0'+selected.username+'\0'+selected.password).toString('base64'));continue;}
    if(stage===2&&code===235){stage=3;send('MAIL FROM:<'+selected.from+'>');continue;}
    if(stage===3&&code===250){stage=4;send('RCPT TO:<'+selected.recipient+'>');continue;}
    if(stage===4&&code===250){stage=5;send('DATA');continue;}
    if(stage===5&&code===354){stage=6;const body=['Name: '+message.name,'Email: '+message.email,'Subject: '+message.subject,'',message.message].join('\r\n');const encoded=Buffer.from(body).toString('base64').match(/.{1,76}/gu)?.join('\r\n')??'';send(['From: <'+selected.from+'>','To: <'+selected.recipient+'>','Reply-To: <'+message.email+'>','Subject: Website contact enquiry','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded,'.'].join('\r\n'));continue;}
    if(stage===6&&code===250){done=true;send('QUIT');socket.end();resolve();continue;}
    fail();
   }
  });
 });
}
