import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';
import {verifyCompletedSchema} from '../src/staging/completed-schema';
import {captureCompletedPacket,validateCompletedPacket} from '../src/staging/completed-packet';

async function main(){
 const db=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1,options:'-c default_transaction_read_only=on -c timezone=UTC'}),c=await db.connect();
 try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const r=(await c.query("SELECT current_database()='savinggrace_sermons_test' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AND current_setting('transaction_read_only')='on' ok")).rows[0];if(!r?.ok)throw Error('d171_source_refused');
  await verifyCompletedSchema(c);const packet=await captureCompletedPacket(c);await c.query('ROLLBACK');
  const dir=resolve('private/d171');await mkdir(dir,{recursive:true});
  const path=resolve(dir,'001-source.private.json');await writeFile(path,JSON.stringify(packet),{flag:'wx',mode:0o600});
  const reread=validateCompletedPacket(JSON.parse(await readFile(path,'utf8')));if(reread.sha256!==packet.sha256)throw Error('d171_reread_mismatch');
  await writeFile(resolve(dir,'002-cohort.private.json'),JSON.stringify({decision:'D-171',ids:packet.ids}),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({outcome:'frozen',count:packet.ids.length,membershipSha256:packet.membershipSha256,packetSha256:packet.sha256,sourceFingerprint:packet.sourceFingerprint,tableCounts:Object.fromEntries(Object.entries(packet.tables).map(([k,v])=>[k,v.rows.length]))}));
 }finally{c.release();await db.end();}
}
main().catch(e=>{console.error(JSON.stringify({outcome:'stopped',code:e instanceof Error&&/^d171_[a-z_]+$/u.test(e.message)?e.message:'d171_export_failed',sqlState:/^[A-Z0-9]{5}$/u.test(e?.code??'')?e.code:null}));process.exitCode=1;});
