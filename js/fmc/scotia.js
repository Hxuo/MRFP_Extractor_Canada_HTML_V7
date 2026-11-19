/* FMC adapter: scotia. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_scotia={key:'scotia',label:'ScotiaFunds / 1832 Asset Management',style:'scotia_b2',signatures:[/\bTangerine\b[^\n]{0,160}\bPortfolio\b/i,/www\.scotiafunds\.com/i,/Scotia\s+U\.S\.\s*\$\s*Balanced Fund/i],title:/^\s*((?:Scotia\s+[^\n]{5,150}?\bFund|Tangerine\s+[^\n]{5,150}?\bPortfolio))\s*$/im};

const fmcConfig_scotia={issuerPrefix:/^(?:Scotia|Tangerine)\s/i};

// @mrfp:extraction

function scotiaGroupLines(page){
 const groups=[];
 for(const it of (page.items||[])){
  if(typeof it.str!=='string'||!it.str.trim()||!Number.isFinite(it.x)||!Number.isFinite(it.y))continue;
  let line=groups.find(g=>Math.abs(g.y-it.y)<Math.max(1.5,Math.min(2.8,(Number(it.h)||8)*.25)));
  if(!line){line={y:it.y,items:[]};groups.push(line);}
  line.items.push(it);
 }
 groups.sort((a,b)=>b.y-a.y);
 for(const line of groups){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(it=>it.str).join(' ').replace(/\s+/g,' ').trim();}
 return groups;
}
function scotiaDateRx(date){
 const m=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(date||'');if(!m)return null;
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 return new RegExp('^'+months[Number(m[2])-1]+'[a-z]*\\.?\\s+'+Number(m[3])+',?\\s+'+m[1]+'$','i');
}
function scotiaIsDateLine(line,rx){return !!rx&&line.items.some(it=>rx.test(String(it.str||'').trim()));}
function scotiaHeaderAnchors(lines,section){
 const items=lines.filter(l=>l.y<section.y&&section.y-l.y<65).flatMap(l=>l.items);
 const one=rx=>{const found=items.filter(it=>rx.test(String(it.str||'').trim()));return found.length===1?found[0]:null;};
 const management=one(/^Management$/i),before=one(/^MER before$/i),trading=one(/^Trading$/i),ptr=one(/^Portfolio turnover$/i);
 const expense=items.filter(it=>/^expense ratio$/i.test(String(it.str||'').trim()));
 if(!management||!before||!trading||!ptr||expense.length!==2)return null;
 const center=it=>it.x+(Number(it.w)||0)/2;
 const anchors={MER:center(management),before:center(before),trading:center(trading),PTR:center(ptr)};
 if(!(anchors.MER<anchors.before&&anchors.before<anchors.trading&&anchors.trading<anchors.PTR))return null;
 return anchors;
}
function scotiaReadColumn(line,anchor){
 const hits=[];
 for(const it of line.items){
  const raw=String(it.str||'').trim();if(!raw)continue;
  const center=it.x+(Number(it.w)||0)/2;
  if(Math.abs(center-anchor)>27)continue;
  const value=toNumber(raw);
  if(value!==null)hits.push({value,raw,x:it.x,y:line.y,w:Number(it.w)||0,h:Number(it.h)||8});
 }
 return hits.length===1?hits[0]:null;
}
function scotiaGeometryRows(pages,fund,date){
 const dateRx=scotiaDateRx(date);if(!dateRx)return [];
 const output=new Map();
 for(const page of pages){
  if(!Array.isArray(page.items)||!page.items.length)continue;
  const lines=scotiaGroupLines(page);
  const sections=lines.filter(l=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+Data\.?$/i.test(l.text));
  for(const section of sections){
   const anchors=scotiaHeaderAnchors(lines,section);if(!anchors)continue;
   const series=lines.filter(l=>l.y<section.y-22&&l.y>Math.max(section.y-410,40)&&
    l.items.some(it=>it.x<140&&/^Series\s+[A-Za-z0-9-]+(?:\s*\(USD\))?$/i.test(String(it.str||'').trim())))
    .sort((a,b)=>b.y-a.y);
   const blocks=[];
   if(series.length){
    for(let i=0;i<series.length;i++){
     const label=series[i].items.find(it=>it.x<140&&/^Series\s+/i.test(String(it.str||'').trim()));
     const cls=String(label?.str||'').replace(/\s+/g,' ').trim();
     const bottom=series[i+1]?.y??Math.max(section.y-410,40);
     const rows=lines.filter(l=>l.y<series[i].y-1&&l.y>bottom+1&&scotiaIsDateLine(l,dateRx));
     if(rows.length===1)blocks.push({cls,line:rows[0]});
    }
   }else if(/\bETF\b/i.test(fund||'')){
    const rows=lines.filter(l=>l.y<section.y-1&&l.y>Math.max(section.y-410,40)&&scotiaIsDateLine(l,dateRx));
    // Only infer a generic ETF unit label when the financial table has no
    // explicit Series blocks and exactly one current-period row.
    if(rows.length===1)blocks.push({cls:'ETF Units',line:rows[0]});
   }
   for(const block of blocks){
    const mer=scotiaReadColumn(block.line,anchors.MER),ptr=scotiaReadColumn(block.line,anchors.PTR);
    if(!mer||!ptr)continue;
    output.set(block.cls,{cls:block.cls,values:{MER:mer.value,TER:null,PTR:ptr.value},quality:3,evidence:{}});
   }
  }
 }
 return [...output.values()];
}
function scotiaTextRows(pages,fund,date){
 const dateRx=scotiaDateRx(date);if(!dateRx)return [];
 const out=new Map();
 for(const page of pages){
  const lines=String(page.text||'').split(/\r?\n/);let section=false,series=null;
  for(const raw of lines){
   if(/^\s*Ratios?\s+(?:and|&)\s+Supplemental\s+Data\.?\s*$/i.test(raw)){section=true;series=null;continue;}
   if(!section)continue;
   const heading=/^\s*(Series\s+[A-Za-z0-9-]+(?:\s*\(USD\))?)\s*$/i.exec(raw);
   if(heading){series=heading[1].replace(/\s+/g,' ').trim();continue;}
   const row=/^\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2})\s+(.+)$/i.exec(raw);
   if(!row||!dateRx.test(row[1].replace(/\s+/g,' ').trim()))continue;
   const tokens=row[2].match(/(?:n\/?a|[—–−-]|\d[\d,]*(?:\.\d+)?\*?)/gi)||[];
   if(tokens.length<7)continue;
   const cls=series||( /\bETF\b/i.test(fund||'')?'ETF Units':null);if(!cls)continue;
   const mer=toNumber(tokens[2]),ptr=toNumber(tokens[5]);
   if(mer===null||ptr===null)continue;
   out.set(cls,{cls,values:{MER:mer,TER:null,PTR:ptr},quality:3,evidence:{}});
  }
 }
 return [...out.values()];
}
function scotiaCompactName(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');}
function scotiaTangerineMetricLine(lines,key,section){
 const label=key==='MER'?/^Management\s+expense\s+ratio(?:\s*\d+)?$/i:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\d+)?$/i;
 return lines.find(line=>line.y<section.y&&section.y-line.y<105&&line.items.some(item=>label.test(String(item.str||'').trim())));
}
function scotiaTangerineReadCell(line,anchor){
 const hits=[];
 for(const item of line?.items||[]){
  const raw=String(item.str||'').trim();if(!raw)continue;
  const center=item.x+(Number(item.w)||0)/2;
  if(Math.abs(center-anchor)>18)continue;
  const value=toNumber(raw);
  if(value!==null)hits.push({value,raw,x:item.x,y:line.y,w:Number(item.w)||0,h:Number(item.h)||8});
  else if(/^[—–−-]{1,2}$/.test(raw))hits.push({value:null,raw,x:item.x,y:line.y,w:Number(item.w)||0,h:Number(item.h)||8});
 }
 return hits.length===1?hits[0]:null;
}
function scotiaTangerineGeometryValues(page,date){
 if(!Array.isArray(page.items)||!page.items.length)return null;
 const year=String(Number(String(date||'').slice(0,4)));if(!/^20\d{2}$/.test(year))return null;
 const lines=scotiaGroupLines(page);
 for(const section of lines.filter(line=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+data\.?$/i.test(line.text))){
  const yearMarks=lines.filter(line=>line.y>section.y&&line.y-section.y<300)
   .flatMap(line=>line.items.filter(item=>String(item.str||'').trim()===year).map(item=>({item,line})));
  if(yearMarks.length!==1)continue;
  const anchor=yearMarks[0].item.x+(Number(yearMarks[0].item.w)||0)/2;
  const merLine=scotiaTangerineMetricLine(lines,'MER',section),ptrLine=scotiaTangerineMetricLine(lines,'PTR',section);
  if(!merLine||!ptrLine)continue;
  const mer=scotiaTangerineReadCell(merLine,anchor),ptr=scotiaTangerineReadCell(ptrLine,anchor);
  if(!mer||!ptr)continue;
  return {values:{MER:mer.value,TER:null,PTR:ptr.value},cells:{MER:mer,PTR:ptr}};
 }
 return null;
}
function scotiaTangerineTextValues(page,date){
 const lines=String(page.text||'').split(/\r?\n/);
 const year=String(Number(String(date||'').slice(0,4)));
 const sectionIndex=lines.findIndex(line=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+data\.?$/i.test(line.trim()));
 const yearIndex=lines.findIndex(line=>new RegExp('^\\s*'+year+'(?:\\s+20\\d{2}){1,5}\\s*$').test(line.trim()));
 if(!/^20\d{2}$/.test(year)||sectionIndex<0||yearIndex<0||yearIndex>sectionIndex)return null;
 const tableLines=lines.slice(sectionIndex+1);
 const read=(key)=>{
  const re=key==='MER'?/^\s*Management\s+expense\s+ratio(?:\s*\d+)?\s+(.+)$/i:/^\s*Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\d+)?\s+(.+)$/i;
  for(const line of tableLines){const match=re.exec(line);if(!match)continue;
   if(key==='MER'&&/^\s*before\b/i.test(match[1]))continue;
   const token=(match[1].match(/[—–−-]{1,2}|\d[\d,]*(?:\.\d+)?%?/g)||[])[0];
   if(token!==undefined)return toNumber(token);
  }
  return undefined;
 };
 const MER=read('MER'),PTR=read('PTR');
 if(MER===undefined||PTR===undefined)return null;
 return {values:{MER,TER:null,PTR},cells:null};
}
function scotiaTangerineRows(pages,fund,date){
 if(!/^Tangerine\s+.+\bPortfolio$/i.test(fund||'')||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 for(const page of pages){
  const text=String(page.text||'');
  if(!/Ratios?\s+(?:and|&)\s+Supplemental\s+data/i.test(text)||!scotiaCompactName(text).includes(scotiaCompactName(fund)))continue;
  const parsed=scotiaTangerineGeometryValues(page,date)||scotiaTangerineTextValues(page,date);
  if(!parsed)continue;
  const evidence={};
  for(const key of ['MER','PTR'])evidence[key]={page:page.page,source:'Tangerine Financial Highlights — current reporting-year column',method:Array.isArray(page.items)&&page.items.length?'native-js':'text-fallback'};
  return [{cls:fund,values:parsed.values,quality:3,evidence}];
 }
 return [];
}
function extract_scotia(pages,p,fund,date){
 // Tangerine is a 1832-managed portfolio brand with one fund-level ratio row,
 // not a Scotia Series/Class table. Keep this strategy isolated from the
 // existing Scotia multi-series and ETF Units extraction paths.
 const tangerine=scotiaTangerineRows(pages,fund,date);if(tangerine.length)return tangerine;
 const geometric=scotiaGeometryRows(pages,fund,date);if(geometric.length)return geometric;
 const text=scotiaTextRows(pages,fund,date);if(text.length)return text;
 // Keep the established 1832 multi-series parser as a compatibility fallback
 // for legacy Scotia layouts not yet represented by the coordinate strategy.
 return parse1832Complete(pages);
}
// Non-mutating series completeness audit for this issuer.
function auditRatioHeadings_scotia(source,potential){
 let text=source;const ix=text.search(/Ratios?\s+and\s+Supplemental\s+Data/i);
 // Pages without the ratio heading may continue the dated table with
   // 'As at' and a row of management/trading expense labels.
   if(ix<0 && !/\bAs\s+at\b/i.test(text.slice(0,650)))return;
   if(ix>=0)text=text.slice(ix);
   let foundSeries=false;
   for(const line of text.split(/\r?\n/)){
    const m=/^\s*(Series\s+[A-Z][A-Z0-9]*(?:\s*\(USD\))?|ETF(?:H)?\s+Series)(?:\s*[–-].*)?\s*$/i.exec(line);
    if(m){potential.add(m[1].replace(/\s+/g,' '));foundSeries=true;}
   }
   if(!foundSeries&&/\bETF\b/i.test(source)&&/Ratios?\s+(?:and|&)\s+Supplemental\s+Data/i.test(source))potential.add('ETF Units');
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_scotia={stamps:{penderScotiaLocatorVersion:3}};
function scotiaTangerineCell(page,lines,row,key,value){
 if(String(row.class_name||'').trim()!==String(row.fund_name||'').trim()||!/^Tangerine\s+.+\bPortfolio$/i.test(row.fund_name||'')||!['MER','PTR'].includes(key))return null;
 if(!compactName(page.text).includes(compactName(row.fund_name)))return null;
 const year=String(Number(String(row.report_date||'').slice(0,4)));if(!/^20\d{2}$/.test(year))return null;
 const sections=lines.filter(line=>/^Ratios?\s+(?:and|&)\s+Supplemental\s+data\.?$/i.test(line.text.trim()));
 const found=[];
 for(const section of sections){
  const yearMarks=lines.filter(line=>line.y>section.y&&line.y-section.y<300)
   .flatMap(line=>line.items.filter(item=>String(item.str||'').trim()===year));
  if(yearMarks.length!==1)continue;
  const anchor=tokenCenter(yearMarks[0]);
  const label=key==='MER'?/^Management\s+expense\s+ratio(?:\s*\d+)?$/i:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\d+)?$/i;
  const metricLine=lines.find(line=>line.y<section.y&&section.y-line.y<105&&line.items.some(item=>label.test(String(item.str||'').trim())));
  if(!metricLine)continue;
  const hits=cells(metricLine).filter(cell=>matchesCell(cell,value)&&Math.abs(cell.box.x+cell.box.w/2-anchor)<15);
  if(hits.length===1)found.push({...hits[0],kind:'scotia-tangerine-current-year-ratio-cell'});
 }
 const uniq=new Map(found.map(cell=>[cell.box.x.toFixed(2)+':'+cell.box.y.toFixed(2),cell]));
 return uniq.size===1?[...uniq.values()][0]:null;
}
function scotiaCell(page,lines,row,key,value){
 if(/^Tangerine\s+.+\bPortfolio$/i.test(row.fund_name||'')&&String(row.class_name||'').trim()===String(row.fund_name||'').trim())return scotiaTangerineCell(page,lines,row,key,value);
 if(!compactName(page.text).includes(compactName(row.fund_name)))return null;
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(row.report_date||'');
 if(!iso)return null;
 const year=Number(iso[1]),month=Number(iso[2]),day=Number(iso[3]);
 const mon=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][month-1];
 if(!mon||day<1||day>31)return null;
 const dateRx=new RegExp('^'+mon+'[a-z]*\\.?\\s+'+day+',?\\s*'+year+'$','i');
 const sections=lines.filter(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data\.?$/i.test(l.text.trim()));
 const isEtfUnits=/^ETF\s+Units$/i.test(row.class_name||'');
 const isSeries=/^Series\s+[A-Za-z0-9-]+(?:\s*\(USD\))?$/i.test(row.class_name||'');
 if(!isEtfUnits&&!isSeries)return null;
 const found=[];
 for(const section of sections){
  const headers=lines.filter(l=>l.y<section.y&&section.y-l.y<65).flatMap(l=>l.items);
  const find=rx=>headers.filter(it=>rx.test(it.str.trim()));
  const mgmt=find(/^Management$/i),before=find(/^MER before$/i),trading=find(/^Trading$/i),ptr=find(/^Portfolio turnover$/i);
  const expense=find(/^expense ratio$/i);
  if(mgmt.length!==1||before.length!==1||trading.length!==1||ptr.length!==1||expense.length!==2)continue;
  const anchors={MER:tokenCenter(mgmt[0]),TER:tokenCenter(trading[0]),PTR:tokenCenter(ptr[0])};
  if(!(anchors.MER<tokenCenter(before[0])&&tokenCenter(before[0])<anchors.TER&&anchors.TER<anchors.PTR))continue;
  if(!expense.some(it=>Math.abs(it.x-mgmt[0].x)<12)||!expense.some(it=>Math.abs(it.x-trading[0].x)<24))continue;
  const series=lines.filter(l=>l.y<section.y-22&&l.y>Math.max(section.y-410,40)&&
   l.items.some(it=>it.x<140&&/^Series\s+[A-Za-z0-9-]+(?:\s*\(USD\))?$/i.test(it.str.trim())))
   .sort((a,b)=>b.y-a.y);
  if(isEtfUnits){
   // The ETF's ratio table has no printed class/series heading. Accept only
   // one matching current-period row and only when no Series blocks exist.
   if(series.length)continue;
   const dated=lines.filter(l=>l.y<section.y-1&&l.y>Math.max(section.y-410,40)&&
    l.items.some(it=>dateRx.test(it.str.trim())));
   if(dated.length!==1)continue;
   const marks=cells(dated[0]);
   const hits=marks.filter(c=>matchesCell(c,value)&&Math.abs(c.x+c.box.w/2-anchors[key])<27);
   if(hits.length===1)found.push(hits[0]);
   continue;
  }
  for(let i=0;i<series.length;i++){
   const label=series[i].items.find(it=>it.x<140&&/^Series\s+/i.test(it.str.trim()));
   if(clean(label?.str)!==clean(row.class_name))continue;
   const bottom=series[i+1]?.y??Math.max(section.y-410,40);
   const dated=lines.filter(l=>l.y<series[i].y-1&&l.y>bottom+1&&
    l.items.some(it=>it.x<140&&dateRx.test(it.str.trim())));
   if(dated.length!==1)continue;
   const marks=cells(dated[0]).concat(dated[0].items.filter(it=>/^n\s*\/?\s*a$/i.test(it.str.trim())).map(it=>({value:null,isMissing:true,raw:it.str,x:it.x,box:{x:it.x-1,y:it.y-1,w:it.w+2,h:it.h+2}})));
   const targetX=anchors[key],otherX=tokenCenter(before[0]);
   const hits=marks.filter(c=>matchesCell(c,value)&&
    Math.abs(c.x+c.box.w/2-targetX)<27&&
    (key!=='MER'||c.x+c.box.w/2<(targetX+otherX)/2));
   if(hits.length===1)found.push(hits[0]);
  }
 }
 const uniq=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}

// Hamilton and Vanguard annual ETF tables: a single explicitly labelled
// financial-ratio block with year columns, independent of fund-specific pages
// or numerical values. Never identify MER by matching the adjacent waiver row.


function locateCell_scotia(page,lines,row,key,value,context){const selected=scotiaCell(page,lines,row,key,value);return selected?{...selected,page:page.page,metric:key,kind:selected.kind||row.fmc_key+'-verified-series-period-header-cell'}:null;}
