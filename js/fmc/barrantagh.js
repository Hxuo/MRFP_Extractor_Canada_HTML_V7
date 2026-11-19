/* Barrantagh Investment Management Inc. — native-text multi-Series MRFPs.
 * Manager-ownership and fund identity are separate from unrelated service-
 * provider contacts (some reports mention RBC GAM on the cover).
 * No individual product name, ticker, reporting year or fixed page is required.
 */
// @mrfp:profile
const profile_barrantagh={
 key:'barrantagh',label:'Barrantagh Investment Management Inc.',style:'barrantagh',
 signatures:[
  /Barrantagh\s+Investment\s+Management\s+Inc\.?[^\n]{0,75}\bis\s+the\s+manager\s*,?\s*trustee\b/i,
  /\bBarrantagh\s+Investment\s+Management\s+Inc\.?\b/i,
  /^\s*Barrantagh\s+[^\n]{5,150}\bFund\s*$/im
 ],
 title:/^\s*(Barrantagh\s+[^\n]{5,150}\bFund)\s*$/im
};
const fmcConfig_barrantagh={issuerPrefix:/^Barrantagh\s/i,preferProfileLineTitle:true,allowRowFallback:false,titleScanPages:3};

// @mrfp:extraction
function barrantaghNormalize(s){return String(s||'').replace(/\u00ad/g,'').replace(/\s+/g,' ').trim();}
function barrantaghPeriod(pages){
 const periods=[];
 for(const page of (pages||[]).slice(0,2)){
  const match=/\bPeriod\s+ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(page.text||'');
  if(match){const m={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'}[match[1].toLowerCase()];periods.push(`${match[3]}-${m}-${match[2].padStart(2,'0')}`);}
 }
 return periods.length&&periods.every(x=>x===periods[0])?periods[0]:null;
}
function selectReportDate_barrantagh(pages){return barrantaghPeriod(pages);}
function identifyFundEarly_barrantagh(pages){
 const candidates=[];
 for(const page of (pages||[]).slice(0,2)){
  for(const line of String(page.text||'').split(/\r?\n/).slice(0,24)){
   const s=barrantaghNormalize(line);
   if(/^Barrantagh\s+.{5,150}\bFund$/i.test(s))candidates.push(s);
  }
 }
 return candidates.length&&candidates.every(x=>x===candidates[0])?candidates[0]:undefined;
}
function barrantaghSeries(line){
 const match=/^Series\s+([A-Z][A-Z0-9-]{0,12})$/i.exec(barrantaghNormalize(line));
 return match?`Series ${match[1].toUpperCase()}`:null;
}
function barrantaghYearColumns(line,year){
 const years=[...String(line||'').matchAll(/\b(20\d{2})(?:\s*\(\s*(\d+)\s*\))?/g)].map(x=>({year:Number(x[1]),note:x[2]||null}));
 if(years.length<2||years[0].year!==year||!years.every((c,i)=>i===0||c.year<years[i-1].year))return null;
 return years;
}
function barrantaghNotesConfirm(pages,reportDate,note){
 if(!note||!/^20\d{2}-\d{2}-\d{2}$/.test(reportDate||''))return false;
 const [y,m,d]=reportDate.split('-');
 const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const target=new RegExp(`\\(${note}\\)\\s+For\\s+the\\s+(?:period|year)\\s+ended\\s+${names[Number(m)-1]}\\s+0?${Number(d)},?\\s+${y}\\b`,'i');
 return (pages||[]).some(pg=>target.test(pg.text||''));
}
function barrantaghRatioValue(line,key,count){
 const rx=key==='MER'?/^Management\s+expense\s+ratio\b(?!\s+before)/i:/^Portfolio\s+turnover\s+rate\b/i;
 const match=rx.exec(line||'');if(!match)return null;
 const tail=String(line).slice(match[0].length).replace(/^\s*(?:\(\d+\)|\d{1,2}(?=\s+\d+\.\d+%))\s*/,'');
 const values=[...tail.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)\s*%(?=\s|$)/g)].map(m=>Number(m[1]));
 if(values.length!==count||!values.every(n=>Number.isFinite(n)&&n>=0))return null;
 return values[0];
}
function barrantaghRatioTable(page,pages,year,date){
 const lines=String(page.text||'').split(/\r?\n/).map(barrantaghNormalize).filter(Boolean);
 const headingIndices=lines.flatMap((line,i)=>barrantaghSeries(line)?[i]:[]);
 const results=[];
 for(let hi=0;hi<headingIndices.length;hi++){
  const start=headingIndices[hi],end=hi+1<headingIndices.length?headingIndices[hi+1]:lines.length;
  const cls=barrantaghSeries(lines[start]);
  // A Series must own its own financial table and current-period columns.
  if(!/^The Fund.s net assets attributable to holders of redeemable units per unit/i.test(lines[start-1]||''))continue;
  // PDF.js may place small superscript note markers on a separate line
  // immediately ABOVE the year headings. Their order must match exactly.
  let header=null;
  for(let j=start+1;j<Math.min(start+7,end);j++){
   const cols=barrantaghYearColumns(lines[j],year);if(!cols)continue;
   if(!cols.every(c=>c.note)){
    const notes=[...String(lines[j-1]||'').matchAll(/\((\d{1,2})\)/g)].map(m=>m[1]);
    if(notes.length!==cols.length)continue;
    cols.forEach((col,k)=>{col.note=notes[k];});
   }
   header=cols;break;
  }
  if(!header||!barrantaghNotesConfirm(pages,date,header[0].note))continue;
  const body=lines.slice(start+1,end);
  if(body.filter(line=>/^Ratios\s+and\s+Supplemental\s+Data\s*:?$/i.test(line)).length!==1)continue;
  const sec=body.findIndex(line=>/^Ratios\s+and\s+Supplemental\s+Data\s*:?$/i.test(line));
  const ratios=body.slice(sec+1,sec+13);
  const mer=ratios.filter(line=>/^Management\s+expense\s+ratio\b(?!\s+before)/i.test(line));
  const ptr=ratios.filter(line=>/^Portfolio\s+turnover\s+rate\b/i.test(line));
  if(mer.length!==1||ptr.length!==1)continue;
  const MER=barrantaghRatioValue(mer[0],'MER',header.length);
  const PTR=barrantaghRatioValue(ptr[0],'PTR',header.length);
  if(MER===null||PTR===null)continue;
  results.push({cls,quality:3,values:{MER,TER:null,PTR},evidence:{
   MER:{page:page.page,source:'Series current-period Management Expense Ratio',method:'native-js'},
   PTR:{page:page.page,source:'Series current-period Portfolio Turnover Rate',method:'native-js'}
  }});
 }
 return results;
}
function extract_barrantagh(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!date||barrantaghPeriod(pages)!==date)return [];
 const bySeries=new Map(),conflicts=new Set();
 for(const page of pages){
  if(!/Ratios\s+and\s+Supplemental\s+Data/i.test(page.text||''))continue;
  for(const found of barrantaghRatioTable(page,pages,Number(date.slice(0,4)),date)){
   const previous=bySeries.get(found.cls);
   if(!previous)bySeries.set(found.cls,found);
   else if(JSON.stringify(previous.values)!==JSON.stringify(found.values))conflicts.add(found.cls);
  }
 }
 for(const cls of conflicts)bySeries.delete(cls);
 return [...bySeries.values()];
}
function auditRatioHeadings_barrantagh(text,potential){
 if(!/Ratios\s+and\s+Supplemental\s+Data/i.test(text||''))return;
 for(const line of String(text).split(/\r?\n/)){
  const cls=barrantaghSeries(line);if(cls)potential.add(cls);
 }
}

// @mrfp:evidence
const evidencePolicy_barrantagh={stamps:{barrantaghFinancialHighlightsVersion:1}};
function barrantaghEvidenceCompact(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');}
function barrantaghEvidencePeriod(pages){
 const periods=[];
 for(const pg of (pages||[]).slice(0,2)){
  const match=/\bPeriod\s+ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(pg.text||'');
  if(match){const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};periods.push(`${match[3]}-${months[match[1].toLowerCase()]}-${match[2].padStart(2,'0')}`);}
 }
 return periods.length&&periods.every(x=>x===periods[0])?periods[0]:null;
}
function validateDocumentEvidence_barrantagh(pages,row){
 if(!pages?.length||barrantaghEvidencePeriod(pages)!==row.report_date)return false;
 const identity=/Barrantagh\s+Investment\s+Management\s+Inc\.?[^\n]{0,75}\bis\s+the\s+manager\s*,?\s*trustee\b/i;
 if(!pages.slice(0,3).some(page=>identity.test(page.text||'')))return false;
 const fund=barrantaghEvidenceCompact(row.fund_name);
 return fund.length>15&&pages.slice(0,2).some(page=>page.text.split(/\r?\n/).slice(0,24).some(line=>barrantaghEvidenceCompact(line)===fund));
}
function barrantaghEvidenceSeries(line){
 const m=/^Series\s+([A-Z][A-Z0-9-]{0,12})$/i.exec(String(line||'').trim());return m?`Series ${m[1].toUpperCase()}`:null;
}
function barrantaghEvidenceYears(line,year){
 const cols=line.items.filter(it=>/^20\d{2}$/.test(it.str.trim())).sort((a,b)=>a.x-b.x);
 if(cols.length<2||Number(cols[0].str)!==year||!cols.every((col,i)=>i===0||Number(col.str)<Number(cols[i-1].str)))return null;
 return cols;
}
function locateCell_barrantagh(page,lines,row,key,value,context){
 if(!page||page.ocrUsed||!['MER','PTR'].includes(key)||!Number.isFinite(value)||!/^20\d{2}-\d\d-\d\d$/.test(row.report_date||''))return null;
 const currentYear=Number(row.report_date.slice(0,4));
 if(!barrantaghEvidenceCompact(page.text||'').includes(barrantaghEvidenceCompact(row.fund_name)))return null;
 const series=[];
 for(const line of lines){
  const cls=barrantaghEvidenceSeries(line.text);
  if(cls){const yearLine=lines.find(l=>l.y<line.y-1&&line.y-l.y<20&&barrantaghEvidenceYears(l,currentYear));
   if(yearLine)series.push({cls,heading:line,yearLine,columns:barrantaghEvidenceYears(yearLine,currentYear)});
  }
 }
 if(!series.length)return null;
 const current=series.find(item=>item.cls.toLowerCase()===String(row.class_identity||row.class_name||'').toLowerCase());
 if(!current||series.some(item=>item!==current&&item.cls.toLowerCase()===current.cls.toLowerCase()))return null;
 const next=series.filter(item=>item.heading.y<current.heading.y).sort((a,b)=>b.heading.y-a.heading.y)[0];
 const lower=next?next.heading.y:0;
 const block=lines.filter(l=>l.y<current.heading.y-1&&l.y>lower+1);
 const sections=block.filter(l=>/^Ratios\s+and\s+Supplemental\s+Data\s*:?$/i.test(l.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const keyPattern=key==='MER'?/^Management\s+expense\s+ratio\s*$/i:/^Portfolio\s+turnover\s+rate\s*$/i;
 // PDF.js merges label and the row's numeric cells into a single physical line.
 const metrics=block.filter(l=>l.y<section.y-3&&section.y-l.y<85&&
  l.items.some(it=>it.x<170&&keyPattern.test(it.str.trim())));
 if(metrics.length!==1)return null;
 const col0=tokenCenter(current.columns[0]),col1=tokenCenter(current.columns[1]);
 if(!(col0<col1-12))return null;
 // Multiple series can legitimately publish identical PTRs. Cross-check
 // the companion MER value to bind this record to its *actual* series,
 // rather than accepting the same PTR from a different series block.
 const companionMER=Object.hasOwn(row.originalValues||{},'MER')?row.originalValues.MER:row.MER;
 if(Number.isFinite(companionMER)){
  const merRows=block.filter(l=>l.y<section.y-3&&section.y-l.y<85&&
   l.items.some(it=>it.x<170&&/^Management\s+expense\s+ratio\s*$/i.test(it.str.trim())));
  if(merRows.length!==1)return null;
  const expected=cells(merRows[0]).filter(c=>matchesCell(c,companionMER)&&
   tokenCenter({x:c.box.x,w:c.box.w})>col0-14&&tokenCenter({x:c.box.x,w:c.box.w})<(col0+col1)/2);
  if(expected.length!==1)return null;
 }
 const metricLine=metrics[0],label=metricLine.items.find(it=>it.x<170&&keyPattern.test(it.str.trim()));
 const candidate=cells(metricLine).filter(c=>matchesCell(c,value)&&c.x>label.x+label.w+25&&
  tokenCenter({x:c.box.x,w:c.box.w})>col0-14&&tokenCenter({x:c.box.x,w:c.box.w})<(col0+col1)/2);
 if(candidate.length!==1)return null;
 return {...candidate[0],page:page.page,metric:key,kind:'barrantagh-source-series-current-year-ratio'};
}
