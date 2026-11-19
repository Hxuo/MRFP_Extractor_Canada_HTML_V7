/* FMC adapter: hamilton. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_hamilton={key:'hamilton',label:'Hamilton ETFs',style:'hamilton_v22',signatures:[/Hamilton Capital Partners Inc\./i,/hamiltonetfs\.com/i],title:/^\s*(Hamilton\s+[^\n]{4,140}?ETF)\s*$/im};

const fmcConfig_hamilton={issuerPrefix:/^Hamilton\s/i};

// @mrfp:extraction
// An independently printed class heading immediately above a complete
// ratios table may identify an additional financial table. Do not infer a
// new class from management-fee prose or from the ETF title.
function hamiltonPrintedRatioClass(page){
 const ratio=(page.items||[]).filter(it=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(String(it.str||'').trim()));
 let candidates=[];
 if(ratio.length===1){
  const y=ratio[0].y;
  candidates=(page.items||[]).filter(it=>Number.isFinite(it.x)&&Number.isFinite(it.y)
    &&it.x>=35&&it.x<210&&it.y>y+4&&it.y<y+100
    &&/^Class\s+[A-Z][A-Z0-9-]{0,11}$/i.test(String(it.str||'').trim()))
   .map(it=>String(it.str).trim().replace(/\s+/g,' '));
 }else if(!page.items?.length){
  // Paste-text fallback: only an isolated class directly before ratio title.
  const txt=String(page.text||'');const ix=txt.search(/Ratios\s+and\s+Supplemental\s+Data/i);
  if(ix>=0)candidates=txt.slice(0,ix).split(/\r?\n/).slice(-3)
   .map(x=>x.trim()).filter(x=>/^Class\s+[A-Z][A-Z0-9-]{0,11}$/i.test(x));
 }
 const unique=[...new Set(candidates.map(s=>s.toUpperCase()))];
 return unique.length>1?'__ambiguous__':unique.length===1?'Class '+unique[0].split(/\s+/)[1]:null;
}
function parseHamilton(pages){
 const byClass=new Map(),repeatedNamed=new Set();
 for(const pg of pages){let text=String(pg.text||'');const pos=text.search(/Ratios\s+and\s+Supplemental\s+Data/i);if(pos<0)continue;
  const printed=hamiltonPrintedRatioClass(pg);if(printed==='__ambiguous__')continue;
  const cls=printed||'Class E';
  const lines=text.slice(pos).split(/\r?\n/);
  const yrLine=lines.find(x=>/^\s*Year\b.*\b20\d{2}\b/i.test(x))||'';
  const count=(yrLine.match(/20\d\d/g)||[]).length;if(count<1)continue;
  const v={MER:null,TER:null,PTR:null};let quality=0;
  for(const metric of ['MER','TER','PTR']){
   const re=metric==='MER'?/^\s*Management\s+expense\s+ratio\b(?!\s+before)/i:metric==='TER'?/^\s*Trading\s+expense\s+ratio\b/i:/^\s*Portfolio\s+turnover\s+rate\b/i;
   const row=lines.find(x=>re.test(x));if(!row)continue;
   // PDF.js may interleave annotation percentages before the year columns.
   // Use exactly N rightmost percentages for the N published year columns.
   const pct=[...row.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(x=>x[1]);
   if(pct.length<count)continue;
   v[metric]=toNumber(pct[pct.length-count]);quality++;
  }
  if(quality!==3)continue;
  if(printed&&byClass.has(cls))repeatedNamed.add(cls);
  if(!byClass.has(cls))byClass.set(cls,{cls,values:v,quality,evidence:{}});
 }
 for(const cls of repeatedNamed)byClass.delete(cls);
 return [...byClass.values()];
}

function extract_hamilton(pages,p,fund,date){return parseHamilton(pages);}
// @mrfp:evidence
function validateAnnualEtfRow_hamilton(page,row){
 if(!clean(page.text).includes(clean(row.fund_name)))return false;
 // A separate, explicitly named ratio table must not be used to locate the
 // legacy implied Class E row (or vice versa). Class PW has a distinct page.
 const ratio=(page.items||[]).filter(it=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(String(it.str||'').trim()));
 let cls=null;
 if(ratio.length===1){const y=ratio[0].y;
  const headers=(page.items||[]).filter(it=>Number.isFinite(it.x)&&Number.isFinite(it.y)&&it.x>=35&&it.x<210
   &&it.y>y+4&&it.y<y+100&&/^Class\s+[A-Z][A-Z0-9-]{0,11}$/i.test(String(it.str||'').trim()));
  if(headers.length>1)return false;
  if(headers.length===1)cls=clean(headers[0].str);
 }
 if(!cls)cls='Class E';
 return clean(row.class_name)===clean(cls);
}

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_hamilton={stamps:{annualEtfLocatorVersion:1}};


function locateCell_hamilton(page,lines,row,key,value,context){const selected=annualEtfCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-year-ratio-cell'}:null;}
