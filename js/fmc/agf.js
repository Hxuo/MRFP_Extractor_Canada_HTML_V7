/* FMC adapter: AGF Investments Inc.
 * One issuer, fund-independent detection, extraction and evidence rules.
 * Keep all PDF text/coordinates immutable; only label strings are normalized
 * in temporary parser/locator views for PDFs with compacted text layers.
 */
// @mrfp:profile
const profile_agf={
 key:'agf',label:'AGF Investments',style:'agf_new',
 // Issuer signatures and product-title shape, never individual fund names.
 signatures:[/^[ \t]*AGF\s+[^\n]{4,150}?(?:Fund|Class|Portfolio|ETF|Pool|Trust)[ \t]*$/im,/\bAGF Investments Inc\./i],
 title:/^\s*(AGF\s+[^\n]{4,150}?(?:Fund|Class|Portfolio|ETF|Pool|Trust))\s*$/im
};
const fmcConfig_agf={issuerPrefix:/^AGF\s/i,preferProfileLineTitle:true};
// The first running header on page 2 is a complete, source-printed title.
// AGF cover/title fonts can collapse spaces in PDF.js's assembled text;
// reconstruct *only* this verified header from native text items, not from
// product-name dictionaries, investment narratives, or portfolio holdings.
function identifyFundEarly_agf(pages){
 const pg=pages[1],items=(pg?.items||[]).filter(it=>it&&typeof it.str==='string'&&it.str.trim()&&Number.isFinite(it.x)&&Number.isFinite(it.y));
 if(!items.length)return undefined; // Preserve the existing text-only title path.
 const highest=Math.max(...items.map(it=>it.y));
 const head=items.filter(it=>Math.abs(it.y-highest)<2.8).sort((a,b)=>a.x-b.x);
 const datestamp=head.find(it=>/^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}$/i.test(it.str.trim()));
 if(!datestamp)return undefined;
 const title=head.filter(it=>it.x<datestamp.x-3).map(it=>it.str.trim()).join(' ').replace(/\s+/g,' ').trim();
 return /^AGF\s+.{6,150}\b(?:Fund|Class|Portfolio|ETF|Pool|Trust)$/i.test(title)?title:undefined;
}

// @mrfp:extraction
// Some AGF native text layers collapse layout words ("SeriesFUnits",
// "Managementexpenseratio") while other reports retain normal spaces.
// Only restore known *generic* financial label grammar, never digits or names.
function normalizeAgfLabels(text){
 return String(text||'')
  .replace(/\bMutual\s*Fund\s*(Units|Shares)\b/gi,(_,unit)=>'Mutual Fund '+unit)
  .replace(/\bSeries\s*([A-Z][A-Z0-9-]{0,8})\s*(Units|Shares)\b/gi,(_,series,unit)=>'Series '+series+' '+unit)
  .replace(/Ratios\s*\/\s*Supplemental\s*Data/gi,'Ratios/Supplemental Data')
  .replace(/\bManagement\s*expense\s*ratio\b/gi,'Management expense ratio')
  .replace(/\bTrading\s*expense\s*ratio\b/gi,'Trading expense ratio')
  .replace(/\bPortfolio\s*turnover\s*rate\b/gi,'Portfolio turnover rate')
  .replace(/\bbefore\s*waivers\s*or\b/gi,'before waivers or')
  .replace(/\bwaivers\s*or\s*absorptions\b/gi,'waivers or absorptions');
}
function parseAGF(pages){
 const normalized=pages.map(pg=>({...pg,
  text:normalizeAgfLabels(pg.text),
  leftText:normalizeAgfLabels(pg.leftText),
  rightText:normalizeAgfLabels(pg.rightText)
 }));
 return parseClassColumns(normalized,{splitColumns:true,heading:(line)=>{
  const m=/^\s*((?:Mutual\s+Fund|Series\s*[A-Z][A-Z0-9-]{0,8})\s+(?:Units|Shares))\s*[-–]\s*Ratios\s*\/\s*Supplemental\s+Data\b/i.exec(line);
  return m?m[1].replace(/\s+/g,' ').trim():null;
 }});
}
// One fund-level ratio panel (no distinct Class/Series printed). The period
// and row values must be independently confirmed within the same panel.
// Never use Series O/S references to *underlying* investments as headings.
function agfFundLevelRatios(pages,fund,date){
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');
 if(!iso||!/^AGF\s+.+\b(?:Fund|Class|Portfolio|ETF|Pool|Trust)$/i.test(fund||''))return [];
 const y=Number(iso[1]),month=Number(iso[2]),day=Number(iso[3]);
 const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
 const candidates=[];
 for(const pg of pages){
  for(const side of [pg.leftText,pg.rightText]){
   if(!side)continue;
   const lines=normalizeAgfLabels(side).split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim());
   for(let i=0;i<lines.length;i++){
    if(!/^Ratios\s*\/\s*Supplemental\s+Data(?:\s*\(\d+\))?$/i.test(lines[i]))continue;
    // Require a single well-formed current-period year row immediately below
    // the ratio heading, not dates in a footnote or unrelated table.
    const header=lines.slice(i+1,i+5);
    const h=header.findIndex(x=>/^For the periods ended\b/i.test(x));
    if(h<1||h>2)continue;
    const years=(header[h].match(/\b20\d{2}\b/g)||[]).map(Number);
    if(years.length<2||years[0]!==y||!years.every((v,j)=>j===0||v<years[j-1]))continue;
    const monthLine=header[h-1];
    const m=/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s*(\d{1,2})\b/i.exec(monthLine);
    if(!m||months[m[1].toLowerCase()]!==month||Number(m[2])!==day)continue;
    // This is a fund-level panel. Never borrow a separate Series/Class table.
    const body=lines.slice(i+1,i+23);
    if(body.some(x=>/^(?:Series|Class)\s+[A-Z][A-Z0-9-]*\b/i.test(x)))continue;
    const matched={};
    for(const [key,rx] of Object.entries({MER:/^Management expense ratio\b/i,PTR:/^Portfolio turnover rate\b/i})){
     const rows=body.filter(x=>rx.test(x) && (key!=='MER'||!/\b(?:before|waivers|absorptions)\b/i.test(x)));
     if(rows.length!==1){matched[key]=null;continue;}
     const line=rows[0],tail=line.slice(rx.exec(line)[0].length);
     const vals=[...tail.matchAll(/(?:^|\s)(\d{1,4}(?:,\d{3})*(?:\.\d+)?|\.\d+)\s*%/g)].map(m=>Number(m[1].replace(/,/g,'')));
     matched[key]=vals.length>=2&&Number.isFinite(vals[0])?vals[0]:null;
    }
    if(matched.MER===null||matched.PTR===null)continue;
    candidates.push({cls:fund,values:{MER:matched.MER,TER:null,PTR:matched.PTR},
     quality:2,evidence:{MER:{page:pg.page,source:'AGF fund-level current-period MER',method:'native-js'},PTR:{page:pg.page,source:'AGF fund-level current-period PTR',method:'native-js'}}});
   }
  }
 }
 // Multiple qualifying panels are ambiguous; do not create duplicate rows.
 return candidates.length===1?candidates:[];
}
function extract_agf(pages,p,fund,date){
 const standard=parseAGF(pages);
 return standard.length?standard:agfFundLevelRatios(pages,fund,date);
}

// @mrfp:evidence
const evidenceLayout_agf={issuerPeriodBandAgf:true};
// Legacy saved-record stamps retained for History compatibility.
const evidencePolicy_agf={stamps:{bmoAgfLocatorVersion:1}};

// Build separate engine and evidence bundles: each requires its own local
// label normalizer; never mutate actual PDF.js tokens or their geometry.
function normalizeAgfEvidenceLabel(text){
 return String(text||'')
  .replace(/\bMutual\s*Fund\s*(Units|Shares)\b/gi,(_,unit)=>'Mutual Fund '+unit)
  .replace(/\bSeries\s*([A-Z][A-Z0-9-]{0,8})\s*(Units|Shares)\b/gi,(_,series,unit)=>'Series '+series+' '+unit)
  .replace(/Ratios\s*\/\s*Supplemental\s*Data/gi,'Ratios/Supplemental Data')
  .replace(/\bManagement\s*expense\s*ratio\b/gi,'Management expense ratio')
  .replace(/\bTrading\s*expense\s*ratio\b/gi,'Trading expense ratio')
  .replace(/\bPortfolio\s*turnover\s*rate\b/gi,'Portfolio turnover rate')
  .replace(/\bbefore\s*waivers\s*or\b/gi,'before waivers or')
  .replace(/\bwaivers\s*or\s*absorptions\b/gi,'waivers or absorptions');
}
// Locate the actual numeric token in a fund-level Ratios/Supplemental Data
// panel. The source period, first year column, metric label, and exact cell
// must all agree. Work in the physical left/right column separately so
// explanatory notes alongside the table can never supply a false row.
function agfFundLevelCell(page,row,key,value){
 if(!page||!Array.isArray(page.items)||!page.items.length||page.ocrUsed||!fundOnPage(page,row))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso||!['MER','PTR'].includes(key))return null;
 const yr=Number(iso[1]),month=Number(iso[2]),day=Number(iso[3]);
 const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
 const mid=(page.width||612)/2,results=[];
 for(const [lo,hi] of [[0,mid-8],[mid+2,(page.width||612)+5]]){
  const lines=textLines(page.items.filter(it=>it.x>=lo&&it.x<hi));
  const sections=lines.filter(l=>/^Ratios\s*\/\s*Supplemental\s+Data(?:\s*\(\d+\))?$/i.test(normalizeAgfEvidenceLabel(l.text).trim()));
  if(sections.length!==1)continue;
  const section=sections[0];
  const heads=lines.filter(l=>l.y<section.y-2&&section.y-l.y<48&&/^For the periods ended\b/i.test(l.text));
  if(heads.length!==1)continue;
  const yearLine=heads[0];
  const yearTokens=yearLine.items.filter(it=>/^20\d{2}$/.test(it.str.trim())).sort((a,b)=>a.x-b.x);
  if(yearTokens.length<2||Number(yearTokens[0].str)!==yr||!yearTokens.every((it,i)=>i===0||Number(it.str)<Number(yearTokens[i-1].str)))continue;
  const current=tokenCenter(yearTokens[0]);
  const monthLines=lines.filter(l=>l.y>yearLine.y+2&&l.y<section.y&&/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s*\d{1,2}\b/i.test(l.text));
  if(monthLines.length!==1)continue;
  const monthCells=monthLines[0].items.filter(it=>{
   const m=/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s*(\d{1,2})\b/i.exec(it.str);
   return m&&months[m[1].toLowerCase()]===month&&Number(m[2])===day&&Math.abs(tokenCenter(it)-current)<18;
  });
  if(monthCells.length!==1)continue;
  const bottom=yearLine.y-125;
  const rowRx={MER:/^Management expense ratio\b/i,PTR:/^Portfolio turnover rate\b/i}[key];
  const metrics=lines.filter(l=>l.y<yearLine.y-5&&l.y>bottom&&rowRx.test(normalizeAgfEvidenceLabel(l.text))&&
   (key!=='MER'||!/\b(?:before|waivers|absorptions)\b/i.test(normalizeAgfEvidenceLabel(l.text))));
  if(metrics.length!==1)continue;
  const label=metrics[0].items.find(it=>rowRx.test(normalizeAgfEvidenceLabel(it.str)));
  if(!label||label.x>=current-55)continue;
  const start=yearTokens.length>1?(current+tokenCenter(yearTokens[1]))/2:current+25;
  const matches=cells(metrics[0]).filter(c=>!c.isMissing&&matchesCell(c,value)&&c.x>label.x+65&&
   tokenCenter({x:c.x,w:c.box.w})>current-15&&tokenCenter({x:c.x,w:c.box.w})<start);
  if(matches.length===1)results.push(matches[0]);
 }
 const uniq=new Map(results.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}
function locateCell_agf(page,lines,row,key,value,context){
 // The established source locator validates the actual class heading, date
 // column, metric label and value. Normalize only label STRINGS on a temporary
 // copy of the original PDF.js tokens; numeric cells and geometry stay exact.
 const adapted={...page,items:(page.items||[]).map(it=>{
  const str=normalizeAgfEvidenceLabel(it.str);
  return str===it.str?it:{...it,str};
 })};
 const hit=issuerPeriodBandCell(adapted,row,key,value,row.fmc_key);
 if(hit)return {...hit,page:page.page,metric:key,kind:row.fmc_key+'-verified-series-year-metric-cell'};
 // New AGF fund-level ratio tables have no distinct Class/Series heading.
 // Require explicit Fund Name as Class (not an arbitrary saved Series label).
 if(key==='TER'||compactName(row.class_name)!==compactName(row.fund_name))return null;
 const located=agfFundLevelCell(adapted,row,key,value);
 return located?{...located,page:page.page,metric:key,kind:'agf-fund-level-first-period-ratio-cell'}:null;
}
