/* IA Clarington Investments Inc. — Elite-family MRFP table integration.
 * Legal-manager identity and dynamic titles; independent left/right Series
 * ratios, strict source-year/date validation, independent metric coordinates.
 * No fund-title, report-year, Series-value or PDF-page allowlist.
 */
// @mrfp:profile
const profile_ia_clarington={
 key:'ia_clarington',label:'IA Clarington Investments Inc.',style:'ia_clarington',
 signatures:[
  /\bIA\s+Clarington\s+Investments\s+Inc\.?(?:\s+is\s+the\b|\s*\n[^\n]*\n\s*is\s+the\s+manager\b)/i,
  /\bIA\s+Clarington\s+Investments\s+Inc\.?\b/i,
  /\bIA\s+Clarington\s+Investments\s+Inc\.?\s+is\s+the\b[\s\S]{0,130}?\bmanager\b/i
 ],
 title:null // Title is resolved ONLY after validated legal-manager ownership; generic unbranded titles cannot claim unrelated PDFs.
};
const fmcConfig_ia_clarington={allowRowFallback:false,titleScanPages:2};

// @mrfp:extraction
function ia49Clean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function ia49CoverHasClass(s){
 const text=ia49Clean(s);
 if(mrfpV7SeriesLabel(text))return true;
 // The cover may list several codes in one "Series A, F, PW and T5 Units" line.
 // Reject unrelated narrative or an unrecognized, partial class token.
 const m=/^Series\s+([A-Z][A-Z0-9-]{0,11}(?:\s*(?:,|and|&)\s*[A-Z][A-Z0-9-]{0,11})+)\s+(?:Units?|Shares?)$/i.exec(text);
 return !!m;
}
function ia49Identity(pages){
 if(!Array.isArray(pages)||pages.length<4)return null;
 const cover=String(pages[0]?.text||'').split(/\r?\n/).map(ia49Clean).filter(Boolean);
 const m=/^([A-Z][A-Za-z0-9 &'’.,()\-]{10,165}\b(?:Fund|Pool|Portfolio|ETF))$/i.exec(cover[0]||'');
 if(!m||!ia49CoverHasClass(cover[1]||''))return null;
 const report=/^(Annual|Interim)\s+Management Report of Fund Performance$/i.exec(cover[2]||'');
 if(!report)return null;
 const dm=/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})$/i.exec(cover[3]||'');
 if(!dm)return null;
 const months={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
 const mn=months[dm[1].toLowerCase()],day=Number(dm[2]),year=Number(dm[3]);
 const valid=new Date(Date.UTC(year,mn-1,day));
 if(valid.getUTCFullYear()!==year||valid.getUTCMonth()+1!==mn||valid.getUTCDate()!==day)return null;
 const fullDate=year+'-'+String(mn).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 const body=ia49Clean(pages[1]?.leftText||pages[1]?.text||'');
 if(!/\bIA\s+Clarington\s+Investments\s+Inc\.?\s+is\s+the\b[\s\S]{0,130}?\bmanager\b/i.test(body))return null;
 const page2=(pages[1]?.text||'').split(/\r?\n/).slice(0,8).map(ia49Clean);
 if(!page2.some(line=>line===m[1])||!page2.some(line=>line===ia49Clean(cover[3])))return null;
 if(!body.toLowerCase().includes(m[1].toLowerCase()))return null;
 return {fund:m[1],date:fullDate,year,type:report[1].toLowerCase(),
         md:String(mn).padStart(2,'0')+'/'+String(day).padStart(2,'0')};
}
function identifyFundEarly_ia_clarington(pages){return ia49Identity(pages)?.fund||'Unknown Fund';}
function selectReportDate_ia_clarington(pages){return ia49Identity(pages)?.date||null;}
function ia49Series(line){return mrfpV7SeriesLabel(ia49Clean(line),{allowYearColumns:true});}
function ia49RatioSection(s){return /^Ratios and Supplemental Data$/i.test(ia49Clean(s));}
function ia49RatioTables(page,doc){
 if(!page?.items?.length||!page?.width||page.ocrUsed)return [];
 const halves=[page.leftText,page.rightText].map(x=>String(x||'').split(/\r?\n/).map(ia49Clean).filter(Boolean));
 const found=[];
 for(let side=0;side<2;side++){
  const lines=halves[side];
  for(let i=0;i<lines.length;i++){
   if(!ia49RatioSection(lines[i]))continue;
   const next=lines.findIndex((s,j)=>j>i&&ia49RatioSection(s));
   const end=next>=0?next:Math.min(i+45,lines.length);
   const header=lines.slice(i+1,Math.min(end,i+5));
   const md=header.find(x=>new RegExp('^'+doc.md.replace('/','\\/')+'(?:\\s|$)').test(x));
   const seriesLine=header.find(x=>ia49Series(x)&&new RegExp('\\b'+doc.year+'\\b').test(x));
   if(!md||!seriesLine)continue;
   // Month/day AND year must match the current reporting period. In
   // September 2025 tables, March 2025 is a *historical* column.
   const firstDates=[...md.matchAll(/\b\d{2}\/\d{2}\b/g)].map(x=>x[0]);
   const yearValues=[...seriesLine.matchAll(/\b20\d{2}\b/g)].map(x=>Number(x[0]));
   if(firstDates.length<2||firstDates.length>6||firstDates[0]!==doc.md||
      yearValues.length!==firstDates.length||yearValues[0]!==doc.year||
      yearValues.some((v,j)=>j>0&&v>yearValues[j-1]))continue;
   const cls=ia49Series(seriesLine);if(!cls)continue;
   const body=lines.slice(i+1+header.indexOf(seriesLine)+1,Math.min(i+28,end));
   const pattern={
    MER:/^Management expense ratio\s*\(\s*%\s*\)/i,
    BEFORE:/^Management expense ratio before\b/i,
    PTR:/^Portfolio turnover rate\s*\(\s*%\s*\)/i,
    TRADING:/^Trading expense ratio\s*\(\s*%\s*\)/i
   };
   const metric={};let valid=true;
   for(const [key,rx] of Object.entries(pattern)){
    const rows=body.filter(s=>rx.test(s));
    if(rows.length!==1){valid=false;break;}
    const text=rows[0].replace(rx,'').trim();
    const number=/^(\d{1,3}\.\d{1,3})\b/.exec(text);
    if(!number){valid=false;break;}
    metric[key]=Number(number[1]);
   }
   if(!valid||metric.MER>100||metric.BEFORE>100||metric.TRADING>100||metric.PTR>10000||
      Object.values(metric).some(x=>!Number.isFinite(x)||x<0))continue;
   found.push({cls,mer:metric.MER,ptr:metric.PTR,page:page.page,side});
  }
 }
 return found;
}
function extract_ia_clarington(pages,p,fund,date){
 const doc=ia49Identity(pages);
 if(!doc||doc.fund!==fund||doc.date!==date)return [];
 const found=[];
 for(const page of pages){
  if(!/Ratios and Supplemental Data/i.test(page.text||''))continue;
  found.push(...ia49RatioTables(page,doc));
 }
 const occurrence=new Map();for(const v of found)occurrence.set(v.cls,(occurrence.get(v.cls)||0)+1);
 return found.filter(v=>occurrence.get(v.cls)===1).map(v=>({cls:v.cls,quality:3,
  values:{MER:v.mer,PTR:v.ptr,TER:null},evidence:{
   MER:{page:v.page,source:'Current-period Series Management Expense Ratio (%)',method:'native-js'},
   PTR:{page:v.page,source:'Current-period Series Portfolio Turnover Rate (%)',method:'native-js'}
  }}));
}
function auditRatioHeadings_ia_clarington(text,potential){
 const lines=String(text||'').split(/\r?\n/).map(ia49Clean);
 for(let i=0;i<lines.length;i++)if(ia49RatioSection(lines[i])){
  const candidate=lines.slice(i+1,i+5).map(ia49Series).find(Boolean);
  if(candidate)potential.add(candidate);
 }
}

// @mrfp:evidence
const evidencePolicy_ia_clarington={stamps:{iaClaringtonFinancialEvidenceVersion:1}};
function ia49EvClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function ia49EvIdentity(pages){
 if(!pages?.length||pages.length<4)return null;
 const cover=String(pages[0].text||'').split(/\r?\n/).map(ia49EvClean).filter(Boolean);
 const title=/^([A-Z][A-Za-z0-9 &'’.,()\-]{10,165}\b(?:Fund|Pool|Portfolio|ETF))$/i.exec(cover[0]||'');
 const kind=/^(Annual|Interim)\s+Management Report of Fund Performance$/i.exec(cover[2]||'');
 const dt=/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})$/i.exec(cover[3]||'');
 if(!title||!kind||!dt||!mrfpV7SeriesLabel(cover[1]||'')&&!/^(?:Series|Class)\s+[A-Z][A-Z0-9, &-]+\s+(?:Units?|Shares?)$/i.test(cover[1]||''))return null;
 const months={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
 const mn=months[dt[1].toLowerCase()],day=Number(dt[2]),year=Number(dt[3]);
 const valid=new Date(Date.UTC(year,mn-1,day));
 if(valid.getUTCFullYear()!==year||valid.getUTCMonth()+1!==mn||valid.getUTCDate()!==day)return null;
 const left=ia49EvClean(pages[1].leftText||pages[1].text||'');
 if(!/\bIA\s+Clarington\s+Investments\s+Inc\.?\s+is\s+the\b[\s\S]{0,130}?\bmanager\b/i.test(left)||
    !left.toLowerCase().includes(title[1].toLowerCase()))return null;
 return {fund:title[1],date:year+'-'+String(mn).padStart(2,'0')+'-'+String(day).padStart(2,'0'),
 md:String(mn).padStart(2,'0')+'/'+String(day).padStart(2,'0'),year};
}
function validateDocumentEvidence_ia_clarington(pages,row){
 const d=ia49EvIdentity(pages);
 return !!d&&row.fmc_key==='ia_clarington'&&row.fund_name===d.fund&&row.report_date===d.date&&
  mrfpV7SeriesLabel(row.class_name||'')===row.class_name;
}
function ia49EvLines(items){return textLines(items);}
function ia49EvSeries(s){return mrfpV7SeriesLabel(ia49EvClean(s),{allowYearColumns:true});}
function locateCell_ia_clarington(page,lines,row,key,value){
 if(!['MER','PTR'].includes(key)||!Number.isFinite(Number(value))||page.ocrUsed||
    !Array.isArray(page.items)||!page.items.length||!Number.isFinite(page.width))return null;
 const head=String(page.text||'').split(/\r?\n/).map(ia49EvClean).slice(0,6);
 const [y,m,d]=String(row.report_date||'').split('-').map(Number);
 const monthNames=['','January','February','March','April','May','June','July','August','September','October','November','December'];
 if(!head.includes(row.fund_name)||!head.includes(monthNames[m]+' '+d+', '+y))return null;
 const md=String(m).padStart(2,'0')+'/'+String(d).padStart(2,'0'),year=y;
 const candidates=[];
 for(let side=0;side<2;side++){
  const lower=side===0?0:page.width/2,upper=side===0?page.width/2:page.width;
  const items=page.items.filter(it=>it.x>=lower&&it.x<upper);
  const ll=ia49EvLines(items);
  for(let i=0;i<ll.length;i++){
   if(!/^Ratios and Supplemental Data$/i.test(ll[i].text))continue;
   const stop=ll.findIndex((l,j)=>j>i&&/^Ratios and Supplemental Data$/i.test(l.text));
   const end=stop>=0?stop:Math.min(ll.length,i+30);
   const header=ll.slice(i+1,Math.min(i+5,end));
   const dateLine=header.find(l=>l.text.startsWith(md+' '));
   const clsLine=header.find(l=>ia49EvSeries(l.text)===row.class_name&&new RegExp('\\b'+year+'\\b').test(l.text));
   if(!dateLine||!clsLine)continue;
   const dates=[...dateLine.text.matchAll(/\b\d{2}\/\d{2}\b/g)].map(x=>x[0]);
   const years=[...clsLine.text.matchAll(/\b20\d{2}\b/g)].map(x=>Number(x[0]));
   if(dates.length<2||dates.length>6||years.length!==dates.length||years[0]!==year||dates[0]!==md||
      years.some((y,j)=>j>0&&y>years[j-1]))continue;
   const expectedFirstYear=clsLine.items.filter(it=>new RegExp('^'+year+'$').test(ia49EvClean(it.str))).sort((a,b)=>a.x-b.x)[0];
   if(!expectedFirstYear)continue;
   const block=ll.slice(ll.indexOf(clsLine)+1,Math.min(end,ll.indexOf(clsLine)+23));
   // The label is exactly 'Management expense ratio (%)', never the
   // adjacent 'before waivers' or the management-fee schedule.
   const rx={MER:/^Management expense ratio\s*\(\s*%\s*\)/i,
             PTR:/^Portfolio turnover rate\s*\(\s*%\s*\)/i};
   const getMetric=(k)=>block.filter(l=>rx[k].test(l.text));
   const matching=getMetric(key),mer=getMetric('MER'),ptr=getMetric('PTR');
   if(matching.length!==1||mer.length!==1||ptr.length!==1||
      !block.some(l=>/^Trading expense ratio\s*\(\s*%\s*\)/i.test(l.text))||
      !block.some(l=>/^Management expense ratio before\b/i.test(l.text)))continue;
   const cellFor=l=>l.items.filter(it=>/^(?:\d{1,3}\.\d{1,3}|0\.\d{1,3})$/.test(ia49EvClean(it.str))&&
      Math.abs((it.x+it.w/2)-(expectedFirstYear.x+expectedFirstYear.w/2))<13)
      .sort((a,b)=>a.x-b.x);
   // Companion MER binds otherwise repeated PTR values to THIS Series.
   const mr=cellFor(mer[0]),pr=cellFor(ptr[0]);
   if(mr.length!==1||pr.length!==1)continue;
   const companion=Object.hasOwn(row.originalValues||{},'MER')?row.originalValues.MER:row.MER;
   if(!Number.isFinite(Number(companion))||Math.abs(Number(mr[0].str)-Number(companion))>1e-7)continue;
   const chosen=key==='MER'?mr[0]:pr[0];
   if(Math.abs(Number(chosen.str)-Number(value))>1e-7||!(chosen.w>0&&chosen.h>0))continue;
   candidates.push({page:page.page,box:{x:Math.max(0,chosen.x-1),y:chosen.y-1,w:chosen.w+2,h:chosen.h+2},raw:chosen.str,
    kind:'ia-clarington-series-current-period-'+key.toLowerCase()+'-v1'});
  }
 }
 return candidates.length===1?candidates[0]:null;
}
