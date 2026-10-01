const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const name = `lab_booking_test_${randomBytes(8).toString('hex')}`;
async function main() {
 const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
 const options = url ? {host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),ssl:{rejectUnauthorized:process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'}} : {host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',...(process.env.DB_SSL==='true'?{ssl:{rejectUnauthorized:process.env.DB_SSL_REJECT_UNAUTHORIZED!=='false'}}:{})};
 const connection = await mysql.createConnection(options);
 let created = false;
 try {
  await connection.query(`CREATE DATABASE \`${name}\``);created=true;
  if(url)url.pathname=`/${name}`;
  const testEnv={...process.env,NODE_ENV:'test',DB_NAME:name,DATABASE_URL:url?url.toString():''};
  for(const file of process.argv.slice(2)) {
   // Each suite gets an empty, disposable schema, never the configured application database.
   const [tables]=await connection.query(`SHOW TABLES FROM \`${name}\``);
   for(const row of tables) {const table=Object.values(row)[0];if(!/^[a-z_]+$/.test(table))throw Error('Unexpected table');await connection.query(`DROP TABLE \`${name}\`.\`${table}\``);}
   const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve(__dirname,file)],{cwd:path.resolve(__dirname,'..'),env:testEnv,stdio:'inherit'});child.on('error',reject);child.on('exit',resolve);});
   if(code!==0)throw Error(`Suite ${file} failed (${code})`);
  }
 }finally{if(created)await connection.query(`DROP DATABASE \`${name}\``);await connection.end();}
}
main().catch(error=>{console.error('Isolated checks failed:',error.code||error.message);process.exitCode=1;});
