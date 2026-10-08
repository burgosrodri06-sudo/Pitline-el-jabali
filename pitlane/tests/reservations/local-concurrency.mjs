// Starts an isolated loopback cluster and runs the existing reservation races.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';

const directory = await mkdtemp(join(tmpdir(), 'pitlane-reservation-pg-'));
const probe=createServer();
await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const password=randomUUID();
const cluster=new EmbeddedPostgres({databaseDir:join(directory,'data'),port,user:'postgres',password,
  persistent:true,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],
  initdbFlags:['--encoding=UTF8','--locale=C'],onLog:()=>{},onError:()=>{}});
try {
  await cluster.initialise(); await cluster.start();
  const result=await promisify(execFile)(process.execPath,['tests/reservations/concurrency.mjs'],{
    env:{...process.env,RESERVATION_TEST_ADMIN_URL:`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`},timeout:60000,
  });
  process.stdout.write(result.stdout);
} finally { await cluster.stop(); }
