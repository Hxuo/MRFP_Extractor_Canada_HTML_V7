/* Invesco Canada Ltd. MRFP adapter.
 * Financial highlights disclose each Series' MER separately from fund-level PTR.
 * Identify the legal manager and printed fund/series/period dynamically: no
 * individual fund name, category, PDF filename, reporting year or page allowlist.
 * Series I may have ** (unreported MER); this is null, not zero.
 * Trading expense ratio is NOT Total Expense Ratio.
 */
// @mrfp:profile
const profile_invesco={
 key:'invesco',label:'Invesco Canada Ltd.',style:'invesco',
 signatures:[
  /Manager\s*:\s*refers\s+to\s+Invesco\s+Canada\s+Ltd\./i,
  /©\s*Invesco\s+Canada\s+Ltd\./i,
  /\binquiriescanada@invesco\.com\b/i,
  /\bwww\.invesco\.com\/ca\b|\binvesco\.com\/ca\b/i
 ],
 title:/^\s*(Invesco\s+(?!20\d{2}\s)[^\n]{5,180}?(?:Fund|Portfolio|ETF))\s*$/im
};
const fmcConfig_invesco={titleScanPages:3,allowRowFallback:false};
function identifyFundEarly_invesco(pages,profile,head){
 // The cover's product name follows the "for the period ended ..." statement;
 // the first financial-highlight page repeats the same title. Ignore mentioned
 // underlying ETFs and any future successor-manager disclosure in body prose.
 const cover=String(pages?.[0]?.text||'').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 const index=cover.findIndex(s=>/\bfor\s+the\s+period\s*ended\s+\w+\s+\d{1,2},?\s+20\d{2}/i.test(s));
 if(index>=0){
  const candidate=cover.slice(index+1,index+4).find(s=>/^Invesco\s+(?!20\d{2}\b).{5,180}\b(?:Fund|Portfolio|ETF)$/i.test(s));
  if(candidate)return candidate;
 }
 for(const p of (pages||[]).slice(1,4)){
  const lines=String(p.text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const candidate=lines[0];
  if(/^Invesco\s+(?!20\d{2}\b).{5,180}\b(?:Fund|Portfolio|ETF)$/i.test(candidate)&&
   lines.some(s=>/for\s+the\s+period\s*ended/i.test(s)))return candidate;
 }
 return undefined;
}
function selectReportDate_invesco(pages){
 const lines=String(pages?.[0]?.text||'').split(/\r?\n/);
 const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
 for(const line of lines){
  const m=/for\s+the\s+period\s*ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})/i.exec(line);
  if(m)return `${m[3]}-${months[m[1].toLowerCase()]}-${m[2].padStart(2,'0')}`;
 }
 return reportDate(pages);
}
// @mrfp:extraction
function invescoNorm(s){return String(s||'').normalize('NFKC').replace(/\u00ad/g,'').replace(/\s+/g,' ').trim();}
function invescoPageTitleMatches(text,fund){
 const title=invescoNorm(text).toLowerCase(), expected=invescoNorm(fund).toLowerCase();
 // A few Invesco pages contain a duplicated PDF text layer in the running
 // header ("InvescoInvesco BalancedBalanced ..."). This is a geometry/text
 // artifact, not a different fund. Accept only exact whole-title duplication.
 const double=expected.split(/\s+/).map(word=>word+word).join(' ');
 return title===expected||title===double;
}
function invescoSeries(s){
 // v7-5: dynamic complete token; heading-year and current MER/PTR tables
 // still provide the independent source validation. No prefix truncation.
 return mrfpV7SeriesLabel(invescoNorm(s));
}
function invescoPrimaryMer(line){
 const t=invescoNorm(line),m=/^Management\s*expense\s*ratio\b/i.exec(t);
 if(!m||/\b(?:including|before|waived|absorbed|excluding)\b/i.test(t.slice(m[0].length)))return {found:false,value:null};
 const tail=t.slice(m[0].length).replace(/^\s*(?:\(\d+\)|\d+\s*\(\d+\))\s*/, '');
 const match=/(?:\d+(?:\.\d+)?\s*%|\*\*|N\/?A|[—–−-]{1,2})(?=\s|$)/i.exec(tail);
 if(!match)return {found:false,value:null};
 const raw=match[0].replace(/\s+/g,'');
 const numeric=/^\d+(?:\.\d+)?%$/.test(raw);
 return {found:true,value:numeric?Number(raw.slice(0,-1)):null,missing:!numeric};
}
function invescoPortfolioTurnover(line){
 const t=invescoNorm(line),m=/^Portfolio\s*turnover\s*rate\b/i.exec(t);
 if(!m)return {found:false,value:null};
 const tail=t.slice(m[0].length).replace(/^\s*\(\d+\)\s*/,'');
 const token=/(?:\d+(?:\.\d+)?\s*%|N\/?A|[—–−-]{1,2})(?=\s|$)/i.exec(tail);
 if(!token)return {found:false,value:null};
 const raw=token[0].replace(/\s+/g,'');
 return {found:true,value:/^\d+(?:\.\d+)?%$/.test(raw)?Number(raw.slice(0,-1)):null};
}
function invescoTableYear(lines,start,reportDate){
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(reportDate||'');
 if(!iso)return false;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const datePrefix=new RegExp('^'+months[Number(iso[2])-1]+'\\s+'+Number(iso[3])+',?\\b','i');
 for(let i=start+1;i<Math.min(lines.length,start+9);i++){
  const t=invescoNorm(lines[i]);
  if(!/^20\d{2}(?:\s+20\d{2}){0,7}\s*$/.test(t))continue;
  const firstDate=lines.slice(start+1,i).map(invescoNorm).find(s=>/^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i.test(s));
  return t.split(/\s+/)[0]===iso[1] && !!firstDate && datePrefix.test(firstDate.replace(/,/g,''));
 }
 return false;
}
function extract_invesco(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const bySeries=new Map(),conflicts=new Set();
 let ptrSource=null,ptrConflict=false;
 for(const page of pages||[]){
  const lines=String(page.text||'').split(/\r?\n/).map(invescoNorm);
  if(!invescoPageTitleMatches(lines[0],fund))continue;
  const hasFinancial=lines.slice(0,10).some(s=>/^Financial\s+highlights$/i.test(s));
  if(!hasFinancial)continue;
  // Only the Fund level ratios section owns the PTR. It applies to every
  // published series table. Never borrow a PTR from narrative or prior years.
  for(let i=0;i<lines.length;i++){
   if(!/^Fund\s+level\s+ratios$/i.test(lines[i]))continue;
   if(!invescoTableYear(lines,i,date))continue;
   const end=lines.findIndex((s,j)=>j>i&&/^Management\s+fees$/i.test(s));
   const region=lines.slice(i+1,end>i?end:Math.min(lines.length,i+18));
   const turnover=region.map(invescoPortfolioTurnover).find(r=>r.found);
   if(turnover){
    if(ptrSource&&ptrSource.value!==turnover.value)ptrConflict=true;
    else ptrSource={value:turnover.value,page:page.page};
   }
  }
  const headings=lines.map((s,i)=>({cls:invescoSeries(s),i})).filter(h=>h.cls);
  for(let h=0;h<headings.length;h++){
   const current=headings[h];
   if(!invescoTableYear(lines,current.i,date))continue;
   const next=headings[h+1];
   const block=lines.slice(current.i+1,next?next.i:lines.length);
   if(!block.some(s=>/^Ratios\s*\/\s*supplemental\s+data$/i.test(s)))continue;
   const mark=block.findIndex(s=>/^Ratios\s*\/\s*supplemental\s+data$/i.test(s));
   const part=block.slice(mark+1);
   const mer=part.map(invescoPrimaryMer).find(r=>r.found);
   if(!mer)continue; // do not fabricate a Series seen only in a narrative
   const prev=bySeries.get(current.cls);
   if(prev&&prev.value!==mer.value)conflicts.add(current.cls);
   else bySeries.set(current.cls,{cls:current.cls,value:mer.value,page:page.page});
  }
 }
 if(!ptrSource||ptrConflict)return [];
 return [...bySeries.values()].filter(x=>!conflicts.has(x.cls)).map(x=>({
  cls:x.cls,quality:2,
  values:{MER:x.value,TER:null,PTR:ptrSource.value},
  evidence:{
   ...(x.value!==null?{MER:{page:x.page,source:'Invesco current-period Series Management Expense Ratio',method:'native-js'}}:{}),
   ...(ptrSource.value!==null?{PTR:{page:ptrSource.page,source:'Invesco current-period fund-level Portfolio Turnover Rate',method:'native-js'}}:{})
  }
 }));
}
// @mrfp:evidence
const evidencePolicy_invesco={stamps:{invescoRatioLocatorVersion:1}};
// Validate that the viewed PDF page itself belongs to the extracted fund,
// then use its Series/Fund-level financial table and latest-period column.
// The same PTR rectangle can legitimately serve multiple Series records.
function invescoEvText(s){return String(s||'').normalize('NFKC').replace(/\u00ad/g,'').replace(/\s+/g,' ').trim();}
function invescoEvPageTitleMatches(text,fund){
 const title=invescoEvText(text).toLowerCase(),expected=invescoEvText(fund).toLowerCase();
 return title===expected||title===expected.split(/\s+/).map(word=>word+word).join(' ');
}
function invescoEvSeries(s){return mrfpV7SeriesLabel(invescoEvText(s));}
function invescoEvDateHeader(lines,heading,iso){
 const year=String(iso||'').slice(0,4);
 if(!/^20\d{2}$/.test(year))return null;
 const candidates=lines.filter(l=>l.y<heading.y-2&&heading.y-l.y<65)
  .map(l=>({line:l,years:l.items.filter(it=>/^20\d{2}$/.test(invescoEvText(it.str)))}))
  .filter(o=>o.years.length>=2).sort((a,b)=>b.line.y-a.line.y);
 if(!candidates.length)return null;
 const years=candidates[0].years.sort((a,b)=>a.x-b.x);
 if(invescoEvText(years[0].str)!==year)return null;
 const first=years[0];
 // Confirm the month/day ABOVE the first-year column, particularly when an
 // Interim 2025 table also has a prior Annual 2025 comparison column.
 const stamp=/^20\d{2}-(\d{2})-(\d{2})$/.exec(iso||'');
 if(!stamp)return null;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const targetMonth=months[Number(stamp[1])-1],targetDay=Number(stamp[2]);
 const dateItems=lines.filter(l=>l.y>candidates[0].line.y+2&&l.y<heading.y-2).flatMap(l=>l.items);
 const monthMatches=dateItems.filter(it=>invescoEvText(it.str).toLowerCase()===targetMonth.toLowerCase()&&it.x<=first.x+2&&first.x-it.x<48);
 const dayMatches=dateItems.filter(it=>Number(invescoEvText(it.str).replace(/[,]$/,''))===targetDay&&
  Math.abs(it.x+(Number(it.w)||0)/2-(first.x+(Number(first.w)||0)/2))<27);
 if(monthMatches.length!==1||dayMatches.length!==1)return null;
 return {center:first.x+(Number(first.w)||0)/2,y:candidates[0].line.y};
}
function locateCell_invesco(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key)||!Array.isArray(page.items)||page.ocrUsed)return null;
 const report=String(row.report_date||'');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(report))return null;
 const pageLines=String(page.text||'').split(/\r?\n/).map(invescoEvText).filter(Boolean);
 if(!invescoEvPageTitleMatches(pageLines[0],row.fund_name)||!pageLines.slice(0,8).some(s=>/^Financial\s+highlights$/i.test(s)))return null;
 // A printed '**' Series I MER is undefined. No highlight is constructed.
 if(value===null||value===undefined)return null;
 const ordered=[...lines].sort((a,b)=>b.y-a.y);
 const isHeading=key==='PTR'?s=>/^Fund\s+level\s+ratios$/i.test(invescoEvText(s)):
  s=>invescoEvSeries(s)===row.class_name;
 const sections=ordered.filter(l=>isHeading(l.text));
 const all=[];
 for(const head of sections){
  const next=ordered.find(l=>l.y<head.y-3&&(invescoEvSeries(l.text)||/^Fund\s+level\s+ratios$|^Management\s+fees$/i.test(invescoEvText(l.text))));
  const lower=next?next.y:head.y-285;
  const header=invescoEvDateHeader(ordered,head,report);
  if(!header)continue;
  const metric=ordered.filter(l=>l.y<Math.min(header.y,head.y)-2&&l.y>lower+1).filter(l=>
   key==='MER'?/^Management\s*expense\s*ratio\b/i.test(invescoEvText(l.text))&&
    !/\b(?:including|before|waived|absorbed)\b/i.test(invescoEvText(l.text)):
    /^Portfolio\s*turnover\s*rate\b/i.test(invescoEvText(l.text)));
  // Fund-level PTR labels and the underlying share-class MER are unique by
  // exact heading, accounting period, and year-column geometry.
  for(const l of metric){
   const matches=cells(l).filter(c=>matchesCell(c,value)&&
    Math.abs(c.x+c.box.w/2-header.center)<17&&c.x>210);
   for(const c of matches)all.push(c);
  }
 }
 const unique=new Map(all.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 if(unique.size!==1)return null;
 const c=[...unique.values()][0];
 return {...c,page:page.page,metric:key,kind:'invesco-current-period-labelled-ratio'};
}
