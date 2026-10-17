import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'bcv-study-storage-'));
for(const file of [...readdirSync(new URL('../src/lib/class/',import.meta.url)).filter(f=>f.endsWith('.ts')).map(f=>'class/'+f),'wordStudy/storage.ts']){
 const src=readFileSync(new URL('../src/lib/'+file,import.meta.url),'utf8');
 const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText.replace(/(from\s+['"])([^'"]+)(['"])/g,(_,a,b,c)=>a+'./'+b.replace(/\.ts$/,'').split('/').pop()+'.mjs'+c);
 writeFileSync(join(dir,file.split('/').pop().replace('.ts','.mjs')),out);
}
const { applySchema }=await import(pathToFileURL(join(dir,'schema.mjs')));
const { handleClassRequest }=await import(pathToFileURL(join(dir,'workerHandlers.mjs')));
after(()=>rmSync(dir,{recursive:true,force:true}));
function fixture(){
 const sql=new DatabaseSync(':memory:');
 const db={exec:s=>sql.exec(s),run:(s,b=[])=>sql.prepare(s).run(...b),get:(s,b=[])=>sql.prepare(s).get(...b),all:(s,b=[])=>sql.prepare(s).all(...b),transaction:fn=>{sql.exec('BEGIN');try{const out=fn();sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 applySchema(db);return {sql,db,call:(type,data)=>handleClassRequest(db,{id:1,db:'class',type,data})};
}
const study={id:'test-id',title:'Love',notes:'Remember context.',sessionId:null,updatedAt:'2026-10-16T12:00:00Z',request:{query:'love',language:'auto',translation:'NASB',filters:{corpus:'',book:0,form:''},page:0},visibility:{root:true,derivation:true,synonym:true,antonym:true,related:true}};
test('saved studies round-trip with updates and deletion',async()=>{
 const f=fixture();await f.call('class_word_save',{study});assert.deepEqual(await f.call('class_word_studies',{}),[study]);
 await f.call('class_word_save',{study:{...study,notes:'Updated'}});assert.equal((await f.call('class_word_studies',{}))[0].notes,'Updated');
 await f.call('class_word_delete',{id:study.id});assert.deepEqual(await f.call('class_word_studies',{}),[]);f.sql.close();
});
test('attached studies round-trip through session export/import with local session IDs',async()=>{
 const a=fixture(),b=fixture();const session=await a.call('class_session_create',{title:'Class',taughtOn:'2026-10-16'});
 await a.call('class_word_save',{study:{...study,sessionId:session.id}});
 const payload=await a.call('class_export_session',{sessionId:session.id});assert.equal(payload.wordStudies.length,1);
 await b.call('class_session_create',{title:'Unrelated',taughtOn:'2026-10-15'});
 await b.call('class_import_session',{json:JSON.stringify(payload),mergePolicy:'lww'});
 const restored=(await b.call('class_word_studies',{}))[0];assert.equal(restored.sessionId,2);assert.equal(restored.notes,study.notes);
 a.sql.close();b.sql.close();
});
test('schema upgrade preserves existing Class data and validates imported studies',async()=>{
 const f=fixture();f.sql.exec("UPDATE _meta SET value='2' WHERE key='schema_version'");const session=await f.call('class_session_create',{title:'Keep me',taughtOn:'2026-10-16'});applySchema(f.db);
 assert.equal(f.db.get("SELECT value FROM _meta WHERE key='schema_version'").value,'3');assert.equal((await f.call('class_session_get',{sessionId:session.id})).title,'Keep me');
 await assert.rejects(()=>f.call('class_word_save',{study:{...study,request:{...study.request,translation:'BAD'}}}),/Invalid saved/);f.sql.close();
});
