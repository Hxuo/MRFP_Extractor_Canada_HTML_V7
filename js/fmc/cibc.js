/* FMC adapter: CIBC Asset Management Inc. (CAMI).
 * The manager is identified independently of the branded product name;
 * financial tables are parsed by printed class/series headings and reporting period.
 * Never add named-fund aliases or conditions to this adapter.
 * Run `node dev-tools/build.cjs` after changes. */
// @mrfp:profile
const profile_cibc={
 key:'cibc',label:'CIBC Asset Management',style:'cibc_v22',
 signatures:[
  // Direct statement of the legal manager, including CAMI's first-use definition.
  /\b(?:CIBC Asset Management Inc\.?\s*\(\s*CAMI\s*,\s*the\s+Manager|CAMI\s*,?\s*a\s+wholly[- ]owned\s+subsidiary\s+of\s+CIBC\s*,?\s+is\s+the\b[^\n]{0,85}\bManager)\b/i,
  // CIBC/Avantis/Counterpoint reports define CAMI as the fund's Manager.
  /\bCAMI\s*,?\s*a\s+wholly[- ]owned\s+subsidiary\s+of\s+CIBC\s*,?\s+is\s+the\b[^\n]{0,85}\bManager\b/i,
  /\bCIBC Asset Management Inc\.?\b/i,
  /\b(?:info@cibcassetmanagement\.com|www\.cibc\.com\/etfs)\b/i
 ],
 title:/^\s*(CIBC\s+[^\n]{3,160}?(?:Pool|Portfolio|Fund|ETF))\s*$/im
};
const fmcConfig_cibc={titleScanPages:2};

// CIBC, Axiom, Avantis, and Counterpoint reports print the actual product title
// immediately BEFORE the "Interim/Annual Management Report" heading. Read the
// title from that position, not from a brand prefix or a holdings table.
function identifyFundEarly_cibc(pages,profile,head){
 const lines=String(pages[0]?.text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const index=lines.findIndex(s=>/^(?:Annual|Interim|Semi[- ]Annual)\s+Management\s+Report\s+of\s+Fund\s+Performance\b/i.test(s));
 if(index<1||index>9)return undefined;
 const candidate=lines.slice(Math.max(0,index-3),index)
  .filter(s=>!/^CIBC\s+(?:ASSET|GLOBAL)\s+MANAGEMENT\b/i.test(s))
  .join(' ').replace(/\s+/g,' ').trim();
 if(candidate.length>=12&&candidate.length<=190&&/\b(?:Fund|Pool|Portfolio|ETF)$/i.test(candidate))return candidate;
 return undefined;
}
// @mrfp:extraction
// Accept whatever class/series is PRINTED in the ratio table, not predefined
// product names or a fixed list of Series A/F. This also handles Common Units,
// Select/Elite Class, multi-letter classes, and ETF Series Units.
function cibcTableClass(heading){
 const cleanHeading=String(heading||'').replace(/\s+/g,' ').trim();
 if(!/\b(?:Units?|Shares?)$/i.test(cleanHeading))return null;
 if(/^(?:Series\s+[A-Za-z][A-Za-z0-9-]*|Class\s+[A-Za-z][A-Za-z0-9-]*|(?:[A-Za-z][A-Za-z0-9-]*\s+)*Class|ETF\s+Series|Common|ETF|CAD|USD)\s+(?:Units?|Shares?)$/i.test(cleanHeading))return cleanHeading;
 return null;
}
function parseCibc(pages,p,reportDateValue){
 const results=new Map(),yr=String(reportDateValue||'').slice(0,4);
 const sectionRx=/^\s*Ratios?\s+and\s+Supplemental\s+Data\s*[-–—:]\s*(.*?)\s*$/i;
 const endRx=/^\s*(?:Ratios?\s+and\s+Supplemental\s+Data\s*[-–—:]|The\s+.+?\s+Net\s+Assets\s+per\s+Unit|Past\s+Performance\b|Management\s+Fees\b|Summary\s+of\s+Investment\s+Portfolio\b)/i;
 for(const pg of pages){
  const lines=String(pg.text||'').split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const match=sectionRx.exec(lines[i]);if(!match)continue;
   const cls=cibcTableClass(match[1]);if(!cls)continue;
   // Verify a year printed for THIS table: avoid grabbing performance,
   // explanatory text, or an older-year table for this class.
   const top=lines.slice(i+1,i+5).join(' ');
   const years=[...top.matchAll(/\b(20\d{2})(?:[a-z*])?\b/gi)].map(m=>m[1]);
   if(!yr||!years.length||years[0]!==yr)continue;
   let end=i+1;
   while(end<lines.length&&(end===i+1||!endRx.test(lines[end])))end++;
   const metrics=v22Metrics(lines.slice(i+1,end).join('\n'));
   // Do not return a plausible-but-unverified partial class record.
   if(metrics.quality<2||(metrics.values.MER===null&&metrics.values.PTR===null))continue;
   const previous=results.get(cls);
   if(!previous || metrics.quality>previous.quality){
    results.set(cls,{cls,...metrics,evidence:{
     MER:{page:pg.page,source:'CIBC labelled MER row in class and latest-year table',method:'native-js'},
     PTR:{page:pg.page,source:'CIBC labelled PTR row in class and latest-year table',method:'native-js'}
    }});
   }
  }
 }
 return [...results.values()];
}
function extract_cibc(pages,p,fund,date){return parseCibc(pages,p,date);}
// @mrfp:evidence
const evidencePolicy_cibc={stamps:{cibcRatioLocatorVersion:1}};
// A source cell needs all of: the PDF's OWN title, a printed class heading,
// the latest reporting-period year, the exact financial label, and a matching
// numeric cell at the latest-year column. Same MER/PTR values across classes
// must still resolve to physically separate source rectangles.
function locateCell_cibc(page,lines,row,key,value,context){
 if(!['MER','PTR'].includes(key)||!Array.isArray(page.items)||page.ocrUsed)return null;
 if(!fundOnPage(page,row))return null;
 const targetYear=String(row.report_date||'').slice(0,4);
 if(!/^20\d{2}$/.test(targetYear))return null;
 const sectionRx=/^Ratios?\s+and\s+Supplemental\s+Data\s*[-–—:]\s*(.+)$/i;
 const name=clean(row.class_name);
 const sections=lines.filter(l=>{
  const m=sectionRx.exec(clean(l.text));return !!m&&clean(m[1])===name;
 });
 const matches=[];
 const label=key==='MER'?/^Management\s+Expense\s+Ratio\b/i:/^Portfolio\s+Turnover\s+(?:Rate|Ratio)\b/i;
 for(const section of sections){
  const yrLines=lines.filter(l=>l.y<section.y&&section.y-l.y<50&&l.items.some(it=>new RegExp('^'+targetYear+'(?:[a-z*])?$','i').test(it.str.trim())));
  if(!yrLines.length)continue;
  const closest=yrLines.sort((a,b)=>b.y-a.y)[0];
  const headers=closest.items.filter(it=>/^20\d{2}(?:[a-z*])?$/.test(it.str.trim())).sort((a,b)=>a.x-b.x);
  // CIBC tables put latest year in the first numeric column. Reject rows
  // whose reporting year is only present in a historical comparison column.
  if(!headers.length||!new RegExp('^'+targetYear+'(?:[a-z*])?$','i').test(headers[0].str.trim()))continue;
  const center=tokenCenter(headers[0]);
  const followingSection=lines.filter(l=>l.y<section.y-3&&section.y-l.y<360&&
   (sectionRx.test(clean(l.text))||/^(?:The\s+.+?Net\s+Assets\s+per\s+Unit|Management\s+Fees|Past\s+Performance)\b/i.test(clean(l.text))))
   .sort((a,b)=>b.y-a.y)[0];
  const lower=followingSection?followingSection.y:section.y-210;
  const candidates=lines.filter(l=>l.y<closest.y-2&&l.y>lower+1&&
   l.items.some(it=>label.test(String(it.str||'').trim())));
  for(const candidate of candidates){
   if(key==='MER'&&/\bbefore\s+waivers\b|\babsorptions\b/i.test(candidate.text))continue;
   const hits=cells(candidate).filter(c=>matchesCell(c,value)&&Math.abs(c.x+c.box.w/2-center)<22);
   if(hits.length===1)matches.push(hits[0]);
  }
 }
 const unique=new Map(matches.map(c=>[c.box.x.toFixed(1)+':'+c.box.y.toFixed(1),c]));
 if(unique.size!==1)return null;
 const cell=[...unique.values()][0];
 return {...cell,page:page.page,metric:key,kind:'cibc-current-period-labelled-class-ratio'};
}
