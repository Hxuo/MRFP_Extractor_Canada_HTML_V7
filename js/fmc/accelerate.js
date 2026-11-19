/* Accelerate Financial Technologies Inc. — native-text MRFP, first-period
 * Financial Highlights ratio table. Fund names and tickers are NOT routing
 * gates. The issuer's verified contact/manager role and document heading are.
 * No generic extraction or viewer changes are needed for this layout.
 */
// @mrfp:profile
const profile_accelerate={
 key:'accelerate',label:'Accelerate Financial Technologies Inc.',style:'accelerate',
 signatures:[
  /\bby writing to us at Accelerate Financial Technologies Inc\./i,
  /\bAccelerate Financial Technologies Inc\.,?\s*Suite\s+\d+/i
 ],
 title:/^\s*(Accelerate\s+[^\n]{5,160}?\s+Fund)\s*$/im
};
const fmcConfig_accelerate={allowRowFallback:false,titleScanPages:3,issuerPrefix:/^Accelerate\s+/i};

// @mrfp:extraction
function accelerateNormalize(text){return String(text||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function accelerateTitle(pages){
 // The cover prints a ticker, not the complete title. The first independent
 // line on the following page is the published fund name, above the MRFP title.
 const heading=/^(Accelerate\s+.{5,160}?\s+Fund)$/i;
 for(const page of pages.slice(1,3)){
  const lines=String(page.text||'').split(/\r?\n/).map(accelerateNormalize).filter(Boolean);
  const candidates=lines.slice(0,8).filter(line=>heading.test(line));
  if(candidates.length===1 && lines.slice(1,12).some(line=>/Management Report of Fund Performance/i.test(line)))return candidates[0];
 }
 return null;
}
function identifyFundEarly_accelerate(pages,profile){return accelerateTitle(pages)||'Unknown Fund';}
// Some Accelerate tables print the current period as MM-DD-YYYY and the
// comparative period as YYYY-MM-DD, even on the same line. Normalize each
// printed date, without using a fund name, reporting year, or filename.
function accelerateParseDateToken(token){
 const text=String(token||'').trim();
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(text);
 const us=/^(\d{2})-(\d{2})-(20\d{2})$/.exec(text);
 if(!iso&&!us)return null;
 const year=Number(iso?iso[1]:us[3]);
 const month=Number(iso?iso[2]:us[1]);
 const day=Number(iso?iso[3]:us[2]);
 const d=new Date(Date.UTC(year,month-1,day));
 if(d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
 return String(year)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function accelerateIsoDates(text){
 return [...String(text||'').matchAll(/\b(?:20\d{2}-\d{2}-\d{2}|\d{2}-\d{2}-20\d{2})\b/g)]
  .map(m=>accelerateParseDateToken(m[0])).filter(Boolean);
}
function accelerateHeaderDate(page){
 const lines=String(page.text||'').split(/\r?\n/);
 const target=lines.filter(line=>/\bFor the\s+(?:years?|periods?)\s+ended\b/i.test(line)&&accelerateIsoDates(line).length>=2);
 if(target.length!==1)return null;
 const dates=accelerateIsoDates(target[0]);
 // Source may contain a typo in a historical date, but the printed current
 // period must be an unambiguous full date in the first reporting column.
 if(dates.length!==2 || dates[0]<=dates[1])return null;
 return dates[0];
}
function accelerateBodyDate(pages){
 for(const pg of pages.slice(1,3)){
  const first=String(pg.text||'').split(/\r?\n/).slice(0,10).join(' ');
  const m=/\bFor the (?:period|year) ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(first);
  if(!m)continue;
  const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
  return m[3]+'-'+months[m[1].toLowerCase()]+'-'+m[2].padStart(2,'0');
 }
 return null;
}
function selectReportDate_accelerate(pages){
 const body=accelerateBodyDate(pages);
 const tableDates=pages.map(page=>accelerateHeaderDate(page)).filter(Boolean);
 // Page-1 dates can be wrong (as in a supplied report). Require
 // agreement between the actual report heading and CURRENT ratio-table date.
 if(!body||!tableDates.length||tableDates.some(d=>d!==body))return null;
 return body;
}
// Build a conservative, text-only table reader that also works in Paste PDF
// text. Coordinate evidence is checked separately by the native PDF locator.
function accelerateTextRatio(page,fund,date){
 const lines=String(page.text||'').split(/\r?\n/).map(accelerateNormalize).filter(Boolean);
 if(!fund||fund==='Unknown Fund'||!date||!lines.slice(0,24).some(x=>x===fund))return null;
 const headings=lines.map((line,i)=>/^(?:Ratios?\s*&\s*Supplemental Data)$/i.test(line)?i:-1).filter(i=>i>=0);
 if(headings.length!==1)return null;
 const i=headings[0];
 const period=lines.slice(Math.max(0,i-45),i).filter(line=>/\bFor the\s+(?:years?|periods?)\s+ended\b/i.test(line)&&accelerateIsoDates(line)[0]===date);
 if(period.length!==1)return null;
 if(!/\b(?:Number of outstanding redeemable units|redeemable units per unit)\b/i.test(lines.slice(i,i+5).join(' ')))return null;
 // Multiple printed Series/Class ratio panels are not this single-unit layout.
 const cls=mrfpV7IndependentRatioClass(page,date);
 if(lines.slice(Math.max(0,i-45),i+8).some(line=>/^(?:Series\s+[A-Z][A-Z0-9-]*|Class\s+[A-Z][A-Z0-9-]*)\b/i.test(line))&&!cls)return null;
 const content=lines.slice(i+1,i+24);
 const rows={MER:/^Management expense ratio\b(?!\s+before)/i,PTR:/^Portfolio turnover rate\b/i};
 const values={MER:null,TER:null,PTR:null},evidence={};
 for(const [key,re] of Object.entries(rows)){
  const matched=content.filter(line=>re.test(line));if(matched.length!==1)return null;
  const line=matched[0];let tail=line.slice(re.exec(line)[0].length);
  tail=tail.replace(/^\s*(?:\d{1,2}(?=\s*\(\s*%\s*\)))?\s*(?:\(\s*%\s*\))?\s*/,'');
  const m=/^(\d{1,4}(?:,\d{3})*(?:\.\d+)?)(?=\s|$)/.exec(tail);
  if(!m)return null;
  const value=Number(m[1].replace(/,/g,''));if(!Number.isFinite(value)||value<0)return null;
  values[key]=value;
  evidence[key]={page:page.page,source:'Accelerate Financial Highlights current-period '+key+' ratio',method:'native-js'};
 }
 // The disclosure is fund-level: there is no published Class/Series label.
 // Display the verified full fund name in the Class/Series field rather than
 // inventing a designation such as "Units" or deriving one from the filename.
 // Explicit Series/Class tables are rejected above until their own published
 // ratio structure can be independently verified.
 return {cls:cls||fund,values,quality:3,evidence};
}
function extract_accelerate(pages,profile,fund,date){
 if(fund==='Unknown Fund'||!date)return [];
 const found=pages.map(page=>accelerateTextRatio(page,fund,date)).filter(Boolean),counts=new Map();
 for(const r of found)counts.set(r.cls,(counts.get(r.cls)||0)+1);
 return found.filter(r=>counts.get(r.cls)===1);
}

// @mrfp:evidence
// The builder isolates evidence functions into a separate browser bundle;
// evidence-only identity helpers cannot call extraction-only functions.
// Evidence lives in a different generated bundle from extraction, so its
// date parser is independent but enforces the same strict calendar checks.
function accelerateEvidenceDateToken(token){
 const text=String(token||'').trim();
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(text);
 const us=/^(\d{2})-(\d{2})-(20\d{2})$/.exec(text);
 if(!iso&&!us)return null;
 const year=Number(iso?iso[1]:us[3]);
 const month=Number(iso?iso[2]:us[1]);
 const day=Number(iso?iso[3]:us[2]);
 const d=new Date(Date.UTC(year,month-1,day));
 if(d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
 return String(year)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function accelerateEvidenceIsoDate(page){
 const lines=String(page.text||'').split(/\r?\n/);
 const header=lines.filter(line=>/\bFor the\s+(?:years?|periods?)\s+ended\b/i.test(line)
  &&/\b(?:20\d{2}-\d{2}-\d{2}|\d{2}-\d{2}-20\d{2})\b/.test(line));
 if(header.length!==1)return null;
 const tokens=[...header[0].matchAll(/\b(?:20\d{2}-\d{2}-\d{2}|\d{2}-\d{2}-20\d{2})\b/g)].map(m=>m[0]);
 if(tokens.length!==2)return null;
 const dates=tokens.map(accelerateEvidenceDateToken);
 return dates.every(Boolean)&&dates[0]>dates[1]?dates[0]:null;
}
function accelerateEvidenceReportDate(pages){
 const monthMap={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
 for(const pg of pages.slice(1,3)){
  const head=String(pg.text||'').split(/\r?\n/).slice(0,10).join(' ');
  const m=/\bFor the (?:period|year) ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(head);
  if(m)return m[3]+'-'+monthMap[m[1].toLowerCase()]+'-'+m[2].padStart(2,'0');
 }
 return null;
}
const evidencePolicy_accelerate={stamps:{accelerateRatioLocatorVersion:1}};
function validateDocumentEvidence_accelerate(pages,row){
 if(!pages||!row||row.fmc_key!=='accelerate'||!/^20\d{2}-\d{2}-\d{2}$/.test(row.report_date||''))return false;
 // A fund held by another manager must not borrow this issuer's source cells.
 const cover=String(pages[0]?.text||'');
 if(!/\bby writing to us at Accelerate Financial Technologies Inc\./i.test(cover))return false;
 const published=pages.slice(1,3).map(pg=>String(pg.text||'').split(/\r?\n/).map(x=>String(x||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,8));
 if(!published.some(lines=>lines.includes(row.fund_name)&&lines.slice(1,12).some(x=>/Management Report of Fund Performance/i.test(x))))return false;
 return accelerateEvidenceReportDate(pages)===row.report_date&&pages.some(pg=>accelerateEvidenceIsoDate(pg)===row.report_date);
}
function locateCell_accelerate(page,lines,row,key,value){
 if(key!=='MER'&&key!=='PTR')return null; // Trading-only TER has NO evidence.
 // A fund-level table has no printed Series/Class. New rows display the
 // published fund name; older stored rows labelled 'Units' remain eligible
 // for their original valid evidence until the user re-scans the PDF.
 const named=/^(?:Class|Series)\s+[A-Z][A-Z0-9-]*$/i.test(row.class_name||'');
 if(named&&mrfpV7IndependentRatioClass(page,row.report_date)!==row.class_name)return null;
 const fundLevelClass=named||String(row.class_name||'').trim()===String(row.fund_name||'').trim()||row.class_name==='Units';
 if(!page.items?.length||page.ocrUsed||!fundLevelClass||!fundOnPage(page,row))return null;
 const headings=lines.filter(l=>/^Ratios?\s*&\s*Supplemental Data$/i.test(l.text));
 if(headings.length!==1)return null;
 const ratio=headings[0];
 const dated=lines.filter(l=>l.y>ratio.y+30&&l.y-ratio.y<300
  &&/\bFor the\s+(?:years?|periods?)\s+ended\b/i.test(l.text));
 if(dated.length!==1)return null;
 const header=dated[0];
 const years=header.items.filter(it=>accelerateEvidenceDateToken(it.str.trim())!==null).sort((a,b)=>a.x-b.x);
 if(years.length!==2)return null;
 const current=accelerateEvidenceDateToken(years[0].str),previous=accelerateEvidenceDateToken(years[1].str);
 if(current!==row.report_date||current<=previous)return null;
 const a=tokenCenter(years[0]),b=tokenCenter(years[1]);
 if(!(b>a+30))return null;
 const boundary=(a+b)/2;
 const leftColumn=page.width*.5;
 // Current-period ratio entries lie directly below this financial table's
 // header; require original section, metric label, and exact PDF.js value.
 const raw=lines.filter(l=>l.y<ratio.y-2&&ratio.y-l.y<130);
 if(!raw.some(l=>/Number of outstanding redeemable units/i.test(l.text)))return null;
 if(raw.some(l=>/^Series\s+[A-Z][A-Z0-9-]*\b|^Class\s+[A-Z][A-Z0-9-]*\b/i.test(l.text)))return null;
 const re=key==='MER'?/^Management expense ratio\b(?!\s+before)/i:/^Portfolio turnover rate\b/i;
 const metric=raw.filter(l=>l.items.some(it=>it.x<leftColumn&&re.test(String(it.str||'').replace(/\s+/g,' ').trim()))
  &&re.test(l.text));
 if(metric.length!==1)return null;
 const line=metric[0];
 const hits=cells(line).filter(c=>matchesCell(c,value)&&c.x>leftColumn&&c.x<boundary
  &&Math.abs(c.x+c.box.w/2-a)<28);
 if(hits.length!==1)return null;
 const hit=hits[0];
 return {...hit,page:page.page,metric:key,kind:'accelerate-verified-dated-ratio-cell'};
}
