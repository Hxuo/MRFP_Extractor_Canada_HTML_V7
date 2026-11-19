/* Brompton Funds Limited -- split-share corporations and CAD/USD ETFs.
 * Source-based manager/title identity; no fund-name, ticker, report-year,
 * MER/PTR value or PDF page-index allowlist. The two financial table
 * layouts are intentionally separate, with fail-closed source evidence.
 */
// @mrfp:profile
const profile_brompton={
 key:'brompton',label:'Brompton Funds Limited',style:'brompton',
 signatures:[
  // Detection requires an explicit management role, not the manager name in
  // an ETF holding, mailing address, or competing manager's related parties.
  /\bTHE\s+FUND\s*\nBrompton[^\n]{8,150}\s+is\s+a\s+mutual\s+fund\s+(?:corporation|trust)\s+managed\s+by\s+Brompton\s+Funds\s+Limited\b/i,
  /\bBrompton\s+Funds\s+Limited\b/i
 ],
 // Ownership must be established by a manager statement. Cover titles alone
 // cannot register an unfamiliar issuer as Brompton (dynamic title is below).
 title:null
};
const fmcConfig_brompton={allowRowFallback:false,titleScanPages:2};

// @mrfp:extraction
function bromptonClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function bromptonCompact(s){return bromptonClean(s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function bromptonHasNamedUnits(pages){
 return pages.some(pg=>String(pg.text||'').split(/\r?\n/).some(line=>/^(?:CAD|USD)\s+Units\b/i.test(bromptonClean(line))));
}
function bromptonDocument(pages){
 if(!Array.isArray(pages)||pages.length<3)return null;
 const cover=String(pages[0]?.text||''),body=String(pages[1]?.text||'');
 const coverLines=cover.split(/\r?\n/).map(bromptonClean),lines=body.split(/\r?\n/).map(bromptonClean);
 const m=/^(Brompton\s+[A-Za-z0-9 &'’().,\-]{4,140}?(?:ETF|Corp\.?))\s+[-–—]\s+(Annual|Interim)\b/i.exec(lines[0]||'');
 if(!m)return null;
 const title=m[1],fl=lines.indexOf('THE FUND');if(fl<0||fl>=lines.length-1)return null;
 const ownership=/^(Brompton\s+[A-Za-z0-9 &'’().,\-]{4,140}?(?:ETF|Corp\.?))\s+is\s+a\s+mutual\s+fund\s+(corporation|trust)\s+managed\s+by\s+Brompton\s+Funds\s+Limited\b/i.exec(lines[fl+1]||'');
 if(!ownership||bromptonClean(ownership[1])!==title)return null;
 const kind=ownership[2].toLowerCase()==='corporation'?'split':'etf';
 if(kind==='etf'&&!/\bETF$/i.test(title))return null;
 if(kind==='split'&&!/\bCorp\.$/i.test(title))return null;
 if(!bromptonCompact(cover).includes(bromptonCompact(title)))return null;
 const type=m[2].toLowerCase();
 if(type==='annual'&&!/^Annual\b/i.test(coverLines[0]||''))return null;
 if(type==='interim'&&!/^Interim\b/i.test(coverLines[0]||''))return null;
 const yr=(coverLines.slice(0,3).join(' ').match(/\b20\d{2}\b/g)||[]);
 if(yr.length!==1)return null;
 const year=Number(yr[0]),date=String(year)+(type==='annual'?'-12-31':'-06-30');
 const fullBody=pages.slice(1,5).map(pg=>String(pg.text||'')).join('\n');
 const periodRx=type==='annual'?new RegExp('(?:year|period)\\s+ended\\s+December\\s+31,?\\s+'+year,'i'):
   new RegExp('(?:period|six.month\\s+period)\\s+ended\\s+June\\s+30,?\\s+'+year,'i');
 if(!periodRx.test(fullBody))return null;
 return {title,kind,date,year,hasNamedUnits:kind==='etf'&&bromptonHasNamedUnits(pages)};
}
function identifyFundEarly_brompton(pages){return bromptonDocument(pages)?.title||'Unknown Fund';}
function selectReportDate_brompton(pages){return bromptonDocument(pages)?.date||null;}
const bromptonRatioSection=/^Ratios and Supplemental Data\s*\(Based on Net Asset Value\)$/i;
const bromptonMerSplit=/^Management expense ratio\s*\(\s*[“”"'‘’]?MER[“”"'‘’]?\s*\)\s*[–—\-]?\s*Class\s+[A-Z][A-Z0-9-]*\b/i;
const bromptonMerEtf=/^Management expense ratio\s*\(\s*[“”"'‘’]?MER[“”"'‘’]?\s*\)(?!\s*[–—\-]?\s*Class\s+A\b)/i;
function bromptonRatioValuesFromLabel(line){
 // Only the reporting-period cell must be numeric; an older column may
 // explicitly say n/a (or show a dash). Keep the placeholder in position so
 // a missing historical value cannot shift the current-year column.
 const raw=String(line||'');
 const first=/\d{1,3}(?:\.\d{1,3})?\s*%/.exec(raw);
 if(!first)return []; // the CURRENT-period value must be numeric
 return [...raw.slice(first.index).matchAll(/(?:^|\s)(\d{1,3}(?:\.\d{1,3})?\s*%|n\s*\/\s*a|[–—−])(?=\s|$)/gi)]
   .map(m=>/\d/.test(m[1])&&!/n\s*\/\s*a/i.test(m[1])?Number(m[1].replace('%','').trim()):null);
}
function bromptonTableSections(page,doc,previousPage){
 const lines=String(page.text||'').split(/\r?\n/).map(bromptonClean),found=[];
 const anchors=lines.flatMap((line,i)=>bromptonRatioSection.test(line)?[i]:[]);
 // On a continued ETF ratios page, the next unit block begins directly
 // with "USD Units"/"CAD Units"; the ratios title is not repeated.
 // Accept this only when the immediately preceding page begins a validated
 // ratios section and this page contains the complete metric trio.
 if(!anchors.length&&doc.kind==='etf'&&previousPage
    &&/Ratios and Supplemental Data\s*\(Based on Net Asset Value\)/i.test(previousPage.text||'')
    &&lines.slice(1,5).some(l=>/^(?:CAD|USD)\s+Units\b/i.test(l))
    &&lines.some(l=>/^Portfolio turnover rate\b/i.test(l))
    &&lines.some(l=>/^MER before expense absorption\b/i.test(l)))anchors.push(-1);
 for(const i of anchors){
  const end=Math.min(lines.length,i+45);
  const h=lines.slice(i+1,Math.min(i+7,end)).findIndex(s=>/^As at\b/i.test(s));
  if(h<0)continue;
  const header=lines[i+1+h],years=[...header.matchAll(/\b20\d{2}\b/g)].map(x=>Number(x[0]));
  if(years.length<2||years.length>7||years[0]!==doc.year||years.some((y,j)=>j>0&&y>=years[j-1]))continue;
  if(doc.date.endsWith('06-30')&&!/^As at\s+June\s+30,?\s+20\d{2}\b/i.test(header))continue;
  if(doc.date.endsWith('12-31')&&!/^As at\s+December\s+31\b/i.test(header))continue;
  const unitLines=lines.slice(i+1,i+1+h),unitMatches=unitLines.map(s=>/^(CAD|USD)\s+Units\b/i.exec(s)).filter(Boolean);
  let cls=null;
  if(doc.kind==='etf'){
   if(unitMatches.length===1){
    cls=unitMatches[0][1].toUpperCase()+' Units';
   }else if(!unitMatches.length&&i>=0&&!doc.hasNamedUnits){
    // Single-unit ETF: the fund has no independently named Class/Series.
    // Require a full, standalone ratios table with unit/share identity;
    // do not turn an ambiguous TLF continuation into a single-unit row.
    const block=lines.slice(i+1+h,end);
    if(!block.some(l=>/^Number of units outstanding\b/i.test(l))||
       !block.some(l=>/^Net Asset Value per unit\b/i.test(l)))continue;
    cls=doc.title; // project-wide full Fund Name Class fallback
   }else continue;
  }else{
   if(unitMatches.length)continue;
   const named=mrfpV7IndependentRatioClass(page,doc.date);
   // For a split-share ratio panel the MER label itself must independently
   // name the class. 'Preferred shares' NAV columns alone are not ratio data.
   const printedClass=/\bClass\s+([A-Z][A-Z0-9-]*)\b/i.exec(lines.find(l=>bromptonMerSplit.test(l))||'');
   cls=named||'Class A';
   if(!printedClass||('Class '+printedClass[1].toUpperCase())!==cls)continue;
  }
  // Stop at the first NAV-per-unit row: material after the table can
  // contain a second "Portfolio turnover rate" phrase in a footnote.
  const tableEnd=lines.findIndex((l,j)=>j>i+1+h&&/^Net Asset Value per unit\b/i.test(l));
  const slice=lines.slice(i+1+h,tableEnd>i+1+h?tableEnd:end);
  const mer=slice.filter(l=>(doc.kind==='split'?bromptonMerSplit:bromptonMerEtf).test(l));
  const ptr=slice.filter(l=>/^Portfolio turnover rate\b/i.test(l));
  const trading=slice.filter(l=>/^Trading expense ratio\b/i.test(l));
  const before=slice.filter(l=>/^MER before expense absorption\b/i.test(l));
  if(mer.length!==1||ptr.length!==1||trading.length!==1)continue;
  if(doc.kind==='etf'&&before.length!==1)continue;
  if(doc.kind==='split'&&before.length!==0)continue;
  const mers=bromptonRatioValuesFromLabel(mer[0]),ptrs=bromptonRatioValuesFromLabel(ptr[0]),trades=bromptonRatioValuesFromLabel(trading[0]);
  if([mers,ptrs,trades].some(x=>x.length!==years.length))continue;
  if(doc.kind==='etf'&&bromptonRatioValuesFromLabel(before[0]).length!==years.length)continue;
  // Historical n/a is allowed, but every current-period published metric
  // MUST be numeric and bounded. Reject current-period n/a, not as zero.
  if(!Number.isFinite(mers[0])||mers[0]<0||mers[0]>100||
     !Number.isFinite(ptrs[0])||ptrs[0]<0||ptrs[0]>10000||
     !Number.isFinite(trades[0])||trades[0]<0||trades[0]>100)continue;
  if(doc.kind==='etf'){
   const beforeValues=bromptonRatioValuesFromLabel(before[0]);
   if(!Number.isFinite(beforeValues[0])||beforeValues[0]<0||beforeValues[0]>100)continue;
  }
  if([mers,ptrs,trades].some((a,k)=>a.slice(1).some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>(k===1?10000:100)))))continue;
  found.push({cls,mer:mers[0],ptr:ptrs[0],page:page.page});
 }
 return found;
}
function extract_brompton(pages,p,fund,date){
 const doc=bromptonDocument(pages);
 if(!doc||fund!==doc.title||date!==doc.date)return [];
 const byClass=new Map(),repeated=new Set();
 for(let pi=0;pi<pages.length;pi++)for(const item of bromptonTableSections(pages[pi],doc,pi>0?pages[pi-1]:null)){
  if(byClass.has(item.cls))repeated.add(item.cls);else byClass.set(item.cls,item);
 }
 for(const cls of repeated)byClass.delete(cls);
 // A split-share MRFP publishes an actual MER for Class A shares only;
 // Preferred shares cannot be manufactured from NAV/share performance.
 // ETF CAD and USD units have separately printed ratios and evidence.
 return [...byClass.values()].map(r=>({cls:r.cls,quality:3,
  values:{MER:r.mer,PTR:r.ptr,TER:null},
  evidence:{MER:{page:r.page,source:'Published current-period Management Expense Ratio, '+r.cls,method:'native-js'},
   PTR:{page:r.page,source:'Published current-period Portfolio Turnover Rate, '+(doc.kind==='etf'?r.cls:'underlying fund'),method:'native-js'}}
 }));
}
function auditRatioHeadings_brompton(text,potential){
 const lines=String(text||'').split(/\r?\n/).map(bromptonClean);
 // Standalone continuation block, with published ratio metrics and year.
 if(!lines.some(s=>bromptonRatioSection.test(s))&&
   lines.slice(1,5).some(s=>/^(?:CAD|USD)\s+Units\b/i.test(s))&&
   lines.some(s=>bromptonMerEtf.test(s))&&lines.some(s=>/^Portfolio turnover rate\b/i.test(s))){
    const u=lines.slice(1,5).map(s=>/^(CAD|USD)\s+Units\b/i.exec(s)).find(Boolean);
    if(u)potential.add(u[1].toUpperCase()+' Units');
 }

 for(let i=0;i<lines.length;i++)if(bromptonRatioSection.test(lines[i])){
  const units=lines.slice(i+1,i+4).map(s=>/^(CAD|USD)\s+Units\b/i.exec(s)).filter(Boolean);
  if(units.length===1)potential.add(units[0][1].toUpperCase()+' Units');
  else if(!units.length&&lines.slice(i+1,i+12).some(s=>bromptonMerSplit.test(s)))potential.add('Class A');
  else if(!units.length&&lines.slice(i+1,i+16).some(s=>bromptonMerEtf.test(s))&&
          lines.slice(i+1,i+16).some(s=>/^Number of units outstanding\b/i.test(s))){
   const title=/^(Brompton\s+[A-Za-z0-9 &'’().,\-]{4,140}?(?:ETF))\s+[-–—]\s+(?:Annual|Interim)\b/i.exec(lines[0]||'');
   if(title)potential.add(title[1]);
  }
 }
}

// @mrfp:evidence
const evidencePolicy_brompton={stamps:{bromptonRatioEvidenceVersion:1}};
function bromptonEvClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function bromptonEvCompact(s){return bromptonEvClean(s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function bromptonEvDocument(pages){
 if(!pages?.length||pages.length<3)return null;
 const cover=String(pages[0]?.text||''),body=String(pages[1]?.text||'');
 const l=body.split(/\r?\n/).map(bromptonEvClean),m=/^(Brompton\s+[A-Za-z0-9 &'’().,\-]{4,140}?(?:ETF|Corp\.?))\s+[-–—]\s+(Annual|Interim)\b/i.exec(l[0]||'');
 if(!m)return null;
 const ix=l.indexOf('THE FUND');if(ix<0||ix+1>=l.length)return null;
 const owner=/^(Brompton\s+[A-Za-z0-9 &'’().,\-]{4,140}?(?:ETF|Corp\.?))\s+is\s+a\s+mutual\s+fund\s+(corporation|trust)\s+managed\s+by\s+Brompton\s+Funds\s+Limited\b/i.exec(l[ix+1]);
 if(!owner||owner[1]!==m[1]||!bromptonEvCompact(cover).includes(bromptonEvCompact(m[1])))return null;
 const kind=owner[2].toLowerCase()==='corporation'?'split':'etf';
 if((kind==='split'&&!/Corp\.$/.test(m[1]))||(kind==='etf'&&!/ETF$/.test(m[1])))return null;
 const type=m[2].toLowerCase(),first=cover.split(/\r?\n/).slice(0,3).map(bromptonEvClean).join(' ');
 if(!new RegExp('^'+(type==='annual'?'Annual':'Interim')+'\\b','i').test(first))return null;
 const yr=first.match(/\b20\d{2}\b/g);if(!yr||yr.length!==1)return null;
 const date=yr[0]+(type==='annual'?'-12-31':'-06-30');
 const periodRx=type==='annual'?new RegExp('(?:year|period)\\s+ended\\s+December\\s+31,?\\s+'+yr[0],'i'):
 new RegExp('(?:period|six.month\\s+period)\\s+ended\\s+June\\s+30,?\\s+'+yr[0],'i');
 if(!periodRx.test(pages.slice(1,5).map(p=>p.text||'').join('\n')))return null;
 return {title:m[1],date,kind,year:Number(yr[0]),
  hasNamedUnits:kind==='etf'&&pages.some(pg=>String(pg.text||'').split(/\r?\n/).some(line=>/^(?:CAD|USD)\s+Units\b/i.test(bromptonEvClean(line))))};
}
function validateDocumentEvidence_brompton(pages,row){
 const d=bromptonEvDocument(pages);
 if(!d||row?.fmc_key!=='brompton'||row.fund_name!==d.title||row.report_date!==d.date)return false;
 if(d.kind==='split'&&row.class_name!=='Class A'){
  if(!pages.some(pg=>mrfpV7IndependentRatioClass(pg,row.report_date)===row.class_name))return false;
 }
 if(d.kind==='etf'&&!/^(?:CAD|USD) Units$/.test(row.class_name||'')&&row.class_name!==d.title)return false;
 if(d.kind==='etf'&&row.class_name===d.title&&d.hasNamedUnits)return false;
 return true;
}
function bromptonEvRatioLine(l){return /^Ratios and Supplemental Data\s*\(Based on Net Asset Value\)$/i.test(l.text);}
function bromptonEvHeader(lines,anchor,doc){
 for(let j=anchor+1;j<Math.min(lines.length,anchor+8);j++){
  const line=lines[j];if(!/^As at\b/i.test(line.text))continue;
  const years=[...line.text.matchAll(/\b20\d{2}\b/g)].map(m=>Number(m[0]));
  if(years.length<2||years.length>7||years[0]!==doc.year||years.some((y,i)=>i>0&&y>=years[i-1]))return null;
  if(doc.date.endsWith('06-30')&&!/^As at\s+June\s+30,?\s+20\d{2}/i.test(line.text))return null;
  if(doc.date.endsWith('12-31')&&!/^As at\s+December\s+31\b/i.test(line.text))return null;
  const first=line.items.filter(it=>it.x>205&&/\b20\d{2}\b/.test(bromptonEvClean(it.str))).sort((a,b)=>a.x-b.x)[0];
  if(!first||!new RegExp('\\b'+doc.year+'\\b').test(first.str))return null;
  return {index:j,expectedCount:years.length,firstCenter:first.x+first.w/2};
 }
 return null;
}
function locateCell_brompton(page,lines,row,key,value){
 if(!['MER','PTR'].includes(key)||!Number.isFinite(Number(value))||!Number.isInteger(page?.page)||!Array.isArray(lines))return null;
 const printed=mrfpV7IndependentRatioClass(page,row.report_date);
 const isRow=/^(?:CAD|USD) Units$/.test(row.class_name||'')?'etf':
   (row.class_name==='Class A'||(printed===row.class_name&&/^Class\s+/.test(printed)))?'split':row.class_name===row.fund_name?'single':null;
 if(!isRow)return null;
 if(!bromptonEvClean(page.text||'').startsWith(bromptonEvClean(row.fund_name)+' - '))return null;
 const doc={year:Number(row.report_date?.slice(0,4)),date:row.report_date,kind:isRow};if(!doc.year)return null;
 const candidates=[];
 const anchors=lines.flatMap((l,i)=>bromptonEvRatioLine(l)?[i]:[]);
 // Physical continuation page has no repeated ratios heading; require
 // the unit label near the top plus an explicit valid table and year.
 if(isRow==='etf'&&!anchors.length&&lines.slice(1,5).some(l=>/^(CAD|USD)\s+Units\b/i.test(l.text))&&
    lines.some(l=>/^MER before expense absorption\b/i.test(l.text))&&
    lines.some(l=>/^Portfolio turnover rate\b/i.test(l.text)))anchors.push(-1);
 for(const i of anchors){
  const h=bromptonEvHeader(lines,i,doc);if(!h)continue;
  const between=lines.slice(i+1,h.index),units=between.flatMap(l=>l.items.map(it=>/^(CAD|USD)\s+Units\b/i.exec(bromptonEvClean(it.str)))).filter(Boolean);
  if(isRow==='etf'){
   if(units.length!==1||units[0][1].toUpperCase()+' Units'!==row.class_name)continue;
  }else if(isRow==='single'){
   if(i<0||units.length||
      !lines.slice(h.index+1,Math.min(lines.length,h.index+22)).some(l=>/^Number of units outstanding\b/i.test(l.text))||
      !lines.slice(h.index+1,Math.min(lines.length,h.index+22)).some(l=>/^Net Asset Value per unit\b/i.test(l.text)))continue;
  }else if(units.length)continue;
  const stop=lines.findIndex((l,j)=>j>h.index&&/^Net Asset Value per unit\b/i.test(l.text));
  const sec=lines.slice(h.index+1,stop>h.index?stop:Math.min(lines.length,h.index+22));
  const merRx=isRow!=='split'?/^Management expense ratio\s*\(\s*[“”"'‘’]?MER[“”"'‘’]?\s*\)\s*$/i:
   /^Management expense ratio\s*\(\s*[“”"'‘’]?MER[“”"'‘’]?\s*\)\s*[–—\-]?\s*Class\s+[A-Z][A-Z0-9-]*\b/i;
  const mer=sec.filter(l=>merRx.test(l.items.filter(it=>it.x<235).map(it=>it.str).join(' ').replace(/\s+/g,' ').trim()));
  const ptr=sec.filter(l=>/^Portfolio turnover rate\b/i.test(l.items.filter(it=>it.x<235).map(it=>it.str).join(' ').replace(/\s+/g,' ').trim()));
  const trading=sec.filter(l=>/^Trading expense ratio\b/i.test(l.items.filter(it=>it.x<235).map(it=>it.str).join(' ').replace(/\s+/g,' ').trim()));
  if(mer.length!==1||ptr.length!==1||trading.length!==1)continue;
  if(isRow==='split'&&!new RegExp('\\b'+row.class_name.replace(/\s+/g,'\\s+')+'\\b','i').test(mer[0].text))continue;
  const before=sec.filter(l=>/^MER before expense absorption\b/i.test(l.text));
  if((isRow!=='split'&&before.length!==1)||(isRow==='split'&&before.length))continue;
  const target=key==='MER'?mer[0]:ptr[0];
  // Include printed historical n/a as a placeholder (never as a yellow
  // numeric cell); still require all expected table columns and a numeric
  // CURRENT-period source cell at the same x coordinate as the year header.
  const cells=l=>l.items.filter(it=>it.x>235&&/^(?:\d{1,3}(?:\.\d{1,3})?\s*%|n\s*\/\s*a|[–—−])$/i.test(bromptonEvClean(it.str))).sort((a,b)=>a.x-b.x);
  if(cells(mer[0]).length!==h.expectedCount||cells(ptr[0]).length!==h.expectedCount||cells(trading[0]).length!==h.expectedCount)continue;
  if(isRow!=='split'&&cells(before[0]).length!==h.expectedCount)continue;
  if([mer[0],ptr[0],trading[0]].some(l=>!/\d/.test(cells(l)[0].str)||!/\d{1,3}(?:\.\d{1,3})?\s*%/.test(cells(l)[0].str)))continue;
  if(isRow!=='split'&&!/^\d{1,3}(?:\.\d{1,3})?\s*%$/.test(bromptonEvClean(cells(before[0])[0].str)))continue;
  const targetItems=cells(target),it=targetItems[0];
  if(!it||Math.abs((it.x+it.w/2)-h.firstCenter)>30)continue;
  if(Math.abs(Number(it.str.replace('%',''))-Number(value))>1e-7||!(it.w>0&&it.h>0))continue;
  candidates.push({page:page.page,box:{x:Math.max(0,it.x-1),y:it.y-1,w:it.w+2,h:it.h+2},raw:it.str,kind:'brompton-'+(isRow==='split'?(row.class_name==='Class A'?'class-a':'named-class'):isRow==='etf'?'unit':'single-unit')+'-current-period-'+key.toLowerCase()+'-v1'});
 }
 return candidates.length===1?candidates[0]:null;
}
