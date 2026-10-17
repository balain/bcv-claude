import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const dir=mkdtempSync(join(tmpdir(),'bcv-word-tests-'));
const source=readFileSync(new URL('../src/lib/wordStudy/engine.ts',import.meta.url),'utf8');
writeFileSync(join(dir,'engine.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText);
const { createWordStudyEngine, englishWords, strongKey }=await import(pathToFileURL(join(dir,'engine.mjs')));
after(()=>rmSync(dir,{recursive:true,force:true}));
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE lex_brief(estrong,dstrong,ustrong,lang,lemma,gloss,translit,morph,meaning_plain);
 CREATE TABLE tokens(id INTEGER PRIMARY KEY,corpus,book_id,chapter,verse,surface,lemma,strong,morph);
 CREATE VIRTUAL TABLE tokens_fts USING fts5(surface,lemma);
 CREATE TABLE verses(book_id,chapter,verse,translation,text);
 CREATE TABLE book_meta(id,name,abbr3);
 INSERT INTO book_meta VALUES(1,'Genesis','Gen'),(43,'John','Jhn');
 INSERT INTO lex_brief VALUES('G0026','G0026',null,'Grk','ἀγάπη','love','agapē','','definition');
 INSERT INTO tokens VALUES(1,'GNT',43,1,1,'ἀγάπη','ἀγάπη','G0026','N'),(2,'GNT',43,1,1,'ἀγάπην','ἀγάπη','G0026','N'),(3,'GNT',43,1,2,'ἄλλος','ἄλλος','G0243','N'),(4,'LXX',1,1,1,'ἀγάπη','ἀγάπη','G0026','N');
 INSERT INTO tokens_fts(rowid,surface,lemma) SELECT id,surface,lemma FROM tokens;
 INSERT INTO verses VALUES(43,1,1,'NASB','Love love beloved.'),(43,1,2,'NASB','Do not clove.'),(1,1,1,'NASB','Love.'),(43,1,1,'KJV','Charity.');`);
 const engine=createWordStudyEngine({rows:(sql,bind=[])=>db.prepare(sql).all(...bind).map(row=>Object.values(row))});
 return {db,engine};
}
const req=(query,extra={})=>({query,translation:'NASB',language:'auto',filters:{corpus:'',book:0,form:''},page:0,...extra});
test('English word boundaries count repetitions without substring matches',()=>{
 const {db,engine}=fixture();const r=engine.run(req('love'));
 assert.equal(r.frequencies[0].count,3);assert.equal(r.totalVerses,2);assert.equal(r.frequencies[0].denominator,7);
 assert.equal(engine.run(req('love',{translation:'KJV'})).frequencies[0].count,0);
 db.close();
});
test('lemma counts, distinct verses, corpus denominators and exact forms',()=>{
 const {db,engine}=fixture();const r=engine.run(req('G26'));
 assert.deepEqual(r.frequencies.map(f=>[f.corpus,f.count,f.verses,f.denominator]),[['LXX',1,1,1],['GNT',2,1,3]]);
 assert.equal(r.totalVerses,2);
 const f=engine.run(req('G26',{filters:{corpus:'GNT',book:43,form:'ἀγάπην'}}));
 assert.equal(f.frequencies[0].count,1);assert.equal(f.frequencies[0].denominator,3);assert.equal(f.forms[0].surface,'ἀγάπην');db.close();
});
test('normalized lemma, transliteration and inflected surface resolve',()=>{
 const {db,engine}=fixture();for(const q of ['αγαπη','agape','ἀγάπην'])assert.equal(engine.run(req(q,{language:'Grk'})).target.strong,'G0026');db.close();
});
test('normalized homographs require selection and do not merge counts',()=>{
 const {db,engine}=fixture();db.exec("INSERT INTO lex_brief VALUES('G9999','G9999',null,'Grk','ἀγαπη','other','other','','')");
 const r=engine.run(req('αγαπη'));assert.equal(r.candidates.length,2);assert.equal(r.target,null);db.close();
});
test('passages paginate independently of full counts',()=>{
 const {db,engine}=fixture();const insert=db.prepare("INSERT INTO tokens VALUES(?,'GNT',43,1,?,'ἀγάπη','ἀγάπη','G0026','N')");for(let i=5;i<250;i++)insert.run(i,i);
 const r=engine.run(req('G26',{filters:{corpus:'GNT',book:0,form:''}}));assert.equal(r.frequencies[0].count,247);assert.equal(r.passages.length,40);assert.equal(r.totalVerses,246);
 const next=engine.run(req('G26',{filters:{corpus:'GNT',book:0,form:''},page:1}));assert.equal(next.frequencies[0].count,247);assert.notEqual(next.passages[0].verse,r.passages[0].verse);db.close();
});
test('apostrophes and Strong identifiers normalize without inventing identities',()=>{
 assert.deepEqual(englishWords("God’s well-loved love"),["god's","well","loved","love"]);assert.equal(strongKey('A2'),'H0002');assert.equal(strongKey('g26a'),'G0026a');assert.equal(strongKey('oops'),'');
});
test('unpointed Hebrew homographs use identifier evidence instead of merging languages',()=>{
 const {db,engine}=fixture();db.exec(`INSERT INTO lex_brief VALUES('H0001','H0001',null,'Heb','אָב','father','av','',''),('H0002','H0002',null,'Heb','אַב','father','av','','');
 INSERT INTO tokens VALUES(300,'WLC',1,1,1,'אָב','אב','H0001','Hebrew'),(301,'WLC',1,1,2,'אַב','אב','H0002','Aramaic');
 CREATE TABLE word_languages(strong,language);INSERT INTO word_languages VALUES('H0001','Hebrew'),('H0002','Aramaic');`);
 const r=engine.run(req('A2',{language:'Arc'}));assert.equal(r.target.language,'Aramaic');assert.equal(r.frequencies[0].count,1);assert.equal(r.passages[0].verse,2);db.close();
});
test('surface resolution joins Unicode spelling variants without losing identity',()=>{
 const {db,engine}=fixture();db.exec("UPDATE lex_brief SET lemma='ἀγάπη' WHERE estrong='G0026'");
 const r=engine.run(req('ἀγάπην',{language:'Grk'}));assert.equal(r.target.strong,'G0026');assert.equal(r.frequencies.find(f=>f.corpus==='GNT').count,2);db.close();
});
test('a corpus word remains studyable when its brief lexical entry is missing',()=>{
 const {db,engine}=fixture();const r=engine.run(req('ἄλλος',{language:'Grk'}));assert.equal(r.target.lemma,'ἄλλος');assert.equal(r.entries.length,0);assert.equal(r.frequencies.find(f=>f.corpus==='GNT').count,1);db.close();
});
test('English studies show sourced relationships with original-language provenance',()=>{
 const {db,engine}=fixture();db.exec(`CREATE TABLE word_relations(lemma_key,lang,kind,target_lemma,source,context);
 INSERT INTO word_relations VALUES('αγαπη','Grk','related','ἀγαπάω','ubs-greek','UBS related lemma');`);
 const english=engine.run(req('love'));
 assert.equal(english.relations.length,1);assert.equal(english.relations[0].lemma,'ἀγαπάω');assert.equal(english.relations[0].origin.strong,'G0026');assert.equal(english.relations[0].lang,'Grk');
 const greek=engine.run(req('G26'));assert.equal(greek.relations.length,1);assert.equal(greek.relations[0].origin,undefined);db.close();
});
test('English relationship discovery does not duplicate display aliases',()=>{
 const {db,engine}=fixture();db.exec(`CREATE TABLE word_relations(lemma_key,lang,kind,target_lemma,source,context);
 INSERT INTO word_relations VALUES('αγαπη','Grk','related','ἀγαπάω','ubs-greek','UBS related lemma');
 INSERT INTO lex_brief VALUES('G0026','G0026a',null,'Grk','ἀγάπη','love','agapē','','');`);
 assert.equal(engine.run(req('love')).relations.length,1);db.close();
});
function seedEquivalents(db){
 db.exec(`CREATE TABLE macula_equivalents(morph_id,book_id,chapter,verse,word_num,hebrew_surface,hebrew_strong,greek_surface,greek_strong,greek_key,hebrew_token_id,lxx_token_id,hebrew_status,greek_status);
 CREATE TABLE macula_metadata(key,value);INSERT INTO macula_metadata VALUES('revision','pinned-test'),('counts','{"excluded_private_or_nonlexical_ids":4}');
 INSERT INTO lex_brief VALUES('H0001','H0001',null,'Heb','אָב','father','av','','');
 INSERT INTO tokens VALUES(100,'WLC',1,1,1,'אָב','אב','H0001','N');
 INSERT INTO macula_equivalents VALUES('one',1,1,1,1,'אָב','H0001','ἀγάπη','G0026','αγαπη',100,4,'validated','surface_and_identifier'),('two',1,1,2,1,'אָב','H0001','ἀγάπη','G0026','αγαπη',null,null,'unmatched','unresolved'),('three',1,1,3,1,'אָב','H0001','',null,'',null,null,'unmatched','not_provided');`);
}
test('MACULA forward and reverse queries preserve coverage, missingness and source evidence',()=>{
 const {db,engine}=fixture();seedEquivalents(db);
 const heb=engine.run(req('H1'));assert.equal(heb.equivalents.sourceRecords,3);assert.equal(heb.equivalents.greekProvided,2);assert.equal(heb.equivalents.greekChecked,1);assert.equal(heb.equivalents.hebrewValidated,1);assert.equal(heb.equivalents.groups[0].records,2);assert.equal(heb.equivalents.evidence[2].greekStatus,'not_provided');
 const greek=engine.run(req('G26'));assert.equal(greek.equivalents.sourceRecords,2);assert.equal(greek.equivalents.groups[0].strong,'H0001');assert.equal(greek.equivalents.globalExcluded,4);
 assert.equal(engine.run(req('G26',{filters:{corpus:'GNT',book:0,form:''}})).equivalents.applicable,false);
 assert.equal(engine.run(req('love')).equivalents.applicable,false);db.close();
});
test('MACULA form/book filters and evidence pagination do not change complete counts',()=>{
 const {db,engine}=fixture();seedEquivalents(db);
 assert.equal(engine.run(req('H1',{filters:{corpus:'WLC',book:1,form:'אָב'}})).equivalents.sourceRecords,1);
 assert.equal(engine.run(req('G26',{filters:{corpus:'LXX',book:43,form:''}})).equivalents.sourceRecords,0);
 const add=db.prepare("INSERT INTO macula_equivalents VALUES(?,1,1,?,1,'אָב','H0001','ἀγάπη','G0026','αγαπη',null,null,'unmatched','unresolved')");for(let i=4;i<=60;i++)add.run('m'+i,i);
 const page=engine.run(req('H1',{equivalentPage:1})).equivalents;assert.equal(page.sourceRecords,60);assert.equal(page.evidence.length,20);assert.equal(page.groups[0].records,59);db.close();
});
test('base Strong numbers resolve extended entries without pretending to distinguish their token senses',()=>{
 const {db,engine}=fixture();db.exec("INSERT INTO lex_brief VALUES('H1254a','H1254A',null,'Heb','בָּרָא','create','bara','',''),('H1254b','H1254B',null,'Heb','בָּרָא','fatten','bara','',''); INSERT INTO tokens VALUES(300,'WLC',1,1,1,'בָּרָא','ברא','H1254','V');");
 const choice=engine.run(req('H1254'));assert.equal(choice.candidates.length,2);assert.equal(choice.target,null);
 const chosen=engine.run(req('H1254a'));assert.equal(chosen.target.strong,'H1254a');assert.equal(chosen.frequencies[0].count,1);assert.ok(chosen.warnings.some(w=>w.includes('extended entries')));db.close();
});

test('English definition matches expose relationships absent from short glosses',()=>{
 const {db,engine}=fixture();
 db.exec(`INSERT INTO lex_brief VALUES('H2617a','H2617a',null,'Heb','חֶסֶד','kindness','chesed','','kindness, lovingkindness');
 CREATE TABLE word_relations(lemma_key,lang,kind,target_lemma,source,context);
 INSERT INTO word_relations VALUES('חסד','Heb','synonym','אֱמֶת','ubs-hebrew','Sourced synonym');`);
 const r=engine.run(req('lovingkindness'));
 assert.equal(r.relations.length,1);
 assert.equal(r.relations[0].origin.strong,'H2617a');
 assert.match(r.candidates.find(c=>c.strong==='H2617a').reason,/definition match/);
 assert.equal(engine.run(req('loving')).relations.length,0);
 db.close();
});
