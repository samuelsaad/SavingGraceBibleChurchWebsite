import {it,expect,vi}from'vitest';import{EventEmitter}from'node:events';import{mkdtemp,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
const mocked=vi.hoisted(()=>({connect:vi.fn()}));vi.mock('node:tls',()=>({connect:mocked.connect}));
import{configuredContactDelivery}from'../src/server/contact-mail';
it('uses verified TLS, a separately approved test recipient and SMTP acceptance before success',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sgbc-mail-fixture-'));if(!root.startsWith(join(tmpdir(),'sgbc-mail-fixture-')))throw Error('fixture_scope');const path=join(root,'mail.private.json');
 try{const config={host:'smtp.example.test',port:465,username:'anonymous-fixture',password:'fixture-only',from:'site@example.test',recipient:'test@example.test',approvedTestRecipient:'test@example.test',environment:'test'};await writeFile(path,JSON.stringify(config),{mode:0o600});
 const socket=Object.assign(new EventEmitter(),{write:vi.fn(),destroy:vi.fn(),end:vi.fn(),setTimeout:vi.fn()});mocked.connect.mockReturnValue(socket);
 const deliver=(await configuredContactDelivery(path,'staging'))!;let accepted=false;const completed=deliver({name:'Anonymous visitor',email:'visitor@example.test',subject:'Enquiry',message:'Anonymous test wording.'}).then(()=>{accepted=true;});
 expect(mocked.connect.mock.calls[0]?.[0]).toMatchObject({rejectUnauthorized:true,minVersion:'TLSv1.2',servername:'smtp.example.test'});expect(socket.write).not.toHaveBeenCalled();
 for(const line of ['220 Ready','250-smtp fixture','250 AUTH PLAIN','235 Authenticated','250 Sender OK','250 Recipient OK','354 Start message'])socket.emit('data',Buffer.from(line+'\r\n'));
 expect(accepted).toBe(false);expect(socket.write.mock.calls.at(-1)?.[0]).toContain('Content-Transfer-Encoding: base64');
 socket.emit('data',Buffer.from('250 Accepted\r\n'));await completed;expect(accepted).toBe(true);expect(socket.end).toHaveBeenCalledOnce();
 await expect(configuredContactDelivery(path,'production')).rejects.toThrow('contact_production_configuration_required');
 await writeFile(path,JSON.stringify({...config,recipient:'unapproved@example.test'}));await expect(configuredContactDelivery(path,'local')).rejects.toThrow('contact_test_recipient_required');
 }finally{await rm(root,{recursive:true,force:false});}
});
