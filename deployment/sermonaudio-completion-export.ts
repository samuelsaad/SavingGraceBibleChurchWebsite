import {mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';
import {readFrozenInventory} from '../src/sermonaudio/completion';
import {persistImmutable} from '../src/sermonaudio/private-artifacts';
import {verifyCompletedSchema} from '../src/staging/completed-schema';
import {captureSermonAudioCompletionPacket,validateSermonAudioCompletionPacket} from '../src/staging/sermonaudio-completion-packet';
async function main(){
 const inventory=await readFrozenInventory(resolve('../sermonaudio-transcript-retrieval/private/sermonaudio-transcript-retrieval'));
 const pool=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1,options:'-c default_transaction_read_only=on -c timezone=UTC'}),c=await pool.connect();
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  if(!(await c.query("SELECT current_database()='savinggrace_sermons_test' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AND current_setting('transaction_read_only')='on' ok")).rows[0]?.ok)throw Error('d175_export_source_refused');
  await verifyCompletedSchema(c);const p=await captureSermonAudioCompletionPacket(c,inventory.targets.map(t=>t.source.sourceWordPressId));await c.query('ROLLBACK');
  const dir=resolve('private/sermonaudio-119-completion/staging-transfer');await mkdir(dir,{recursive:true});
  const path=join(dir,`source-${p.ids.length}-${p.sha256}.private.json`);await persistImmutable(path,JSON.stringify(p));
  const reread=validateSermonAudioCompletionPacket(JSON.parse(await readFile(path,'utf8')));if(reread.sha256!==p.sha256)throw Error('d175_export_reread_mismatch');
  console.log(JSON.stringify({outcome:'frozen_private_transfer',targets:p.ids.length,manifestSha256:p.manifestSha256,packetSha256:p.sha256,sourceFingerprint:p.sourceFingerprint,tableCounts:Object.fromEntries(Object.entries(p.tables).map(([t,v])=>[t,v.rows.length]))}));
 }finally{await c.query('ROLLBACK');c.release();await pool.end();}
}
main().catch(error=>{console.error(JSON.stringify({outcome:'stopped_safely',code:error instanceof Error&&/^(d175|d171)_[a-z_]+$/u.test(error.message)?error.message:'d175_export_failed'}));process.exitCode=1;});
