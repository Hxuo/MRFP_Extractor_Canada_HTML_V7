/* Capstone Asset Management Inc. — issuer-specific fund-section MRFP reader.
 * Supports multiple separately titled funds within one document. Recognize
 * printed report headings and ratio sections; never route by fund-name lists,
 * filename, ticker, year or fixed page numbers.
 */
// @mrfp:profile
const profile_capstone={
 key:'capstone',label:'Capstone Asset Management Inc.',style:'capstone',
 signatures:[
  // Strong issuer ownership is a fund-family CEO cover or the explicit
  // Capstone Manager/Trustee statement; not a passing reference in holdings.
  /(?:\bFor\s+the\s+Capstone\s+Biblically\s+Informed\s+Funds\b|\bCapstone\s*Asset\s+Management\s+Inc\.?\s*\(\s*the\s+["“]?Manager["”]?\s*\)\s+is\s+the\s+trustee\b)/i,
  /\bCapstone\s*Asset\s+Management(?:\s+Inc\.?)?\b/i,
  /^\s*Capstone\s+.{8,130}\bFund\s*$/im
 ],
 title:/^\s*(Capstone\s+[^\n]{8,160}\bFund)\s*$/im
};
const fmcConfig_capstone={issuerPrefix:/^Capstone\s/i,allowRowFallback:false,allowRowFundIdentity:true,titleScanPages:3};

// @mrfp:extraction
function capstoneNormalize(text){return String(text||'').replace(/\u00ad/g,'').replace(/\s+/g,' ').trim();}
function capstoneMonth(s){return {january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12}[String(s).toLowerCase()]||0;}
function capstoneToDate(y,month,d){
 const yr=Number(y),m=capstoneMonth(month),day=Number(d),dt=new Date(Date.UTC(yr,m-1,day));
 return m&&yr>=2000&&dt.getUTCFullYear()===yr&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===day
  ?`${yr}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;
}
function capstoneCoverPeriod(page){
 const head=String(page?.text||'').split(/\r?\n/).slice(0,8).join(' ');
 const match=/(?:for\s+the\s+period\s+ended\s+|\bto\s+)(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(head);
 return match?capstoneToDate(match[3],match[1],match[2]):null;
}
function selectReportDate_capstone(pages){
 const dates=(pages||[]).slice(0,2).map(capstoneCoverPeriod).filter(Boolean);
 if(!dates.length||dates.some(d=>d!==dates[0]))return null;
 // If an additional fund is published in the same PDF, its reporting period
 // must agree; never label two different report periods with one global date.
 for(const page of pages.slice(2)){
  const top=String(page.text||'').split(/\r?\n/).slice(0,8).join(' ');
  if(!/MANAGEMENT REPORT OF FUND PERFORMANCE/i.test(top))continue;
  const date=capstoneCoverPeriod(page);
  if(date&&date!==dates[0])return null;
 }
 return dates[0];
}
function capstoneStandaloneTitle(page){
 const lines=String(page?.text||'').split(/\r?\n/).slice(0,22).map(capstoneNormalize);
 if(!lines.slice(0,8).some(l=>/\bMANAGEMENT REPORT OF FUND PERFORMANCE\b/i.test(l)))return null;
 const candidates=lines.filter(l=>/^Capstone\s+.{8,150}\s+Fund$/i.test(l));
 return candidates.length===1?candidates[0]:null;
}
function capstoneFundSections(pages){
 const covers=[];
 for(let i=0;i<pages.length;i++){
  const name=capstoneStandaloneTitle(pages[i]);if(name)covers.push({at:i,fund:name});
 }
 if(!covers.length || covers.some((x,i)=>i>0&&x.fund===covers[i-1].fund))return [];
 return covers.map((item,i)=>({fund:item.fund,start:item.at,end:covers[i+1]?.at??pages.length}));
}
function identifyFundEarly_capstone(pages){
 const sections=capstoneFundSections(pages);
 return sections[0]?.fund; // row-level fund IDs retain later fund sections.
}
function capstoneClass(s){
 const m=/^(Series\s+[A-Z][A-Z0-9-]{0,12}|ETF\s+Series)$/i.exec(capstoneNormalize(s));
 if(!m)return null;
 return /^ETF/i.test(m[1])?'ETF Series':'Series '+m[1].replace(/^Series\s+/i,'').toUpperCase();
}
function capstoneRatioLine(line,key,columns){
 const normalized=capstoneNormalize(line);
 const re=key==='MER'?/^Management\s*expense\s*ratio\s*\(\s*%\s*\)\s*(?:\(\s*\d+\s*\))?/i
  :/^Portfolio\s*turnover\s*rate\s*\(\s*%\s*\)\s*(?:\(\s*\d+\s*\))?/i;
 const m=re.exec(normalized);if(!m)return null;
 const tail=normalized.slice(m[0].length);
 const tokens=tail.trim().split(/\s+/).filter(Boolean);
 if(tokens.length!==columns || !tokens.every(t=>/^\d{1,4}(?:\.\d+)?$/.test(t)))return null;
 const vals=tokens.map(Number);
 return vals.every(v=>Number.isFinite(v)&&v>=0)?vals[0]:null;
}
function capstonePeriodColumns(lines,ratio,reportedDate){
 const expectedYear=reportedDate?.slice(0,4),year=Number(expectedYear);
 if(!year)return null;
 const local=lines.slice(ratio+1,ratio+5);
 const head=local.filter(s=>/^Accounting\s+Period\s+Ended\b/i.test(s));
 if(head.length!==1)return null;
 const tail=head[0].replace(/^Accounting\s+Period\s+Ended/i,'');
 const years=[...tail.matchAll(/\b20\d{2}\b/g)].map(m=>Number(m[0]));
 if(!years.length||years.length>2||years[0]!==year||years.some((n,i)=>i&&n>=years[i-1]))return null;
 const next=local[local.indexOf(head[0])+1]||'';
 const expected=reportedDate?.slice(5);
 const pairs=[...next.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2})/gi)];
 if(pairs.length!==years.length)return null;
 if(capstoneMonth(pairs[0][1])!==Number(expected?.slice(0,2))||Number(pairs[0][2])!==Number(expected?.slice(3,5)))return null;
 return years.length;
}
function capstonePageRatioRows(page,fund,date){
 const lines=String(page.text||'').split(/\r?\n/).map(capstoneNormalize).filter(Boolean);
 // The repeating footer identifies which actual reporting fund owns this
 // ratio page. The manager's shared CEO letter is not a fund cover.
 if(!lines.includes(fund)||!/Ratios\s+and\s+Supplemental\s+Data/i.test(page.text||''))return [];
 const heads=[];
 for(let i=0;i<lines.length;i++)if(capstoneClass(lines[i]))heads.push({cls:capstoneClass(lines[i]),at:i});
 const out=[];
 for(let h=0;h<heads.length;h++){
  const start=heads[h].at,end=heads[h+1]?.at??lines.length;
  const block=lines.slice(start+1,end);
  const ratios=block.flatMap((l,i)=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(l)?[i]:[]);
  if(ratios.length!==1||!block.slice(0,5).some(s=>/^Net\s+Assets\s+per\s+Unit/i.test(s)))continue;
  const idx=ratios[0],ncols=capstonePeriodColumns(block,idx,date);if(!ncols)continue;
  const section=block.slice(idx+1,idx+28);
  const mer=section.filter(l=>/^Management\s*expense\s*ratio\s*\(%\)/i.test(l));
  const ptr=section.filter(l=>/^Portfolio\s*turnover\s*rate\s*\(%\)/i.test(l));
  if(mer.length!==1||ptr.length!==1)continue;
  const MER=capstoneRatioLine(mer[0],'MER',ncols),PTR=capstoneRatioLine(ptr[0],'PTR',ncols);
  if(MER===null||PTR===null)continue;
  out.push({cls:heads[h].cls,fund_name:fund,quality:3,values:{MER,TER:null,PTR},evidence:{
   MER:{page:page.page,source:'Capstone series current-period MER ratio row',method:'native-js'},
   PTR:{page:page.page,source:'Capstone series current-period PTR ratio row',method:'native-js'}
  }});
 }
 return out;
}
function extract_capstone(pages,profile,fund,date){
 if(!date||!pages?.length)return [];
 const sections=capstoneFundSections(pages);
 if(!sections.length)return [];
 const results=[],seen=new Set();
 for(const section of sections){
  const from=pages.slice(section.start,section.end);
  const owner=from.some(pg=>/Capstone\s*Asset\s+Management\s+Inc\.[\s\S]{0,75}\bis\s+the\s+trustee/i.test(pg.text||''));
  if(!owner)continue;
  for(const pg of from){
   for(const row of capstonePageRatioRows(pg,section.fund,date)){
    const key=section.fund.toLowerCase()+'\0'+row.cls.toLowerCase();
    if(seen.has(key))return []; // Conflicting/duplicated fund-Series table; fail closed.
    seen.add(key);results.push(row);
   }
  }
 }
 return results;
}
function auditRatioHeadings_capstone(text,classes){
 // A multi-fund document may reuse identical Series names. Audit output is
 // informational only and must not deduplicate the actual fund-scoped rows.
 if(!/Ratios\s+and\s+Supplemental\s+Data/i.test(text||''))return;
 for(const l of String(text).split(/\r?\n/)){const name=capstoneClass(l);if(name)classes.add(name);}
}

// @mrfp:evidence
const evidencePolicy_capstone={stamps:{capstoneFundSectionLocatorVersion:1}};
function capstoneEvidenceName(s){return String(s||'').replace(/\s+/g,' ').trim();}
function capstoneEvidenceClass(s){
 const name=capstoneEvidenceName(s);
 const m=/^(Series\s+[A-Z][A-Z0-9-]{0,12}|ETF\s+Series)$/i.exec(name);
 return m?name.toLowerCase():null;
}
function capstoneEvidencePeriodOnPage(page,date){
 const head=String(page.text||'').split(/\r?\n/).slice(0,8).join(' ');
 const m=/(?:for\s+the\s+period\s+ended\s+|\bto\s+)(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(head);
 if(!m)return false;
 const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
 return m[3]+'-'+months[m[1].toLowerCase()]+'-'+m[2].padStart(2,'0')===date;
}
function validateDocumentEvidence_capstone(pages,row){
 if(!row||row.fmc_key!=='capstone'||!/^20\d{2}-\d{2}-\d{2}$/.test(row.report_date||''))return false;
 // The true manager relationship is in the reporting fund's own section.
 const coverIndices=[];
 for(let i=0;i<(pages||[]).length;i++){
  const lines=String(pages[i].text||'').split(/\r?\n/).slice(0,18).map(capstoneEvidenceName);
  if(!lines.slice(0,8).some(s=>/MANAGEMENT REPORT OF FUND PERFORMANCE/i.test(s)))continue;
  const titles=lines.filter(s=>/^Capstone\s+.{8,150}\s+Fund$/i.test(s));
  if(titles.length===1)coverIndices.push({start:i,fund:titles[0]});
 }
 for(let i=0;i<coverIndices.length;i++){
  const c=coverIndices[i],end=coverIndices[i+1]?.start??pages.length;
  if(c.fund!==row.fund_name)continue;
  const owned=pages.slice(c.start,end);
  if(!owned.some(pg=>/Capstone\s*Asset\s+Management\s+Inc\.[\s\S]{0,75}\bis\s+the\s+trustee/i.test(pg.text||'')))continue;
  if(!pages.slice(0,2).some(p=>capstoneEvidencePeriodOnPage(p,row.report_date)))continue;
  const ownRatio=owned.some(pg=>pg.text?.split(/\r?\n/).includes(row.fund_name)&&
    /Ratios\s+and\s+Supplemental\s+Data/i.test(pg.text||''));
  if(ownRatio)return true;
 }
 return false;
}
// Validate the complete MER/PTR pair for the named Series and fund. This
// prevents a combined document from accepting a repeated MER in the OTHER
// fund merely because that individual number happens to match.
function capstoneEvidenceRatioPair(page,row){
 const raw=String(page.text||'').split(/\r?\n/).map(capstoneEvidenceName).filter(Boolean);
 if(!raw.includes(row.fund_name))return false;
 const cls=capstoneEvidenceClass(row.class_name),heads=[];
 for(let i=0;i<raw.length;i++)if(capstoneEvidenceClass(raw[i]))heads.push({name:capstoneEvidenceClass(raw[i]),index:i});
 for(let i=0;i<heads.length;i++){
  if(heads[i].name!==cls)continue;
  const segment=raw.slice(heads[i].index+1,heads[i+1]?.index??raw.length);
  const idx=segment.findIndex(l=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(l));if(idx<0)continue;
  const header=segment.slice(idx+1,idx+5).find(l=>/^Accounting\s+Period\s+Ended\b/i.test(l));
  if(!header||!new RegExp('\\b'+row.report_date.slice(0,4)+'\\b').test(header))continue;
  const ratio=segment.slice(idx+1,idx+28);
  const mer=ratio.filter(l=>/^Management\s*expense\s*ratio\s*\(\s*%\s*\)/i.test(l));
  const ptr=ratio.filter(l=>/^Portfolio\s*turnover\s*rate\s*\(\s*%\s*\)/i.test(l));
  if(mer.length!==1||ptr.length!==1)continue;
  const value=(line,re)=>{const tail=line.replace(re,'').trim();const m=/^(\d{1,4}(?:\.\d+)?)(?=\s|$)/.exec(tail);return m?Number(m[1]):null;};
  const m=value(mer[0],/^Management\s*expense\s*ratio\s*\(\s*%\s*\)\s*(?:\(\d+\))?/i);
  const p=value(ptr[0],/^Portfolio\s*turnover\s*rate\s*\(\s*%\s*\)\s*(?:\(\d+\))?/i);
  if(Number.isFinite(m)&&Number.isFinite(p)&&Math.abs(m-row.MER)<.000001&&Math.abs(p-row.PTR)<.000001)return true;
 }
 return false;
}
function locateCell_capstone(page,lines,row,key,value){
 if((key!=='MER'&&key!=='PTR')||!page.items?.length||page.ocrUsed||!/^20\d{2}-\d{2}-\d{2}$/.test(row.report_date||''))return null;
 if(!capstoneEvidenceRatioPair(page,row))return null;
 const targetClass=capstoneEvidenceClass(row.class_name);
 if(!targetClass)return null;
 const headings=lines.filter(l=>capstoneEvidenceClass(l.text));
 const candidates=[];
 for(let hi=0;hi<headings.length;hi++){
  const heading=headings[hi];if(capstoneEvidenceClass(heading.text)!==targetClass)continue;
  const next=headings[hi+1];
  const body=lines.filter(l=>l.y<heading.y-1&&(!next||l.y>next.y+1));
  if(!body.some(l=>/^Net\s+Assets\s+per\s+Unit/i.test(l.text)))continue;
  const ratios=body.filter(l=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(l.text));
  if(ratios.length!==1)continue;
  const ratio=ratios[0];
  const years=body.filter(l=>l.y<ratio.y&&ratio.y-l.y<28&&/^Accounting\s+Period\s+Ended\b/i.test(l.text));
  if(years.length!==1)continue;
  const yearLine=years[0];
  const currentYear=Number(row.report_date.slice(0,4));
  const tokens=yearLine.items.filter(it=>/^20\d{2}$/.test(it.str.trim())).sort((a,b)=>a.x-b.x);
  if(!tokens.length||tokens.length>2||Number(tokens[0].str)!==currentYear)return null;
  const dates=body.filter(l=>l.y<yearLine.y&&yearLine.y-l.y<19);
  if(dates.length<1)continue;
  const dateText=dates.map(l=>l.text).join(' ');
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dtRx=new RegExp(monthNames[Number(row.report_date.slice(5,7))-1]+'\\s*'+Number(row.report_date.slice(8,10))+'\\b','i');
  if(!dtRx.test(dateText))continue;
  const center=tokenCenter(tokens[0]);
  const nextCenter=tokens[1]?tokenCenter(tokens[1]):null;
  if(nextCenter!==null&&nextCenter-center<20)continue;
  const re=key==='MER'?/^Management\s*expense\s*ratio\s*\(\s*%\s*\)/i:/^Portfolio\s*turnover\s*rate\s*\(\s*%\s*\)/i;
  const labelLines=body.filter(l=>l.y<yearLine.y&&l.y<ratio.y-2&&ratio.y-l.y<125&&re.test(l.text));
  if(labelLines.length!==1)continue;
  const line=labelLines[0];
  const leftLimit=line.items.filter(it=>it.x<230).reduce((hi,it)=>Math.max(hi,it.x+it.w),-Infinity);
  const matches=cells(line).filter(cell=>matchesCell(cell,value)&&cell.x>Math.max(225,leftLimit+8)
   &&Math.abs((cell.x+cell.box.w/2)-center)<24&&(nextCenter===null||(cell.x+cell.box.w/2)<(center+nextCenter)/2));
  if(matches.length!==1)continue;
  candidates.push(matches[0]);
 }
 const unique=new Map(candidates.map(c=>[c.box.x.toFixed(1)+':'+c.box.y.toFixed(1),c]));
 if(unique.size!==1)return null;
 const cell=[...unique.values()][0];
 return {...cell,page:page.page,metric:key,kind:'capstone-validated-fund-series-period-ratio-cell'};
}
