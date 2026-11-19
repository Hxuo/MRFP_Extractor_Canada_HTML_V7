/* 3iQ Corp. adapter.
 * Native-text Financial Highlights parser for 3iQ single-class ETFs.
 * The current reporting-period column is resolved from the printed year header
 * and aligned to each labelled ratio cell; no fixed page numbers or fund-name
 * allow-list controls extraction.
 * Build browser bundles with `node dev-tools/build.cjs`.
 */
// @mrfp:profile
const profile_three_iq={
 key:'three_iq',label:'3iQ Corp.',style:'three_iq',
 signatures:[/3iQ\s+Corp\./i,/www\.3iq\.ca/i,/\b3iQ\s+.{2,100}?\bETF\b/i],
 title:/^\s*(3iQ\s+[^\r\n]{2,120}?\bETF)\s*$/im
};
const fmcConfig_three_iq={issuerPrefix:/^3iQ\s/i,titleScanPages:3,allowRowFallback:false};

// @mrfp:extraction
function threeIqNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function threeIqCompact(value){return threeIqNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');}
function threeIqTitleCase(value){
 return String(value||'').toLowerCase().split(/\s+/).filter(Boolean).map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
}
// Identify published cover titles using the 3iQ manager identity, never a
// list of known fund names. This covers both branded ETFs and "The ... Fund"
// reports without treating companies mentioned in portfolio holdings as managers.
function identifyFundEarly_three_iq(pages){
 const opening=(pages||[]).slice(0,3).map(page=>String(page.text||'')).join('\n');
 if(!/\b3iQ\s+Corp\.?\b/i.test(opening))return undefined;
 const cover=String(pages?.[0]?.text||'').split(/\r?\n/).slice(0,10);
 const names=new Set();
 for(const raw of cover){
  const line=threeIqNormalize(raw);
  // A published "The ... Fund" title is valid only on the document cover,
  // under a confirmed 3iQ manager. No coin or individual fund is named here.
  const named=/^3iQ\s+(.{2,110}?)\s+ETF$/i.exec(line);
  const fund=/^((?:The\s+)?[A-Za-z][A-Za-z0-9&'’().,\-/\s]{1,105}\s+Fund)$/i.exec(line);
  if(named)names.add('3iQ '+threeIqTitleCase(named[1])+' ETF');
  else if(fund && !/\b(?:Management Report|Financial|Performance|Reporting|Investment Company)\b/i.test(fund[1])){
   const title=fund[1];
   names.add(/[a-z]/.test(title)?title:threeIqTitleCase(title));
  }
 }
 return names.size===1?[...names][0]:names.size>1?'Unknown Fund':undefined;
}
function threeIqClassLabelsFromText(text){
 const found=new Set(),source=String(text||'');
 // Native PDF text normally separates the descriptor and code ("Class A").
 const spaced=/\bClass\s+([A-Z][A-Z0-9-]*)\b/gi;let match;
 while((match=spaced.exec(source)))found.add('Class '+match[1].toUpperCase());
 // OCR can collapse the visual gap and return "ClassA" or "Class-A".
 // Keep this compact form deliberately narrow so words such as
 // "Classification" cannot be mistaken for a class identifier.
 const compact=/\bClass-?([A-Z]\d{0,2}(?:-\d{1,2})?)\b/gi;
 while((match=compact.exec(source)))found.add('Class '+match[1].toUpperCase());
 return [...found];
}
function threeIqClasses(pages){
 const found=new Set();
 for(const page of pages||[]){
  for(const label of threeIqClassLabelsFromText(page.text||''))found.add(label);
 }
 return [...found];
}
// Class identity is taken from the Financial Highlights table, not every
// narrative mention. For example, a historical Class F mentioned in a fee
// disclosure is not another currently reported ratio table.
function threeIqRatioTableClass(page){
 const text=String(page?.text||'');
 if(!/Financial\s+Highlights/i.test(text)||!/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return null;
 const found=new Set();
 const patterns=[
  /\b(?:about|for)\s+the\s+Class\s+([A-Z][A-Z0-9-]*)\s+units?\s+of\s+the\s+Fund\b/gi,
  /\bNet\s+Asset\s+Value\s*\(NAV\)\s+per\s+Class\s+([A-Z][A-Z0-9-]*)\s+Units?\b/gi
 ];
 for(const pattern of patterns){let match;
  while((match=pattern.exec(text)))found.add('Class '+match[1].toUpperCase());
 }
 return found.size===1?[...found][0]:null;
}
function selectReportDate_three_iq(pages){return reportDate(pages);}
function threeIqBuildLines(items){
 const lines=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const h=Math.max(5,Number(item.h)||8);
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.5,Math.min(2.4,h*.25)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push({...item,h});
 }
 for(const line of lines){
  line.items.sort((a,b)=>a.x-b.x);
  line.text=threeIqNormalize(line.items.map(item=>item.str).join(' '));
 }
 return lines.sort((a,b)=>b.y-a.y);
}
function threeIqYearToken(item){
 const match=/^(20\d{2})\*?$/.exec(threeIqNormalize(item?.str));
 return match?Number(match[1]):null;
}
function threeIqFindCurrentColumn(lines,section,reportDate){
 const match=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(reportDate||''));
 if(!match||!section)return null;
 const targetYear=Number(match[1]);
 const candidates=[];
 for(const line of lines){
  if(line.y<=section.y+12||line.y-section.y>260)continue;
  for(const item of line.items){
   if(threeIqYearToken(item)!==targetYear)continue;
   const center=item.x+(Number(item.w)||0)/2;
   if(!Number.isFinite(center)||center<=0)continue;
   candidates.push({year:targetYear,center,item,line});
  }
 }
 // Duplicate year glyphs or multiple possible table headers are ambiguous.
 const unique=new Map(candidates.map(candidate=>[
  `${candidate.item.x.toFixed(2)}:${candidate.item.y.toFixed(2)}`,
  candidate
 ]));
 return unique.size===1?[...unique.values()][0]:null;
}
function threeIqMetricLabel(line,key){
 const left=line.items.filter(item=>item.x<205).map(item=>item.str).join(' ');
 const text=threeIqNormalize(left).replace(/\s+/g,' ').trim();
 const patterns={
  MER:/^Management\s+expense\s+ratio(?:\s*\(\d+\))?$/i,
  TER:/^Total\s+expense\s+ratio(?:s)?(?:\s*\(\d+\))?$/i,
  PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\(\d+\))?$/i
 };
 if(!patterns[key]?.test(text))return null;
 const words=key==='MER'?/management|expense|ratio/i:key==='PTR'?/portfolio|turnover|rate|ratio/i:/total|expense|ratio/i;
 const labelItems=line.items.filter(item=>item.x<205&&words.test(item.str));
 if(!labelItems.length)return null;
 return {text,x:Math.min(...labelItems.map(item=>item.x)),right:Math.max(...labelItems.map(item=>item.x+(Number(item.w)||0))),items:labelItems};
}
function threeIqParseCell(item){
 const raw=threeIqNormalize(item?.str).replace(/\s+/g,'');
 if(!raw||!Number.isFinite(item.x)||!Number.isFinite(item.y)||!(Number(item.w)>0))return null;
 if(/^(?:[-–—−]{1,2}|n\/?a)$/i.test(raw))return {value:null,isMissing:true,raw,item};
 const match=/^\(?(-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?)\)?%$/.exec(raw);
 if(!match)return null;
 const value=Number(match[1].replace(/,/g,''));
 if(!Number.isFinite(value)||value<0||value>1000)return null;
 return {value,isMissing:false,raw,item};
}
function threeIqMetricCell(line,label,column,expectedValue){
 if(!line||!label||!column)return null;
 const candidates=line.items.filter(item=>item.x>label.right+8).map(threeIqParseCell).filter(Boolean)
  .filter(cell=>{
   const center=cell.item.x+(Number(cell.item.w)||0)/2;
   return Math.abs(center-column.center)<20 &&
    (expectedValue===undefined||(expectedValue===null?cell.isMissing:!cell.isMissing&&Math.abs(cell.value-Number(expectedValue))<0.000001));
  });
 if(candidates.length!==1)return null;
 const cell=candidates[0],item=cell.item;
 return {...cell,box:{x:Math.max(0,item.x-1),y:item.y-1,w:item.w+2,h:Math.max(6,item.h||8)+2}};
}
function threeIqFinancialRows(page,reportDate){
 if(!page||page.ocrUsed||!Array.isArray(page.items)||!page.items.length)return null;
 const lines=threeIqBuildLines(page.items);
 const sections=lines.filter(line=>/^Ratios\s+and\s+Supplemental\s+Data\s*:?$/i.test(line.text));
 if(sections.length!==1)return null;
 const section=sections[0];
 const column=threeIqFindCurrentColumn(lines,section,reportDate);
 if(!column)return null;
 const merCandidates=lines.filter(line=>line.y<section.y&&section.y-line.y<145)
  .map(line=>({line,label:threeIqMetricLabel(line,'MER')})).filter(entry=>entry.label);
 const ptrCandidates=lines.filter(line=>line.y<section.y&&section.y-line.y<145)
  .map(line=>({line,label:threeIqMetricLabel(line,'PTR')})).filter(entry=>entry.label);
 if(merCandidates.length!==1||ptrCandidates.length!==1)return null;
 const mer=threeIqMetricCell(merCandidates[0].line,merCandidates[0].label,column);
 const ptr=threeIqMetricCell(ptrCandidates[0].line,ptrCandidates[0].label,column);
 if(!mer||!ptr)return null;
 return {
  values:{MER:mer.value,TER:null,PTR:ptr.value},
  cells:{MER:mer,PTR:ptr},
  column
 };
}
function extract_three_iq(pages,profile,fund,date){
 if(!fund||fund==='Unknown Fund'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||''))return [];
 const documentClasses=threeIqClasses(pages);
 const fallbackClass=documentClasses.length===1?documentClasses[0]:null;
 const fundKey=threeIqCompact(fund),byClass=new Map(),conflicts=new Set();
 for(const page of pages||[]){
  if(!/Financial\s+Highlights/i.test(page.text||'')||!threeIqCompact(page.text||'').includes(fundKey))continue;
  const parsed=threeIqFinancialRows(page,date);if(!parsed)continue;
  // A class printed for the ratio table takes priority over unrelated
  // Class/Series names in narratives or management-fee disclosures.
  const className=threeIqRatioTableClass(page)||fallbackClass;
  if(!className)continue;
  const row={cls:className,quality:2,values:parsed.values,evidence:{
   MER:{page:page.page,source:'Current-period Management Expense Ratio row',method:'native-js'},
   PTR:{page:page.page,source:'Current-period Portfolio Turnover Rate row',method:'native-js'}
  }};
  const previous=byClass.get(className);
  if(!previous)byClass.set(className,row);
  else if(JSON.stringify(previous.values)!==JSON.stringify(row.values))conflicts.add(className);
 }
 for(const cls of conflicts)byClass.delete(cls);
 return [...byClass.values()];
}

// @mrfp:evidence
const evidencePolicy_three_iq={stamps:{threeIqFinancialHighlightsLocatorVersion:1}};
function threeIqEvNormalize(value){
 return String(value??'').normalize('NFKC').replace(/[\u00ad\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
}
function threeIqEvCompact(value){return threeIqEvNormalize(value).toLowerCase().replace(/[^a-z0-9]/g,'');}
function threeIqEvBuildLines(items){
 const lines=[];
 for(const item of items||[]){
  if(typeof item.str!=='string'||!item.str.trim()||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;
  const h=Math.max(5,Number(item.h)||8);
  let line=lines.find(row=>Math.abs(row.y-item.y)<Math.max(1.5,Math.min(2.4,h*.25)));
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push({...item,h});
 }
 for(const line of lines){line.items.sort((a,b)=>a.x-b.x);line.text=threeIqEvNormalize(line.items.map(item=>item.str).join(' '));}
 return lines.sort((a,b)=>b.y-a.y);
}
function threeIqEvYearToken(item){const match=/^(20\d{2})\*?$/.exec(threeIqEvNormalize(item?.str));return match?Number(match[1]):null;}
function threeIqEvFindCurrentColumn(lines,section,reportDate){
 const match=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(reportDate||''));if(!match||!section)return null;
 const targetYear=Number(match[1]),candidates=[];
 for(const line of lines){
  if(line.y<=section.y+12||line.y-section.y>260)continue;
  for(const item of line.items){
   if(threeIqEvYearToken(item)!==targetYear)continue;
   const center=item.x+(Number(item.w)||0)/2;if(Number.isFinite(center)&&center>0)candidates.push({center,item});
  }
 }
 const unique=new Map(candidates.map(candidate=>[`${candidate.item.x.toFixed(2)}:${candidate.item.y.toFixed(2)}`,candidate]));
 return unique.size===1?[...unique.values()][0]:null;
}
function threeIqEvMetricLabel(line,key){
 const left=line.items.filter(item=>item.x<205).map(item=>item.str).join(' '),text=threeIqEvNormalize(left);
 const patterns={MER:/^Management\s+expense\s+ratio(?:\s*\(\d+\))?$/i,PTR:/^Portfolio\s+turnover\s+(?:rate|ratio)(?:\s*\(\d+\))?$/i};
 if(!patterns[key]?.test(text))return null;
 const words=key==='MER'?/management|expense|ratio/i:/portfolio|turnover|rate|ratio/i;
 const items=line.items.filter(item=>item.x<205&&words.test(item.str));
 return items.length?{right:Math.max(...items.map(item=>item.x+(Number(item.w)||0)))}:null;
}
function threeIqEvParseCell(item){
 const raw=threeIqEvNormalize(item?.str).replace(/\s+/g,'');
 if(!raw||!Number.isFinite(item.x)||!Number.isFinite(item.y)||!(Number(item.w)>0))return null;
 if(/^(?:[-–—−]{1,2}|n\/?a)$/i.test(raw))return {value:null,isMissing:true,raw,item};
 const match=/^\(?(-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?)\)?%$/.exec(raw);if(!match)return null;
 const value=Number(match[1].replace(/,/g,''));
 return Number.isFinite(value)&&value>=0&&value<=1000?{value,isMissing:false,raw,item}:null;
}
function threeIqEvMetricCell(line,label,column){
 if(!line||!label||!column)return null;
 const candidates=line.items.filter(item=>item.x>label.right+8).map(threeIqEvParseCell).filter(Boolean)
  .filter(cell=>Math.abs((cell.item.x+(Number(cell.item.w)||0)/2)-column.center)<20);
 if(candidates.length!==1)return null;
 const cell=candidates[0],item=cell.item;
 return {...cell,box:{x:Math.max(0,item.x-1),y:item.y-1,w:item.w+2,h:Math.max(6,item.h||8)+2}};
}
function threeIqEvFinancialRows(page,reportDate){
 if(!page||page.ocrUsed||!Array.isArray(page.items)||!page.items.length)return null;
 const lines=threeIqEvBuildLines(page.items),sections=lines.filter(line=>/^Ratios\s+and\s+Supplemental\s+Data\s*:?$/i.test(line.text));
 if(sections.length!==1)return null;
 const section=sections[0],column=threeIqEvFindCurrentColumn(lines,section,reportDate);if(!column)return null;
 const mer=lines.filter(line=>line.y<section.y&&section.y-line.y<145).map(line=>({line,label:threeIqEvMetricLabel(line,'MER')})).filter(x=>x.label);
 const ptr=lines.filter(line=>line.y<section.y&&section.y-line.y<145).map(line=>({line,label:threeIqEvMetricLabel(line,'PTR')})).filter(x=>x.label);
 if(mer.length!==1||ptr.length!==1)return null;
 const merCell=threeIqEvMetricCell(mer[0].line,mer[0].label,column),ptrCell=threeIqEvMetricCell(ptr[0].line,ptr[0].label,column);
 return merCell&&ptrCell?{MER:merCell,PTR:ptrCell}:null;
}
function threeIqEvidenceFundMatches(page,row){
 const compact=threeIqEvCompact(page?.text||''),fund=threeIqEvCompact(row?.fund_name||'');
 return fund.length>8&&compact.includes(fund)&&/ratiosandsupplementaldata/i.test(compact)&&/financialhighlights/i.test(compact);
}
function threeIqEvidenceCell(page,row,key,value){
 if(!['MER','PTR'].includes(key)||!threeIqEvidenceFundMatches(page,row))return null;
 const cells=threeIqEvFinancialRows(page,row.report_date);if(!cells)return null;
 const cell=cells[key];if(!cell)return null;
 if(value===null||value===undefined){if(!cell.isMissing)return null;}
 else if(cell.isMissing||Math.abs(cell.value-Number(value))>=0.000001)return null;
 return {box:cell.box,page:page.page,metric:key,kind:'three-iq-current-period-ratio-cell',raw:cell.raw,isMissing:!!cell.isMissing};
}
// Evidence bundle is independently built: repeat only the table-class
// identity check needed to validate source boxes without relying on the
// extraction bundle or on incidental historical class mentions.
function threeIqEvRatioTableClass(page){
 const text=String(page?.text||'');
 if(!/Financial\s+Highlights/i.test(text)||!/Ratios\s+and\s+Supplemental\s+Data/i.test(text))return null;
 const found=new Set();
 const patterns=[
  /\b(?:about|for)\s+the\s+Class\s+([A-Z][A-Z0-9-]*)\s+units?\s+of\s+the\s+Fund\b/gi,
  /\bNet\s+Asset\s+Value\s*\(NAV\)\s+per\s+Class\s+([A-Z][A-Z0-9-]*)\s+Units?\b/gi
 ];
 for(const pattern of patterns){let match;
  while((match=pattern.exec(text)))found.add('Class '+match[1].toUpperCase());
 }
 return found.size===1?[...found][0]:null;
}
function threeIqEvClassLabelsFromText(text){
 const found=new Set(),source=String(text||'');
 const spaced=/\bClass\s+([A-Z][A-Z0-9-]*)\b/gi;let match;
 while((match=spaced.exec(source)))found.add('Class '+match[1].toUpperCase());
 // Match compact OCR tokens such as "ClassA" without accepting words like
 // "Classification" as class identities.
 const compact=/\bClass-?([A-Z]\d{0,2}(?:-\d{1,2})?)\b/gi;
 while((match=compact.exec(source)))found.add('Class '+match[1].toUpperCase());
 return [...found];
}
function validateDocumentEvidence_three_iq(pages,row){
 const head=(pages||[]).slice(0,3).map(page=>page.text||'').join('\n');
 const compactHead=threeIqEvCompact(head),fund=threeIqEvCompact(row?.fund_name||'');
 if(!/3iqcorp/.test(compactHead)||!/www3iqca/.test(compactHead)||fund.length<8||!compactHead.includes(fund))return false;
 const expected=String(row?.class_identity||row?.class_name||'').toLowerCase();
 // Verify against the ratio table's own class, not incidental Class F
 // mentions elsewhere in 3iQ's narrative sections.
 const ratioClasses=new Set();
 for(const page of pages||[]){
  if(!threeIqEvCompact(page.text||'').includes(fund))continue;
  const cls=threeIqEvRatioTableClass(page);
  if(cls)ratioClasses.add(cls.toLowerCase());
 }
 if(ratioClasses.size)return ratioClasses.has(expected);
 const classNames=new Set();
 for(const page of pages||[])for(const label of threeIqEvClassLabelsFromText(page.text||''))classNames.add(label);
 return classNames.size===1&&[...classNames][0].toLowerCase()===expected;
}
function locateCell_three_iq(page,lines,row,key,value,context){return threeIqEvidenceCell(page,row,key,value);}
