/* v7: recognized Class/Series designation grammar, NOT a financial-data extractor.
 * The actual manager, ratio table, reporting period and original source cells
 * remain required by the FMC's validated extraction/evidence strategies.
 * Bundled identically in extraction and evidence; never substring-match a label.
 */
function mrfpV7SeriesLabel(raw,{allowYearColumns=false}={}){
 const s=String(raw||'').normalize('NFKC').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
 if(!s||s.length>180)return null;
 // Distinct headings may share one table; retain the complete combined label.
 const parts=s.split(/\s*\/\s*(?=(?:Series|Class)\s+[A-Za-z]|[A-Za-z][A-Za-z'-]{2,30}(?:\s+[A-Za-z][A-Za-z'-]{2,30})?\s+Series\b|ETF\s+(?:Series\s+)?(?:Units|Shares)\b)/i);
 if(parts.length>3)return null;
 const names=[];
 for(let n=0;n<parts.length;n++){
  let p=parts[n].trim();let m=null,label=null;
  // Check distinct ETF units before shorter "ETF Series" prefix.
  m=/^(ETF\s+Series\s+Units|ETF\s+Units|ETF\s+Series\s+Shares|ETF\s+Shares|ETF\s+Series)(?=\s|$|[\*†‡])/i.exec(p);
  if(m)label='ETF '+m[1].replace(/^ETF\s+/i,'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/\s+/g,' ');
  else {
   // Complete alphanumeric code; never turn "Series PW5" into "Series PW".
   // Deliberately reject "Series A(N)" rather than silently truncating it.
   m=/^(Series|Class)\s+([A-Z][A-Z0-9-]{0,11})(?=\s|$|[\*†‡])/i.exec(p);
   if(m)label=m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()+' '+m[2].toUpperCase();
   else {
    // Named two-word/three-word headings, not a list of known brand names.
    m=/^([A-Za-z][A-Za-z'-]{2,30}(?:\s+[A-Za-z][A-Za-z'-]{2,30})?)\s+Series(?=\s|$|[\*†‡])/i.exec(p);
    if(!m)return null;
    label=m[1].replace(/\b\w/g,c=>c.toUpperCase())+' Series';
   }
  }
  let tail=p.slice(m[0].length).trim();
  if(!/^(?:ETF (?:Series )?(?:Units|Shares))$/i.test(label)){
   let sfx=/^(Units?|Shares?)(?=\s|$|[\*†‡])/i.exec(tail);
   if(sfx){label+=' '+sfx[1].replace(/^./,c=>c.toUpperCase());tail=tail.slice(sfx[0].length).trim();}
  }
  tail=tail.replace(/^[\*†‡]+/,'').trim();
  if(n<parts.length-1 && tail)return null;
  if(n===parts.length-1 && tail){
   if(!allowYearColumns)return null;
   // Year-column tail ONLY; do not treat arbitrary financial prose as a heading.
   if(!tail.split(/\s+/).every(t=>/^(?:20\d{2}|(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])|[—–-])$/.test(t)))return null;
  }
  names.push(label);
 }
 return names.join(' / ');
}

// v7 baseline: an ADDITIONAL independently printed ratio table can name its
// own Class/Series. This recognizer is deliberately geometry-bound: a name in
// fee prose, a cover, or an isolated heading does not establish a ratio table.
// Both extraction and evidence bundles embed this exact helper.
function mrfpV7IndependentRatioClass(page,date){
 if(!page||!Array.isArray(page.items)||!page.items.length||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return null;
 const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const sections=page.items.filter(it=>/^Ratios?\s*(?:and|&)\s*Supplemental\s*Data(?:\s*\(Based on Net Asset Value\))?$/i.test(norm(it.str)));
 if(sections.length!==1)return null;
 const section=sections[0];
 const candidates=page.items.filter(it=>Number.isFinite(it.x)&&Number.isFinite(it.y)
   &&it.x>=25&&it.x<Math.min(210,(page.width||612)*.4)
   &&it.y>section.y+2&&it.y<section.y+64)
   .map(it=>mrfpV7SeriesLabel(it.str)).filter(s=>s&&/^(?:Series|Class)\s+[A-Z][A-Z0-9-]*$/i.test(s));
 const unique=[...new Set(candidates.map(s=>s.toUpperCase()))];
 if(unique.length!==1)return null;
 const txt=norm(page.text||'');
 if(!/\bManagement\s+expense\s+ratio\b/i.test(txt)||!/\bPortfolio\s+turnover\s+(?:rate|ratio)\b/i.test(txt))return null;
 const year=date.slice(0,4);
 // Require at least one current-year token in the financial table page.
 if(!page.items.some(it=>new RegExp('(?:^|\\D)'+year+'(?=$|\\D)').test(norm(it.str))))return null;
 const c=unique[0].split(' ');return c[0][0]+c[0].slice(1).toLowerCase()+' '+c[1];
}

// Additional-table MER/PTR extraction. Metric data must come from the same
// physical ratio panel, never the manager's narrative or a prefilled value.
function mrfpV7NamedRatioValues(page,date){
 const cls=mrfpV7IndependentRatioClass(page,date);if(!cls)return null;
 const text=String(page.text||'');const lines=text.split(/\r?\n/);
 const ix=lines.findIndex(s=>/^\s*Ratios?\s*(?:and|&)\s*Supplemental\s*Data\b/i.test(s));
 if(ix<0)return null;
 const nearby=lines.slice(ix+1,ix+17);
 const metricRx={MER:/^\s*Management\s+expense\s+ratio\b(?!\s+before|\s+excluding)/i,
  PTR:/^\s*Portfolio\s+turnover\s+(?:rate|ratio)\b/i,
  TRADE:/^\s*Trading\s+expense\s+ratio\b/i};
 const vals={MER:null,TER:null,PTR:null};
 for(const [metric,re] of Object.entries(metricRx)){
  const matched=nearby.filter(s=>re.test(s));if(matched.length!==1)return null;
  const label=matched[0],start=re.exec(label)[0].length;
  // A footnote may append text next to the label; locate the FIRST numeric
  // reporting column after the full label, not a number in a footnote.
  const after=label.slice(start);
  // Skip reference markers only as bounded complete tokens; never strip the
  // leading digits of the actual first-year ratio such as 10.78%.
  const pct=/([0-9]+(?:\.[0-9]+)?)\s*%/.exec(after);
  const bare=/\s+([0-9]+(?:\.[0-9]+)?)(?=\s|$)/.exec(after);
  const n=pct?Number(pct[1]):bare?Number(bare[1]):NaN;
  if(!Number.isFinite(n)||n<0)return null;
  if(metric==='TRADE')continue; // TER denotes TOTAL Expense Ratio, not trading.
  vals[metric]=n;
 }
 return {cls,values:vals,quality:3,evidence:{MER:{page:page.page,source:'Independently labelled '+cls+' MER ratio table',method:'native-js'},PTR:{page:page.page,source:'Independently labelled '+cls+' PTR ratio table',method:'native-js'}}};
}


// Cross-page safeguard. A newly named panel does not create a SECOND row if
// it simply relabels the only original financial table in the document.
function mrfpV7OtherIndependentRatioPage(pages,namedPage,date){
 const year=String(date||'').slice(0,4);
 return Array.isArray(pages)&&pages.some(pg=>pg.page!==namedPage.page&&
   /^20\d{2}$/.test(year) &&
   /Ratios?\s*(?:and|&)\s*Supplemental\s*Data/i.test(pg.text||'')&&
   /\bManagement\s+expense\s+ratio\b/i.test(pg.text||'')&&
   /\bPortfolio\s+turnover\s+(?:rate|ratio)\b/i.test(pg.text||'')&&
   (pg.items||[]).some(it=>new RegExp('(?:^|\\D)'+year+'(?=$|\\D)').test(String(it.str||''))));
}
