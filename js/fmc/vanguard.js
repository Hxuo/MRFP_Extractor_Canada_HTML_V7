/* FMC adapter: vanguard. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_vanguard={key:'vanguard',label:'Vanguard Investments Canada',style:'vanguard_new',signatures:[/Vanguard Investments Canada Inc/i,/Vanguard FTSE Canadian/i],title:/^\s*(Vanguard[^\n]{5,150}?ETF)\s*$/im};

const fmcConfig_vanguard={issuerPrefix:/^Vanguard\s/i};

// @mrfp:extraction
// Pick the Class/Series actually printed with Financial Highlights, not one
// inferred from the fund title. The isolated heading is typically above the
// current Ratios and Supplemental Data panel on the same page.
function vanguardPublishedClass(pages,page){
 const heading=/^(?:Series\s+[A-Z][A-Z0-9-]*(?:\s+Units)?|Class\s+[A-Z][A-Z0-9-]*(?:\s+Units)?|ETF\s+Series(?:\s+Units)?|(?:ETF|Common)\s+Units)\s*\**$/i;
 const items=page.items||[];
 const ratio=items.filter(it=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(clean(it.str)));
 const sectionY=ratio.length===1?ratio[0].y:null;
 let candidates=Number.isFinite(sectionY)?items.filter(it=>Number.isFinite(it.x)&&Number.isFinite(it.y)
  &&it.x<Math.min(210,(page.width||612)*.38)&&it.y>sectionY+2&&it.y<sectionY+325
  &&heading.test(clean(it.str)))
  .map(it=>clean(it.str).replace(/\*+$/,'').trim()):[];
 if(!items.length){
  // Keep the application's Paste PDF text workflow supported. Without native
  // coordinates, restrict the fallback to a printed class heading preceding
  // the ratios table; evidence remains unavailable until a native PDF is used.
  const pos=(page.text||'').search(/Ratios\s+and\s+Supplemental\s+Data/i);
  if(pos<0)return null;
  candidates=page.text.slice(0,pos).split(/\r?\n/)
   .map(line=>/^(Series\s+[A-Z][A-Z0-9-]*(?:\s+Units)?|Class\s+[A-Z][A-Z0-9-]*(?:\s+Units)?|ETF\s+Series(?:\s+Units)?|(?:ETF|Common)\s+Units)(?:\s+20\d{2}){0,8}\s*$/i.exec(line.trim()))
   .filter(Boolean).map(m=>m[1]);
 }
 const distinct=[...new Set(candidates.map(x=>x.toLowerCase()))];
 if(distinct.length>1)return null; // multi-series tables require independent parsing.
 if(distinct.length===1)return candidates[0];
 // A native ETF without a printed Series heading is an ETF Units record only
 // when the document explicitly identifies the reporting vehicle as "the ETF".
 const cover=(pages[0]?.text||'').slice(0,3500);
 return /\(\s*the\s*[“"']?ETF[”"']?\s*\)/i.test(cover)?'ETF Units':null;
}
function parseVanguard(pages){
 for(const page of pages){
  const pos=page.text.search(/Ratios and Supplemental Data/i);
  if(pos<0)continue;
  const cls=vanguardPublishedClass(pages,page);
  if(!cls)continue;
  const block=page.text.slice(pos,pos+4500);
  const r=extraRatios(block);
  if(r.quality>=3)return [{cls,...r}];
 }
 return [];
}
function parseVanguardB2(pages){
 for(const pg of pages){let pos=pg.text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  const cls=vanguardPublishedClass(pages,pg);
  if(!cls)continue;
  const lines=pg.text.slice(pos).split(/\r?\n/);let v={},seen=0;
  for(const m of ['MER','TER','PTR']){
   const re=m==='MER'?/^\s*Management\s+expense\s+ratio(?!\s+before)/i:m==='TER'?/^\s*Trading\s+expense\s+ratio/i:/^\s*Portfolio\s+turnover\s+rate/i;
   const row=lines.find(x=>re.test(x));if(!row)continue;
   const label=re.exec(row),tail=row.slice(label[0].length).replace(/^(?:\d+|\s|\([^)]*\))*(?=\s+\d+\.\d+%|\s+[—–−-])/,'');
   const values=[...tail.matchAll(/(?:\d*\.\d+|[—–−-])%?/g)];
   if(!values.length)continue;
   v[m]=toNumber(values[0][0].replace(/%/g,''));seen++;
  }
  if(seen===3)return [{cls,values:v,quality:3,evidence:{}}];
 }
 return [];
}
// BlackRock has a family of condensed text PDFs, with collapsed spaces like
// 'RatiosandSupplementalData(g)' and separate CAD/USD units per page.

function extract_vanguard(pages,p,fund,date){
 const r=parseVanguard(pages),out=r.length?r:parseVanguardB2(pages);
 const named=pages.map(pg=>mrfpV7NamedRatioValues(pg,date)).filter(Boolean);
 const counts=new Map();for(const n of named)counts.set(n.cls,(counts.get(n.cls)||0)+1);
 for(const n of named)if(counts.get(n.cls)===1&&!out.some(x=>x.cls===n.cls))out.push(n);
 return out;
}
// Vanguard cover pages explicitly print the reporting date above the title.
// Do not let a commencement-date/previous-period note override that header.
function selectReportDate_vanguard(pages){
 const cover=(pages[0]?.text||'').split(/\r?\n/).slice(0,5).join(' ');
 const monthIds={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
 const match=/\b(?:Annual|Interim)\s+Management\s+Report\s+of\s+Fund\s+Performance\s*(?:\|\s*)?\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(cover);
 if(!match)return reportDate(pages); // preserve existing older Vanguard formats.
 return match[3]+'-'+monthIds[match[1].toLowerCase()]+'-'+match[2].padStart(2,'0');
}

// Prefer a physically isolated cover title rather than PDF.js's combined
// two-column text lines. Manager-level recognition still belongs to the
// registry; no individual product titles are listed here.
function identifyFundEarly_vanguard(pages,p,head){
 if(p.key!=='vanguard')return undefined;
 const title=/^Vanguard\s+.{5,160}?(?:\bETF(?:\s+Portfolio)?|\bFund|\bPortfolio)(?:\s*\(CAD-hedged\))?$/i;
 for(const pg of pages.slice(0,2)){
  const candidates=(pg.items||[]).filter(it=>
   typeof it.str==='string'&&Number.isFinite(it.x)&&Number.isFinite(it.y)
   &&Number(it.h)>=12&&it.x<(pg.width||612)*0.6)
   .map(it=>clean(it.str)).filter(s=>s.length<=175&&title.test(s)
    &&!/\b(?:seeks to|investment objective|ended|returned|management report)\b/i.test(s));
  if(candidates.length===1)return candidates[0];
 }
 return undefined;
}
// Retain the established FTSE fallback for historical native-text layouts.
function identifyFundLate_vanguard(pages,p,head){
if(p.key==='vanguard'){
    const lines=pages.slice(0,2).flatMap(pg=>pg.text.split(/\r?\n/));
    for(let i=0;i<lines.length;i++){
      let line=lines[i].trim();if(!/^Vanguard\s+FTSE\b/i.test(line))continue;
      if(!/\bETF\b/i.test(line))line+=' '+(lines[i+1]||'').trim();
      const found=/(Vanguard\s+[^\n]{5,160}?ETF(?:\s*\(CAD-hedged\))?)/i.exec(line);
      if(found)return clean(found[1]);
    }
  }
}

// @mrfp:evidence
function validateAnnualEtfRow_vanguard(page,row){
 const printed=mrfpV7IndependentRatioClass(page,row.report_date);
 return printed?printed===row.class_name:/^ETF Units$/i.test(row.class_name||'');
}

// Advance only Vanguard’s existing evidence stamp so previously missing
// March/September evidence is refreshed by the established History policy.
const evidencePolicy_vanguard={stamps:{annualEtfLocatorVersion:3}};

// Vanguard's current-period table is not always December 31. In March
// annual and September interim reports the first-year column is validated
// against the actual printed period header, not inferred from numeric values.
// This stays separate from the December-only shared annualEtfCell helper.
function vanguardDatedRatioCell(page,lines,row,key,value){
 if(!fundOnPage(page,row))return null;
 if(key!=='MER'&&key!=='PTR')return null; // Strict Total TER is handled by the shared detector.
 const date=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!date)return null;
 const year=Number(date[1]),month=Number(date[2]),day=Number(date[3]);
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 if(month<1||month>12||day<1||day>31)return null;
 const sections=lines.filter(l=>/^Ratios and Supplemental Data$/i.test(l.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 // The published class is anchored to the Financial Highlights section, not
 // to a Series mentioned in management-fee prose or underlying holdings.
 const classRx=/^(?:Series\s+[A-Z][A-Z0-9-]*(?:\s+Units)?|Class\s+[A-Z][A-Z0-9-]*(?:\s+Units)?|ETF\s+Series(?:\s+Units)?|(?:ETF|Common)\s+Units)\s*\**$/i;
 const classes=lines.filter(l=>l.y>section.y+2&&l.y<section.y+325&&l.minX<210)
  .flatMap(l=>l.items.filter(it=>it.x<210&&classRx.test(it.str.trim())))
  .map(it=>it.str.trim().replace(/\*+$/,'').trim());
 const distinct=[...new Set(classes.map(x=>clean(x)))];
 if(distinct.length>1)return null;
 if(distinct.length===1){if(distinct[0]!==clean(row.class_name))return null;}
 else if(!/^ETF Units$/i.test(row.class_name||''))return null;
 // Find the current-year header in this ratio panel, not the previous net
 // assets panel or any date in narrative/footnotes.
 const headers=lines.filter(l=>l.y<section.y&&section.y-l.y<50)
  .map(l=>({line:l,years:yearTokens(l)})).filter(x=>x.years.length>=2);
 if(headers.length!==1)return null;
 const {line:yearLine,years}=headers[0];
 if(Number(years[0].str)!==year)return null;
 const yearNumbers=years.map(it=>Number(it.str));
 const center=tokenCenter(years[0]),next=tokenCenter(years[1]);
 if(!(next>center+15))return null;
 const columnEdge=(center+next)/2;
 const band=lines.filter(l=>l.y>yearLine.y+1&&l.y<section.y+1);
 const allHeaderItems=band.flatMap(l=>l.items);
 const firstColumn=allHeaderItems.filter(it=>tokenCenter(it)<columnEdge);
 const otherColumn=allHeaderItems.filter(it=>tokenCenter(it)>columnEdge);
 const printed=new RegExp('\\b'+monthNames[month-1]+'\\s+'+day+'\\b','i');
 const isInterim=firstColumn.some(it=>/^Period Ended\b/i.test(it.str.trim()));
 if(isInterim){
  // In two-column interim PDFs the month/day, "Period Ended" and year
  // are separate PDF.js text items; annual comparison is to their right.
  if(!firstColumn.some(it=>printed.test(it.str)))return null;
  if(!otherColumn.some(it=>/^Financial\s+(?:Period|Years)\s+Ended\b/i.test(it.str.trim())))return null;
 }else{
  // Annual header may be one span: "Financial Years Ended March 31".
  if(!allHeaderItems.some(it=>/Financial Years Ended/i.test(it.str)&&printed.test(it.str)))return null;
 }
 if(!yearNumbers.every((n,i)=>i===0||n===yearNumbers[i-1]-(isInterim&&i===1?0:1)))return null;
 const ratioBand=lines.filter(l=>l.y<yearLine.y-1&&yearLine.y-l.y<175);
 const exactRows=label=>ratioBand.filter(l=>l.items.some(it=>clean(it.str)===clean(label)));
 if(exactRows('Management expense ratio').length!==1||
    exactRows('Trading expense ratio').length!==1||
    exactRows('Portfolio turnover rate').length!==1)return null;
 const labels={MER:'Management expense ratio',PTR:'Portfolio turnover rate'};
 const candidates=cells(exactRows(labels[key])[0]).filter(cell=>matchesCell(cell,value)
  &&Math.abs(cell.x-center)<27&&cell.x<columnEdge);
 return candidates.length===1?candidates[0]:null;
}

function locateCell_vanguard(page,lines,row,key,value,context){
 if(/^(?:Class|Series)\s+[A-Z][A-Z0-9-]*$/i.test(row.class_name||'') &&
   mrfpV7IndependentRatioClass(page,row.report_date)!==row.class_name)return null;
 const selected=annualEtfCell(page,lines,row,key,value)
  ||vanguardDatedRatioCell(page,lines,row,key,value);
 return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-year-ratio-cell'}:null;
}
