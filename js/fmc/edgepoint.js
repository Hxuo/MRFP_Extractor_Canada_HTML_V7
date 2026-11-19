/* EdgePoint Wealth Management Inc. -- financial highlights Series tables.
 * Dynamic document titles and Series; no individual fund names, MER/PTR
 * values, or fixed PDF page numbers. Supports 5-year annual, 6-column
 * interim, and shorter-inception Series, with separate fund-level PTR.
 */
// @mrfp:profile
const profile_edgepoint={
 key:'edgepoint',label:'EdgePoint Wealth Management Inc.',style:'edgepoint',
 signatures:[
  /\bEdgePoint\s+Wealth\s+Management\s+Inc\.?\b/i,
  /\bwww\.edgepointwealth\.com\b/i,
  /\bThe\s+Fund\s+is\s+managed\s+by\s+EdgePoint\b/i
 ],
 title:/^\s*(EdgePoint\s+[A-Z][A-Za-z0-9 &'’().,+\-]+\s+Portfolio)\s*$/im
};
const fmcConfig_edgepoint={allowRowFallback:false,titleScanPages:2,allowRowReviewFlag:true};

// @mrfp:extraction
function edgepointClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function edgepointCover(pages){
 const first=String(pages?.[0]?.text||'');
 const titles=[...new Set(first.split(/\r?\n/).map(edgepointClean).filter(s=>
  /^EdgePoint\s+[A-Za-z0-9 &'’().,+\-]{4,150}\s+Portfolio$/i.test(s)))];
 if(titles.length!==1)return null;
 const normalized=title=>edgepointClean(title).toLowerCase().replace(/[^a-z0-9]/g,'');
 const adjacent=pages.slice(1,3).map(p=>p.text||'').join('\n');
 if(!normalized(adjacent).includes(normalized(titles[0])))return null;
 return titles[0];
}
function edgepointOwner(pages){
 // Manager-role statement is stronger than an incidental advisor/holding.
 // A cover address alone does not establish ownership.
 const content=pages.slice(1,7).map(p=>String(p.text||'')).join('\n');
 return /\bThe\s+Fund\s+is\s+managed\s+by\s+EdgePoint\s+Wealth\s+Management\s+Inc\.?/i.test(content)
  || /\bmanaged\s+by\s+EdgePoint\s+Wealth\s+Management\s+Inc\.?/i.test(content);
}
function edgepointDate(pages){
 const head=edgepointClean(pages?.[0]?.text||'');
 const m=/\bFor\s+the\s+(year|period)\s+ended\s+(December|June)\s+30,?\s+(20\d{2})\b/i.exec(head)
  || /\bFor\s+the\s+(year|period)\s+ended\s+(December|June)\s+31,?\s+(20\d{2})\b/i.exec(head);
 if(!m)return null;
 if(m[1].toLowerCase()==='year'&&m[2].toLowerCase()==='december')return m[3]+'-12-31';
 if(m[1].toLowerCase()==='period'&&m[2].toLowerCase()==='june')return m[3]+'-06-30';
 return null;
}
function identifyFundEarly_edgepoint(pages){return edgepointOwner(pages)?edgepointCover(pages)||'Unknown Fund':'Unknown Fund';}
function selectReportDate_edgepoint(pages){return edgepointOwner(pages)&&edgepointCover(pages)?edgepointDate(pages):null;}
function edgepointSeries(s){
 const text=edgepointClean(s);
 const m=/^Series\s+([A-Z](?:\(N\))?(?:T\d+)?|[A-Z]{1,2}\d+)$/i.exec(text);
 return m?'Series '+m[1].toUpperCase():mrfpV7SeriesLabel(text);
}
function edgepointPeriodRow(page,year,section){
 // Validate first, current-year column using an actual date header on the page.
 const lines=String(page?.text||'').split(/\r?\n/).map(edgepointClean);
 const h=lines.findIndex(l=>section==='fund'?/^Fund level ratios$/i.test(l):edgepointSeries(l));
 if(h<0)return null;
 const begin=h+1,end=Math.min(lines.length,begin+8);
 let firstYears=[];
 for(let i=begin;i<end;i++){
  const l=lines[i];if(/^Fund[’']s net assets per unit/i.test(l))break;
  const nums=l.match(/\b20\d{2}\b/g);if(nums)firstYears.push(...nums.map(Number));
 }
 if(!firstYears.length)return null;
 if(firstYears[0]===year)return 'ok';
 // Narrowly validate an issuer typo: first heading says June of prior year,
 // second column says December of same prior year, while report page states
 // current June reporting date. Never treat it as silently normal.
 const firstDate=lines.slice(begin,begin+3).join(' ');
 const pageHead=lines.slice(0,3).join(' ');
 if(section==='series'&&firstYears.length>=2&&firstYears[0]===year-1&&firstYears[1]===year-1
    &&/Jun\.?\s*30/i.test(firstDate)&&/Dec\.?\s*31/i.test(firstDate)
    &&new RegExp('June\\s+30,?\\s+'+year).test(pageHead))return 'review';
 return null;
}
function edgepointRatioPage(page,year){
 const lines=String(page.text||'').split(/\r?\n/).map(edgepointClean);
 const clsNames=[...new Set(lines.slice(0,15).map(edgepointSeries).filter(Boolean))];
 const periodStatus=edgepointPeriodRow(page,year,'series');
 if(clsNames.length!==1||!periodStatus)return null;
 const sec=lines.findIndex(l=>/^Ratios and supplemental data\s*\(Note\s*2\)/i.test(l));
 if(sec<0)return null;
 const labels=lines.slice(sec+1,sec+12).filter(l=>/^Management expense ratio\s*\(Note\s*3\)/i.test(l));
 if(labels.length!==1)return null;
 const after=labels[0].replace(/^Management expense ratio\s*\(Note\s*3\)\s*/i,'');
 const cells=after.match(/(?:\d{1,3}(?:\.\d+)?|[–—\-])\s*%/g)||[];
 if(!cells.length||cells.length>6)return null;
 const vals=cells.map(s=>/^[–—\-]/.test(s)?null:Number(s.replace('%','').trim()));
 if(vals.some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>50)))return null;
 if(!/\bManagement expense ratio before waivers or\b|\bManagement expense ratio before waivers or absorptions\b/i.test(lines.slice(sec+1,sec+13).join(' ')))return null;
 return {cls:clsNames[0],mer:vals[0],page:page.page,needsReview:periodStatus==='review'};
}
function edgepointTurnover(pages,year){
 const found=[];
 for(const page of pages){
  const lines=String(page.text||'').split(/\r?\n/).map(edgepointClean);
  if(edgepointPeriodRow(page,year,'fund')!=='ok')continue;
  const p=lines.filter(l=>/^Portfolio turnover rate\s*\(Note\s*5\)/i.test(l));
  const trading=lines.filter(l=>/^Trading expense ratio\s*\(Note\s*4\)/i.test(l));
  if(p.length!==1||trading.length!==1)continue;
  const a=p[0].replace(/^Portfolio turnover rate\s*\(Note\s*5\)\s*/i,'');
  const vals=[...a.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)].map(m=>Number(m[1]));
  if(!vals.length||vals.length>6||vals.some(v=>!Number.isFinite(v)||v<0||v>10000))continue;
  found.push({value:vals[0],page:page.page});
 }
 return found.length===1?found[0]:null;
}
function extract_edgepoint(pages,p,fund,date){
 if(!date||fund==='Unknown Fund'||fund!==edgepointCover(pages)||date!==edgepointDate(pages)||!edgepointOwner(pages))return [];
 const year=Number(date.slice(0,4));
 const ptr=edgepointTurnover(pages,year);
 if(!ptr)return [];
 const rows=new Map(),duplicate=new Set();
 for(const pg of pages){
  const parsed=edgepointRatioPage(pg,year);if(!parsed)continue;
  if(rows.has(parsed.cls))duplicate.add(parsed.cls);else rows.set(parsed.cls,parsed);
 }
 for(const cls of duplicate)rows.delete(cls);
 return [...rows.values()].map(r=>({cls:r.cls,quality:3,needsReview:r.needsReview,
  values:{MER:r.mer,PTR:ptr.value,TER:null},
  evidence:{...(r.mer===null?{}:{MER:{page:r.page,source:'Exact Series Management Expense Ratio current period',method:'native-js',...(r.needsReview?{reportingYearConflict:true}:{})}}),
   PTR:{page:ptr.page,source:'Fund-level Portfolio Turnover Rate current period; shared by Series',method:'native-js'}}
 }));
}
function auditRatioHeadings_edgepoint(text,potential){
 for(const line of String(text||'').split(/\r?\n/)){
  // Only clean, standalone Series headings in Financial Highlights pages.
  const c=edgepointSeries(line);if(c&&/ratios and supplemental data/i.test(text))potential.add(c);
 }
}

// @mrfp:evidence
const evidencePolicy_edgepoint={stamps:{edgepointSeriesEvidenceVersion:1}};
function edgepointEvidenceClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function edgepointEvidenceTitle(pages){
 const ls=String(pages?.[0]?.text||'').split(/\r?\n/).map(edgepointEvidenceClean);
 const found=[...new Set(ls.filter(s=>/^EdgePoint\s+[A-Za-z0-9 &'’().,+\-]{4,150}\s+Portfolio$/i.test(s)))];
 return found.length===1?found[0]:null;
}
function edgepointEvidenceDate(pages){
 const cover=edgepointEvidenceClean(pages?.[0]?.text||'');
 const annual=/\bFor the year ended December 31,? (20\d{2})/i.exec(cover);
 if(annual)return annual[1]+'-12-31';
 const interim=/\bFor the period ended June 30,? (20\d{2})/i.exec(cover);
 return interim?interim[1]+'-06-30':null;
}
function validateDocumentEvidence_edgepoint(pages,row){
 if(row?.fmc_key!=='edgepoint'||!pages?.length||edgepointEvidenceTitle(pages)!==row.fund_name||edgepointEvidenceDate(pages)!==row.report_date)return false;
 const body=pages.slice(1,7).map(p=>p.text||'').join('\n');
 if(!/\bmanaged\s+by\s+EdgePoint\s+Wealth\s+Management\s+Inc\.?/i.test(body))return false;
 const cls=edgepointEvidenceClean(row.class_name);
 if(!(/^Series\s+[A-Z](?:\(N\))?(?:T\d+)?$|^Series\s+[A-Z]{1,2}\d+$/i.test(cls)||mrfpV7SeriesLabel(cls)===cls))return false;
 return pages.some(pg=>(pg.text||'').split(/\r?\n/).some(l=>edgepointEvidenceClean(l)===cls)&&/ratios and supplemental data/i.test(pg.text||''));
}
function edgepointEvidenceHeader(lines,kind,year,page,row){
 const top=kind==='series'?lines.findIndex(l=>(/^Series\s+[A-Z](?:\(N\))?(?:T\d+)?$|^Series\s+[A-Z]{1,2}\d+$/i.test(l.text)||mrfpV7SeriesLabel(l.text)!==null)):
   lines.findIndex(l=>/^Fund level ratios$/i.test(l.text));
 if(top<0)return null;
 for(let j=top+1;j<Math.min(lines.length,top+7);j++){
  const tokens=lines[j].items.filter(it=>/^20\d{2}$/.test(String(it.str||'').trim())&&it.x>210).sort((a,b)=>a.x-b.x);
  if(!tokens.length)continue;
  const periodLabels=lines.slice(top+1,j).map(l=>l.text).join(' ');
  if(!/(?:Jun\.?\s*30|Dec\.?\s*31)/i.test(periodLabels))return null;
  if(Number(tokens[0].str)===year)return {x:tokens[0].x,y:lines[j].y};
  const printed=Number(tokens[0].str);
  const docYearConflict=kind==='series'&&row?.needs_review===true&&row?.evidence?.MER?.reportingYearConflict===true;
  const pageHead=edgepointEvidenceClean((page?.text||'').split(/\r?\n/).slice(0,3).join(' '));
  if(docYearConflict&&printed===year-1&&tokens.length>=2&&Number(tokens[1].str)===year-1
   &&/Jun\.?\s*30/i.test(periodLabels)&&/Dec\.?\s*31/i.test(periodLabels)
   &&new RegExp('June\\s+30,?\\s+'+year).test(pageHead))return {x:tokens[0].x,y:lines[j].y};
  return null;
 }
 return null;
}
function locateCell_edgepoint(page,lines,row,key,value){
 if(!['MER','PTR'].includes(key)||value==null||!Number.isFinite(Number(value))||!Array.isArray(page?.items))return null;
 if(!Array.isArray(lines))return null;
 const year=Number(String(row.report_date||'').slice(0,4));if(!year)return null;
 const header=lines[0];
 if(!header||!header.items.some(it=>edgepointEvidenceClean(it.str)===row.fund_name))return null;
 if(key==='MER'){
  const printed=lines.filter(l=>/^Series\s+[A-Z]/i.test(l.text)&&l.items.some(it=>it.x<100&&edgepointEvidenceClean(it.str)===row.class_name));
  if(printed.length!==1||!lines.some(l=>/^Ratios and supplemental data\s*\(Note\s*2\)/i.test(l.text)))return null;
 }else if(!lines.some(l=>/^Fund level ratios$/i.test(l.text)))return null;
 const anchor=edgepointEvidenceHeader(lines,key==='MER'?'series':'fund',year,page,row);if(!anchor)return null;
 const rx=key==='MER'?/^Management expense ratio\s*\(Note\s*3\)/i:/^Portfolio turnover rate\s*\(Note\s*5\)/i;
 const matching=lines.filter(l=>rx.test(l.text));if(matching.length!==1)return null;
 if(matching[0].y>=anchor.y)return null;
 const tokens=matching[0].items.filter(it=>it.x>210&&Math.abs(it.x-anchor.x)<30&&/^\d{1,3}(?:\.\d+)?\s*%$/.test(String(it.str||'').trim()));
 const valid=tokens.filter(it=>Math.abs(Number(it.str.replace('%',''))-Number(value))<1e-7&&it.w>0&&it.h>0);
 if(valid.length!==1)return null;
 const it=valid[0];return {page:page.page,box:{x:Math.max(0,it.x-1),y:it.y-1,w:it.w+2,h:it.h+2},raw:it.str,kind:key==='MER'?'edgepoint-series-period-mer-v1':'edgepoint-fund-period-ptr-v1'};
}
