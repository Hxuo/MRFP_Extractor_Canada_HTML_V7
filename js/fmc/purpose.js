/* FMC adapter: purpose. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const purpose={key:'purpose',label:'Purpose Investments',style:'purpose',signatures:[/www\.purposeinvest\.com|www\.purposeinvest\.com/i,/PURPOSE ACTIVE BALANCED FUND/i,/Purpose Investments/i],title:/^\s*(PURPOSE\s+[^\n]{3,100}(?:FUND|PORTFOLIO))\s*$/im};

const fmcConfig_purpose={issuerPrefix:/^Purpose\s/i,splitColumns:true,deduplicate:true,startAtRatioHeading:true,retainRatioHeading:true};

// @mrfp:extraction

function extract_purpose(pages,p,fund,date){return tableBlocks(pages,p,{allowWithoutRatio:true});}
// Normalize the unusual PDF.js glyph separator used between words in some
// Purpose ETF cover titles (for example AMAZON2(AMZN)2YIELD2SHARES2PURPOSE2ETF).
// This is deliberately Purpose-only; it must not alter other FMC document text.
function normalizePurposeTitle_purpose(value){
 return String(value||'').replace(/\u00a0/g,' ')
  .replace(/([A-Z)])2(?=[A-Z(])/g,'$1 ')
  .replace(/2(?=[a-z])/g,'')
  .replace(/\s+/g,' ').trim();
}

// Adapter-owned fund title strategy. Preserve the original mutual-fund title
// rule and additionally read Purpose Yield Shares ETF titles that can span
// two or three lines on the cover page.
function identifyFundLate_purpose(pages,p,head){
 if(p.key!=='purpose')return undefined;
 const legacyLines=String(head||'').split(/\r?\n/);
 for(const line of legacyLines){
  const normalized=normalizePurposeTitle_purpose(line);
  const m=/^\s*(PURPOSE[ \t]+(?:[A-Z]+[ \t]+){1,10}FUND)[ \t]*$/i.exec(normalized);
  if(m)return clean(m[1]);
 }
 const coverLines=String(pages?.[0]?.text||'').split(/\r?\n/).slice(0,8);
 const candidates=[];
 for(let start=0;start<coverLines.length;start++){
  for(let length=1;length<=3&&start+length<=coverLines.length;length++){
   const candidate=normalizePurposeTitle_purpose(coverLines.slice(start,start+length).join(' '));
   if(candidate.length>=16&&candidate.length<=150&&/\bPURPOSE\s+ETF$/i.test(candidate)
      &&!/INTERIM MANAGEMENT REPORT|FUND PERFORMANCE/i.test(candidate))candidates.push(candidate);
  }
 }
 if(candidates.length)return candidates.sort((a,b)=>b.length-a.length)[0];
 return undefined;
}

// Class heading recognition is issuer-owned; shared core only dispatches.
function classHeading_purpose(line){
 const s=line.replace(/\u00a0/g,' ').replace(/\*+/g,'').trim();
 const m=/^(ETF\s+(?:Units|Shares)|Class\s+[A-Z][A-Z0-9-]*\s*Units)(?:\s+\d+)?(?:\s*\([^)]*\))?(?=\s|$)/i.exec(s);
 if(!m)return null;
 if(/^ETF\s+Units$/i.test(m[1]))return 'ETF Units';
 if(/^ETF\s+Shares$/i.test(m[1]))return 'ETF Shares';
 return m[1].replace(/\s*Units$/i,'');
}

// @mrfp:evidence
const evidenceLayout_purpose={newBatch:true,normalizePurposeTitle:true,splitPanels:true,purposeClassHeading:true};

// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_purpose={stamps:{nextFmcLocatorVersion:1}};


function locateCell_purpose(page,lines,row,key,value,context){
 // The shared Purpose locator historically recognizes ETF Units. For the
 // newer ETF Shares label, adapt only the in-memory locator view to the same
 // canonical ETF heading; the extracted/displayed class remains ETF Shares.
 let locatorRow=row,locatorLines=lines;
 if(/^ETF\s+Shares$/i.test(row.class_name||'')){
  locatorRow={...row,class_name:'ETF Units'};
  locatorLines=lines.map(line=>({...line,items:(line.items||[]).map(item=>({...item,
   str:String(item.str||'').replace(/^ETF\s+Shares(?=\s|$)/i,'ETF Units')
  }))}));
 }
 const selected=nextBatchFmcCell(page,locatorLines,locatorRow,key,value);
 return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'}:null;
}
