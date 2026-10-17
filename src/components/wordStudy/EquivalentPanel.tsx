import type { EquivalentReport, StudyTarget, StudyPassage, StudyRequest } from '../../lib/wordStudy/types';
export function EquivalentPanel({report,target,request,onStudy,onPage,onPassage}: {
  report:EquivalentReport; target:StudyTarget; request:StudyRequest;
  onStudy:(word:string,language:string)=>void; onPage:(page:number)=>void; onPassage:(p:StudyPassage)=>void;
}) {
  const page=request.equivalentPage??0;
  if(!report.available)return <p>MACULA Hebrew–LXX equivalents are not installed in this Bible database. Update the data and refresh the Bible database to enable them.</p>;
  if(!report.applicable)return <p>{target.lang==='Eng'?'Select a Hebrew or Greek lexical candidate above to explore its recorded Hebrew–LXX equivalents. English gloss matches are not verified renderings.':'Select LXX or all Greek corpora to explore Hebrew–LXX equivalents. GNT usage is a separate corpus.'}</p>;
  return <>
    <p>MACULA records Hebrew morphemes with Greek equivalents from the Septuagint. These are source annotations, not universal dictionary equivalences. The Hebrew reference is preserved; matching a Greek word at that reference does not establish alignment across different verse-numbering systems.</p>
    <h3>Source coverage</h3><p>Within this dictionary identifier and selected book/form scope:</p>
    <dl className="ws-equivalent-stats">
      <div><dt>Source records</dt><dd>{report.sourceRecords.toLocaleString()}</dd></div>
      <div><dt>Hebrew matched to our text</dt><dd>{report.hebrewValidated.toLocaleString()} <small>({report.sourceRecords?Math.round(report.hebrewValidated/report.sourceRecords*100):0}%)</small></dd></div>
      <div><dt>Greek equivalent provided</dt><dd>{report.greekProvided.toLocaleString()}</dd></div>
      <div><dt>Greek surface/identifier checked at stored reference</dt><dd>{report.greekChecked.toLocaleString()}</dd></div>
    </dl>
    <p className="ws-muted">Source dictionary numbers do not distinguish all extended lexicon senses or merge every inflected identifier. Counts are source morpheme records, not distinct verses or a percentage of every biblical occurrence. Missing Greek annotations do not establish an omission. Private, nonlexical, or unsupported MACULA identifiers were excluded ({report.globalExcluded.toLocaleString()} source records across the dataset).</p>
    {!report.sourceRecords&&<p>No source records found for this selection. This does not establish that the word has no LXX counterpart.</p>}
    {report.groups.length>0&&<div className="ws-table-wrap" tabIndex={0} role="region" aria-label="Equivalent counts; scroll horizontally on narrow screens"><table><caption>{target.lang==='Heb'?'Recorded Greek equivalents':'Hebrew sources of recorded Greek equivalents'}</caption><thead><tr><th>Representative source form</th><th>Dictionary identifier</th><th>Source records</th><th>Greek checks</th></tr></thead><tbody>{report.groups.map((group,i)=><tr key={i}><td dir="auto">{group.surface}</td><td>{group.strong?<button onClick={()=>onStudy(group.strong,target.lang==='Heb'?'Grk':'Heb')}>{group.strong} →</button>:'Identifier unresolved'}</td><td>{group.records}</td><td>{group.checked}</td></tr>)}</tbody></table></div>}
    <details open><summary>Passage evidence ({report.sourceRecords.toLocaleString()} records)</summary>
      {report.evidence.map(row=><article key={row.morphId} className="ws-passage"><button onClick={()=>onPassage({bookId:row.bookId,book:row.book,abbr:row.abbr,chapter:row.chapter,verse:row.verse,text:'',words:'',corpus:'WLC'})}>{row.book} {row.chapter}:{row.verse} →</button><p><span dir="rtl">{row.hebrew}</span> · {row.hebrewStrong} → <span dir="ltr">{row.greek||'Greek annotation not provided'}</span> {row.greekStrong}</p><small>Hebrew: {row.hebrewStatus}. Greek: {row.greekStatus==='surface_and_identifier'?'surface and identifier corroborated at stored reference':row.greekStatus.replace(/_/g,' ')}. Source morpheme: {row.morphId}.</small></article>)}
      {report.sourceRecords>0&&<div className="ws-pagination"><button disabled={page===0} onClick={()=>onPage(page-1)}>Previous evidence</button><span>Evidence page {page+1} of {Math.ceil(report.sourceRecords/40)}</span><button disabled={(page+1)*40>=report.sourceRecords} onClick={()=>onPage(page+1)}>Next evidence</button></div>}
    </details>
    <p className="ws-muted">MACULA Hebrew Linguistic Datasets © 2022–2024 Biblica, Inc. · CC BY 4.0 · Revision {report.revision}. <a href="https://github.com/Clear-Bible/macula-hebrew" target="_blank" rel="noreferrer">Source and attribution</a></p>
  </>;
}
