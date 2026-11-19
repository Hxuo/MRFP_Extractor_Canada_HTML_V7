/* RGP Investments Inc. (formerly R.E.G.A.R. Gestion Privée Inc.)
 * GreenWise / RGP native-text MRFPs, English and French. No fund titles,
 * class codes, reporting years, values, or ratio-page numbers are hardcoded.
 * One validated row per published current-period Class ratio section.
 */
// @mrfp:profile
const profile_rgp={
 key:'rgp',label:'RGP Investments Inc.',style:'rgp',
 signatures:[
  /^(?:GreenWise\s+[^\n]{3,150}Portfolio|Portefeuille\s+GreenWise\s+[^\n]{3,150})[\s\S]{0,2800}?\b(?:rgpinvestments|rgpinvestissements)\.ca\b/im,
  /\bRGP\s+Investments\s+Inc\.?\s*\(formerly\s+R\.E\.G\.A\.R\./i,
  /\bR\.E\.G\.A\.R\.\s+Gestion\s+Priv[ée]e\s+inc\.?\b/i
 ],
 title:/^\s*((?:GreenWise\s+[A-Za-zÀ-ÿ0-9 &'’().-]{3,125}\s+Portfolio)|(?:Portefeuille\s+GreenWise\s+[A-Za-zÀ-ÿ0-9 &'’().-]{3,125}))\s*$/im
};
const fmcConfig_rgp={allowRowFallback:false,preferProfileLineTitle:true,titleScanPages:3};

// @mrfp:extraction
function rgpClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function rgpTitleLine(s){
 const line=rgpClean(s);
 return /^(?:GreenWise\s+[A-Za-zÀ-ÿ0-9 &'’().-]{3,125}\s+Portfolio|Portefeuille\s+GreenWise\s+[A-Za-zÀ-ÿ0-9 &'’().-]{3,125})$/i.test(line)?line:null;
}
function rgpOwner(pages){
 const body=pages.slice(0,7).map(p=>String(p.text||'')).join('\n');
 // Company name alone in a holdings list or website footer is NOT a manager role.
 return /\bRGP\s+Investments\s+Inc\.?\s*\(formerly\s+R\.E\.G\.A\.R\.[\s\S]{0,80}?\)\s+is\s+the\s+Manager\s*,\s*Trustee/i.test(body)
  ||/\bRGP\s+Investments\s+Inc\.?[\s\S]{0,65}?is\s+the\s+Manager\s*,\s*Trustee\s+and\s+Portfolio\s+Advisor/i.test(body)
  ||/\bR\.E\.G\.A\.R\.\s+Gestion\s+Priv[ée]e\s+inc\.?\s+est\s+le\s+gestionnaire\s*,\s*le\s+fiduciaire/i.test(body)
  ||/\bR\.E\.G\.A\.R\.\s+Gestion\s+Priv[ée]e\s+Inc\.?\s+is\s+the\s+Manager\s*,\s*Trustee/i.test(body);
}
function rgpCoverTitle(pages){
 const cover=String(pages?.[0]?.text||'');
 const candidates=[...new Set(cover.split(/\r?\n/).slice(0,28).map(rgpTitleLine).filter(Boolean))];
 if(candidates.length!==1)return null;
 const title=candidates[0];
 const rest=pages.slice(1,5).map(p=>String(p.text||'')).join('\n').toLocaleLowerCase().normalize('NFKC').replace(/[^a-zà-ÿ0-9]/g,'');
 const identity=title.toLocaleLowerCase().normalize('NFKC').replace(/[^a-zà-ÿ0-9]/g,'');
 return identity.length>=18&&rest.includes(identity)?title:null;
}
function identifyFundEarly_rgp(pages){return rgpOwner(pages)?rgpCoverTitle(pages)||'Unknown Fund':'Unknown Fund';}
function rgpPeriod(pages){
 const cover=rgpClean(pages?.[0]?.text||'');
 let date=null;
 const annual=/\bANNUAL\s+MANAGEMENT\s+REPORT\b/i.test(cover);
 const interim=/\bINTERIM\s+MANAGEMENT\s+REPORT\b/i.test(cover);
 const french=/\bRAPPORT\s+ANNUEL\s+DE\s+LA\s+DIRECTION\b/i.test(cover);
 if(annual){const m=/\b(?:to|at)\s+December\s+31,?\s+(20\d{2})/i.exec(cover);if(m)date=m[1]+'-12-31';}
 else if(interim){const m=/\b(?:ended|at)\s+June\s+30,?\s+(20\d{2})/i.exec(cover);if(m)date=m[1]+'-06-30';}
 else if(french){const m=/\bau\s+31\s+d[ée]cembre\s+(20\d{2})/i.exec(cover);if(m)date=m[1]+'-12-31';}
 if(!date||!rgpOwner(pages)||!rgpCoverTitle(pages))return null;
 const year=date.slice(0,4);
 const ratioPages=pages.filter(p=>rgpRatioHeading.test(p.text||''));
 if(!ratioPages.length||!ratioPages.some(p=>new RegExp('\\b'+year+'\\b').test(p.text||'')))return null;
 return date;
}
function selectReportDate_rgp(pages){return rgpPeriod(pages);}
const rgpRatioHeading=/\b(?:RATIOS\s+AND\s+SUPPLEMENTARY\s+DATA|RATIOS\s+ET\s+DONN[ÉE]ES\s+SUPPL[ÉE]MENTAIRES)\b/i;
const rgpRatioHeadLine=/^\s*(?:RATIOS\s+AND\s+SUPPLEMENTARY\s+DATA|RATIOS\s+ET\s+DONN[ÉE]ES\s+SUPPL[ÉE]MENTAIRES)\b/i;
const rgpMerLabel=/^\s*(?:Management\s+expense\s+ratio|Ratio\s+des\s+frais\s+de\s+gestion)(?!\s+(?:before|avant))\b/i;
const rgpPtrLabel=/^\s*(?:Portfolio\s+turnover\s+rate|Taux\s+de\s+rotation\s+du\s+portefeuille)\b/i;
function rgpClassFromLine(line){
 const compact=rgpClean(line).replace(/\s+/g,'');
 const m=/^(?:Class|Cat[ée]gorie)([A-Z]{1,2})\(RGP\d{3}\)/i.exec(compact);
 return m?'Class '+m[1].toUpperCase():null;
}
function rgpPercentCells(line){
 return [...String(line||'').matchAll(/(?:^|\s)(\d{1,3}(?:[.,]\d{1,3})?)\s*%(?=\s|$)/g)]
  .map(x=>Number(x[1].replace(',','.'))).filter(Number.isFinite);
}
function rgpSourceTable(page,year){
 const lines=String(page.text||'').split(/\r?\n/).map(rgpClean);
 const found=[];
 for(let i=0;i<lines.length;i++){
  if(!rgpRatioHeadLine.test(lines[i]))continue;
  const cls=rgpClassFromLine(lines[i+1]||'');if(!cls)continue;
  // Year must be the CURRENT first column, not an inception or prior year.
  const yearHeader=lines.slice(i+1,i+7).join(' ');
  const yrs=[...yearHeader.matchAll(/\b20\d{2}\b/g)].map(m=>Number(m[0]));
  if(!yrs.length||yrs[0]!==year)continue;
  const limit=Math.min(lines.length,i+17);
  let end=limit;
  for(let j=i+2;j<limit;j++)if(rgpRatioHeadLine.test(lines[j])||/^(?:NET\s+ASSETS\s+PER\s+UNIT|ACTIFS\s+NETS\s+PAR\s+PART)/i.test(lines[j])){end=j;break;}
  const body=lines.slice(i+2,end);
  const mer=body.filter(l=>rgpMerLabel.test(l)),ptr=body.filter(l=>rgpPtrLabel.test(l));
  const before=body.filter(l=>/^\s*(?:Management\s+expense\s+ratio\s+before|Ratio\s+des\s+frais\s+de\s+gestion\s+avant)/i.test(l));
  if(mer.length!==1||ptr.length!==1||before.length!==1)continue;
  const mers=rgpPercentCells(mer[0]),ptrs=rgpPercentCells(ptr[0]),b=rgpPercentCells(before[0]);
  if(!mers.length||mers.length!==ptrs.length||mers.length!==b.length||mers.length>7)continue;
  if(mers.some(n=>n<0||n>100)||ptrs.some(n=>n<0||n>10000))continue;
  found.push({cls,values:{MER:mers[0],PTR:ptrs[0],TER:null},quality:3,
   evidence:{MER:{page:page.page,source:'RGP Class current-period Management Expense Ratio',method:'native-js'},
    PTR:{page:page.page,source:'RGP Class current-period Portfolio Turnover Rate',method:'native-js'}}});
 }
 return found;
}
function extract_rgp(pages,p,fund,date){
 if(!date||!fund||fund==='Unknown Fund'||date!==rgpPeriod(pages)||fund!==rgpCoverTitle(pages))return [];
 const byClass=new Map(),conflicts=new Set();
 for(const pg of pages){if(!rgpRatioHeading.test(pg.text||''))continue;
  for(const row of rgpSourceTable(pg,Number(date.slice(0,4)))){
   if(byClass.has(row.cls))conflicts.add(row.cls);else byClass.set(row.cls,row);
  }
 }
 for(const cls of conflicts)byClass.delete(cls);
 return [...byClass.values()];
}
function auditRatioHeadings_rgp(text,potential){
 const lines=String(text||'').split(/\r?\n/);
 for(let i=0;i<lines.length-1;i++)if(rgpRatioHeadLine.test(lines[i])){
  const cls=rgpClassFromLine(lines[i+1]);if(cls)potential.add(cls);
 }
}

// @mrfp:evidence
const evidencePolicy_rgp={stamps:{rgpBilingualRatioVersion:1}};
function rgpEvidenceClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function rgpEvidenceTitle(s){return /^(?:GreenWise\s+[A-Za-zÀ-ÿ0-9 &'’().-]{3,125}\s+Portfolio|Portefeuille\s+GreenWise\s+[A-Za-zÀ-ÿ0-9 &'’().-]{3,125})$/i.test(rgpEvidenceClean(s));}
function rgpEvidenceDate(pages){
 const cover=rgpEvidenceClean(pages?.[0]?.text||'');
 if(/\bANNUAL\s+MANAGEMENT\s+REPORT\b/i.test(cover)){
  const m=/\b(?:to|at)\s+December\s+31,?\s+(20\d{2})/i.exec(cover);return m?m[1]+'-12-31':null;
 }
 if(/\bINTERIM\s+MANAGEMENT\s+REPORT\b/i.test(cover)){
  const m=/\b(?:ended|at)\s+June\s+30,?\s+(20\d{2})/i.exec(cover);return m?m[1]+'-06-30':null;
 }
 if(/\bRAPPORT\s+ANNUEL\s+DE\s+LA\s+DIRECTION\b/i.test(cover)){
  const m=/\bau\s+31\s+d[ée]cembre\s+(20\d{2})/i.exec(cover);return m?m[1]+'-12-31':null;
 }
 return null;
}
function validateDocumentEvidence_rgp(pages,row){
 if(row?.fmc_key!=='rgp'||!pages?.length||rgpEvidenceDate(pages)!==row.report_date)return false;
 const cover=String(pages[0]?.text||'');
 const titleLines=cover.split(/\r?\n/).map(rgpEvidenceClean).filter(rgpEvidenceTitle);
 if(titleLines.length!==1||titleLines[0]!==row.fund_name)return false;
 const content=pages.slice(0,7).map(p=>String(p.text||'')).join('\n');
 const owner=/\bRGP\s+Investments\s+Inc\.?\s*\(formerly\s+R\.E\.G\.A\.R\.[\s\S]{0,80}?\)\s+is\s+the\s+Manager\s*,\s*Trustee/i.test(content)
  ||/\bRGP\s+Investments\s+Inc\.?[\s\S]{0,65}?is\s+the\s+Manager\s*,\s*Trustee\s+and\s+Portfolio\s+Advisor/i.test(content)
  ||/\bR\.E\.G\.A\.R\.\s+Gestion\s+Priv[ée]e\s+inc\.?\s+est\s+le\s+gestionnaire\s*,\s*le\s+fiduciaire/i.test(content)
  ||/\bR\.E\.G\.A\.R\.\s+Gestion\s+Priv[ée]e\s+Inc\.?\s+is\s+the\s+Manager\s*,\s*Trustee/i.test(content);
 return owner&&/^Class\s+[A-Z]{1,2}$/.test(row.class_name||'');
}
function rgpEvidenceSection(s){return /^\s*(?:RATIOS\s+AND\s+SUPPLEMENTARY\s+DATA|RATIOS\s+ET\s+DONN[ÉE]ES\s+SUPPL[ÉE]MENTAIRES)\b/i.test(s);}
function rgpEvidenceMetricLabel(line,key){
 // Read only the printed label COLUMN; never match a percentage in another row.
 const label=rgpEvidenceClean(line.items.filter(i=>i.x<250).map(i=>i.str).join(' '));
 return key==='MER'?/^(?:Management\s+expense\s+ratio|Ratio\s+des\s+frais\s+de\s+gestion)$/i.test(label):
  key==='PTR'?/^(?:Portfolio\s+turnover\s+rate|Taux\s+de\s+rotation\s+du\s+portefeuille)$/i.test(label):false;
}
function locateCell_rgp(page,lines,row,key,value){
 if(!['MER','PTR'].includes(key)||value==null||!Number.isFinite(Number(value)))return null;
 if(!Array.isArray(page?.items)||
   !/(?:RATIOS\s+AND\s+SUPPLEMENTARY\s+DATA|RATIOS\s+ET\s+DONN[ÉE]ES\s+SUPPL[ÉE]MENTAIRES)/i.test(page.text||''))return null;
 const currentYear=Number(String(row.report_date||'').slice(0,4));if(currentYear<2000)return null;
 const printedClass=String(row.class_name||'').replace(/\s+/g,'').toUpperCase();
 const hits=[];
 for(let i=0;i<lines.length-2;i++){
  if(!rgpEvidenceSection(lines[i].text))continue;
  const header=lines[i+1],compact=rgpEvidenceClean(header.text).replace(/\s+/g,'').toUpperCase();
  const classMatch=/^(?:CLASS|CAT[ÉE]GORIE)([A-Z]{1,2})\(RGP\d{3}\)/i.exec(compact);
  if(!classMatch||'CLASS'+classMatch[1]!==printedClass)continue;
  // Determine the actual current-year NUMBER anchor from this ratio section.
  const yrTokens=lines.slice(i+1,i+7).flatMap(l=>l.items.filter(x=>new RegExp('^'+currentYear+'$').test(String(x.str).trim())));
  const selected=yrTokens.filter(x=>x.x>240).sort((a,b)=>a.x-b.x);
  if(!selected.length)continue;
  const yearX=selected[0].x;
  const wrongYears=lines.slice(i+1,i+7).flatMap(l=>l.items.filter(x=>/^20\d{2}$/.test(String(x.str).trim())&&Number(x.str)!==currentYear&&x.x<yearX-5));
  if(wrongYears.length)continue;
  let end=Math.min(lines.length,i+19);
  for(let j=i+2;j<end;j++)if(rgpEvidenceSection(lines[j].text)||/^(?:NET\s+ASSETS\s+PER\s+UNIT|ACTIFS\s+NETS\s+PAR\s+PART)\b/i.test(lines[j].text)){end=j;break;}
  const matching=lines.slice(i+2,end).filter(l=>rgpEvidenceMetricLabel(l,key));
  if(matching.length!==1)continue;
  const target=matching[0];
  for(const token of target.items){
   if(Math.abs(token.x-yearX)>26||token.x<250)continue;
   const m=/^\s*(\d{1,3}(?:[.,]\d{1,3})?)\s*%?\s*$/.exec(token.str||'');if(!m)continue;
   const n=Number(m[1].replace(',','.'));if(Math.abs(n-Number(value))>1e-7)continue;
   const percent=token.str.includes('%')||target.items.some(it=>it.x>=token.x+token.w-0.5&&it.x-token.x-token.w<5&&/^\s*%\s*$/.test(it.str));
   if(!percent)continue;
   if(!(token.w>0&&token.h>0&&Number.isFinite(token.x)&&Number.isFinite(token.y)))continue;
   hits.push({page:page.page,box:{x:Math.max(0,token.x-1),y:token.y-1,w:token.w+2,h:token.h+2},raw:token.str.trim(),kind:'rgp-class-period-ratio-v1'});
  }
 }
 const unique=new Map(hits.map(x=>[x.box.x.toFixed(2)+':'+x.box.y.toFixed(2),x]));
 return unique.size===1?[...unique.values()][0]:null;
}
