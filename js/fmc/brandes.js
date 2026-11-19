/* FMC adapter: brandes. One owner for detection, extraction and dedicated evidence rules.
 * This is developer source; use `node dev-tools/build.cjs` for browser-safe bundles. */
// @mrfp:profile
const profile_brandes={key:'brandes',label:'Bridgehouse / Brandes',style:'brandes_new',signatures:[/(?:Brandes (?:International|Global Small Cap|Emerging Markets).*Fund|\b(?:managed\s+and\s+advised\s+by|managed\s+and[\s\S]{0,180}?\badvised\s+by|and\s+advised\s+by)\s+Brandes\s+Investments\b)/i,/Bridgehouse Asset Managers/i],title:/^\s*(Brandes\s+[^\n]+?Fund)\s*$/im};

const fmcConfig_brandes={issuerPrefix:/^Brandes\s/i,preferProfileLineTitle:true};

// GQG is a portfolio sub-advisor brand, not the registrant: require an
// explicit Bridgehouse/Brandes manager-role statement before enabling its title.
function brandesIsGqgDocument(pages){
 const early=pages.slice(0,4).map(p=>p.text||'').join('\n');
 return /^\s*GQG\s+Partners\s+[^\n]{8,115}\bFund\s*$/im.test(early)
  &&/\bmanaged\s+and\s+advised\s+by\s+Brandes\s+Investments/i.test(early)
  &&/Bridgehouse\s+Asset\s+Managers/i.test(early);
}
// A Bridgehouse report may be branded for any appointed portfolio sub-advisor.
// Establish manager OWNERSHIP using the explicit management statement, not
// the cover's portfolio brand list (which mentions several unrelated advisers).
// PDF.js sometimes interleaves another column between "managed and" and
// "advised by Brandes"; allow that small gap but demand the legal manager and
// its Bridgehouse operating name in the first report discussion pages.
function brandesIsBridgehouseDocument(pages){
 const head=pages.slice(0,4).map(p=>String(p.text||'')).join('\n');
 return /\b(?:managed\s+and\s+advised\s+by|managed\s+and[\s\S]{0,180}?\badvised\s+by|and\s+advised\s+by)\s+Brandes\s+Investments\b/i.test(head)
  &&/\b(?:operating\s+as\s+)?Bridgehouse\s+Asset\s+Managers\b/i.test(head)
  &&/\b20\d{2}\s+(?:Annual|Interim)\s+Management\s+Report/i.test(String(pages[0]?.text||''));
}
// Accept a complete, standalone cover title only when it is repeated in that
// fund's own management discussion. Never enumerate adviser brands/fund names.
function brandesBridgehouseCoverFund(pages){
 if(!brandesIsBridgehouseDocument(pages))return null;
 const cover=String(pages[0]?.text||'');
 const names=cover.split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' '))
  .filter(s=>s.length>=16&&s.length<=155&&/^[A-Z][A-Za-z0-9 .,&'’()\/-]*\bFund$/i.test(s)
   &&!/\b(?:management\s+report|fund\s+performance)\b/i.test(s));
 if(names.length!==1||/^Brandes\s/i.test(names[0]))return null; // legacy Brandes-branded reports keep their original adapter path
 const name=names[0],key=name.toLowerCase().replace(/[^a-z0-9]+/g,'');
 const discussion=pages.slice(1,4).map(p=>String(p.text||'')).join('\n').toLowerCase().replace(/[^a-z0-9]+/g,'');
 return discussion.includes(key)?name:null;
}
// The cover determines Annual vs Interim, but its year must agree with the
// Financial Highlights reporting-period heading. This excludes inception dates.
function brandesBridgehousePeriod(pages){
 if(!brandesIsBridgehouseDocument(pages))return null;
 const cover=String(pages[0]?.text||'');
 const m=/\b(20\d{2})\s+(Annual|Interim)\s+Management\s+Report/i.exec(cover);
 if(!m)return null;
 const year=Number(m[1]),annual=/annual/i.test(m[2]);
 const heading=pages.slice(0,8).map(p=>String(p.text||'')).join('\n');
 const rx=annual?/FINANCIAL\s+HIGHLIGHTS[\s\S]{0,110}FOR\s+PERIODS\s+ENDED\s+DECEMBER\s+31/i:
  /FINANCIAL\s+HIGHLIGHTS[\s\S]{0,110}FOR\s+THE\s+SIX\s+MONTHS\s+ENDED\s+JUNE\s+30/i;
 if(!rx.test(heading))return null;
 const ratio=pages.find(p=>/Ratios\s+and\s+Supplemental\s+Data/i.test(p.text||''));
 if(!ratio||!brandesGqgRatioBlocks(ratio,year).length)return null;
 return `${year}-${annual?'12-31':'06-30'}`;
}
function identifyFundEarly_brandes(pages){
 if(!brandesIsGqgDocument(pages))return brandesBridgehouseCoverFund(pages)||undefined;
 for(const page of pages.slice(0,4))for(const raw of String(page.text||'').split(/\r?\n/)){
  const line=raw.trim().replace(/\s+/g,' ');
  if(/^GQG Partners [A-Za-z0-9 .&'’()-]{8,115} Fund$/i.test(line)){
   if(/^[A-Z\s.&'-]+$/.test(line))continue; // prefer mixed-case cover title
   return line.replace(/\bU\.s\./i,'U.S.');
  }
 }
 return undefined;
}
function brandesGqgPeriod(pages){
 if(!brandesIsGqgDocument(pages))return null;
 const cover=String(pages[0]?.text||'');
 const m=/\b(20\d{2})\s+(Annual|Interim)\s+Management\s+Report/i.exec(cover);
 if(!m)return null;
 const year=Number(m[1]);
 const heading=pages.slice(0,5).map(p=>p.text||'').join('\n');
 const start=heading.search(/Results\s+of\s+Operations\s+from/i);
 if(start<0)return null;
 const chunk=heading.slice(start,start+450);
 const candidates=[...chunk.matchAll(/\b(June|December)\s+(30|31),?\s+(20\d{2})\b/gi)]
  .filter(x=>Number(x[3])===year && (x[1].toLowerCase()==='june'&&x[2]==='30'||x[1].toLowerCase()==='december'&&x[2]==='31'));
 const month=m[2].toLowerCase()==='annual'?'December':'June';
 const filtered=candidates.filter(x=>x[1].toLowerCase()===month.toLowerCase());
 return filtered.length===1?`${year}-${month==='June'?'06-30':'12-31'}`:null;
}


// @mrfp:extraction
function parseBrandes(pages){
 const out=new Map();const year=brandesDate(pages)?.slice(0,4);for(const p of pages){
  if(!/Ratios and Supplemental Data/i.test(p.text))continue;
  const lines=normalizeExtraText(p.text).split('\n');
  for(let i=0;i<lines.length;i++){
   const m=/^\s*(Series\s+[A-Z][A-Z0-9]*)\s*$/i.exec(lines[i]);if(!m)continue;
   // For this tabular layout, a series name is centered vertically among
   // the six-year data rows; its 2026 line appears immediately above it.
   let latest=null;
   for(let j=i-1;j>=Math.max(0,i-12);j--){if(year&&lines[j].startsWith(year+' ')){latest=lines[j];break;}if(/^Series\s/i.test(lines[j]))break;}
   if(!latest)continue;
   let parts=(latest.match(/\b\d[\d,]*(?:\.\d+)?\b|[—–−-]/g)||[]);
   // Year, net assets, units, MER, MER before, PTR, TER, NAV.
   if(parts.length<7)continue;
   const v={MER:toNumber(parts[3]),PTR:toNumber(parts[5]),TER:toNumber(parts[6])};
   out.set(m[1],{cls:m[1],values:v,quality:3,evidence:{}});
  }
 }
 return [...out.values()];
}
function brandesDate(pages){
 const head=normalizeExtraText(pages.slice(0,5).map(x=>x.text).join('\n'));
 const m=/Results\s+of\s+Operations\s+from[\s\S]{0,160}?\bto[\s\S]{0,170}?\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})/i.exec(head);
 if(m){const mm=months[m[1].slice(0,3).toLowerCase()];return `${m[3]}-${String(mm).padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
 return reportDate(pages);
}
// v2-1: New issuer formats. Ratios are read from the latest period's first
// published table column; no amounts are hardcoded for any named fund.

// GQG/Bridgehouse reports put years in ROWS, classes in a merged left label
// and MER/PTR in fixed, independently labelled columns.  The old Brandes
// series-centered/year-before-caption parser remains the legacy branch.
function brandesGqgRatioBlocks(page,reportYear){
 const lines=String(page.text||'').split(/\r?\n/);
 const ix=lines.findIndex(t=>/^\s*Ratios\s+and\s+Supplemental\s+Data\s*$/i.test(t));
 if(ix<0 || !/ratio\s*\(MER\)/i.test(lines.slice(ix,ix+7).join(' ')) ||
   !/MER before waivers/i.test(lines.slice(ix,ix+7).join(' ')) ||
   !/turnover rate/i.test(lines.slice(ix,ix+7).join(' ')))return [];
 const groups=[];let group=null;
 for(const line of lines.slice(ix+1)){
  if(/^\s*4\.\s+The financial/i.test(line))break;
  // Seven published data columns after period year: NAV, units, MER,
  // before-waivers MER, PTR, Trading TER, NAV/unit. Never infer a dash as 0.
  const m=/(?:^|\s)(20\d{2})\s+([\d,]+|[-–—])\s+([\d,]+|[-–—])\s+([\d,.]+|[-–—])\s+([\d,.]+|[-–—])\s+([\d,.]+|[-–—])\s+([\d,.]+|[-–—])\s+([\d,.]+|[-–—])\s*$/.exec(line);
  const yr=m?Number(m[1]):null;
  if(yr===reportYear){group={lines:[],data:[]};groups.push(group);}
  if(group){group.lines.push(line);if(m)group.data.push({year:yr,parts:m.slice(2)});}
 }
 const results=[];
 for(const g of groups){
  if(!g.data.length || g.data[0].year!==reportYear ||
    !g.data.every((d,i)=>d.year===reportYear-i))continue;
  const names=[...new Set(g.lines.flatMap(t=>[...t.matchAll(/\bSeries\s+([A-Z][A-Z0-9]*)\b/gi)].map(x=>'Series '+x[1].toUpperCase())))];
  if(names.length!==1)continue;
  const vals=g.data[0].parts;
  if(!/^\d+(?:\.\d+)?$/.test(vals[2]) || !/^\d+(?:\.\d+)?$/.test(vals[3]))continue;
  const ptr=/^[-–—]$/.test(vals[4])?null:toNumber(vals[4]);
  if(ptr===null&&!/^[-–—]$/.test(vals[4]))continue;
  results.push({cls:names[0],values:{MER:toNumber(vals[2]),PTR:ptr,TER:null},quality:3,
   evidence:{MER:{page:page.page,source:'Bridgehouse GQG current-period MER column',method:'native-js'},
    ...(ptr!==null?{PTR:{page:page.page,source:'Bridgehouse GQG current-period PTR column',method:'native-js'}}:{})}});
 }
 return results;
}
function extract_brandes(pages,p,fund,date){
 const isGqg=brandesIsGqgDocument(pages);
 const isFamily=!isGqg&&Boolean(brandesBridgehouseCoverFund(pages));
 if(!isGqg&&!isFamily)return parseBrandes(pages);
 if(!fund || fund==='Unknown Fund'||!date)return [];
 const yr=Number(date.slice(0,4)),out=pages.flatMap(pg=>brandesGqgRatioBlocks(pg,yr));
 const rows=[...new Map(out.map(r=>[r.cls,r])).values()];
 // The older GQG branch keeps its exact source tags and established behavior.
 if(isGqg)return rows;
 return rows.map(r=>({...r,evidence:Object.fromEntries(Object.entries(r.evidence).map(([metric,ev])=>
  [metric,{...ev,source:'Bridgehouse current-period verified ratio matrix'}]))}));
}
function selectReportDate_brandes(pages){
 return brandesIsGqgDocument(pages)?brandesGqgPeriod(pages):
  brandesBridgehouseCoverFund(pages)?brandesBridgehousePeriod(pages):brandesDate(pages);
}

// @mrfp:evidence
// Legacy saved-record stamps are retained exactly for History compatibility.
const evidencePolicy_brandes={stamps:{brandesNeiLocatorVersion:1}};
function brandesCell(page,lines,row,key,value){
 // Brandes ratio pages identify the fund in a letter-spaced footer, not a title.
 // Verify the entire page's printed fund identifier, never assume a filename.
 if(!compactName(page.text).includes(compactName(row.fund_name)))return null;
 const targetYear=Number((row.report_date||'').slice(0,4));
 if(!targetYear||!/^Series\s+[A-Za-z0-9-]+$/i.test(row.class_name||''))return null;
 const section=lines.find(l=>/^Ratios\s+(?:and|&)\s+Supplemental\s+Data$/i.test(l.text.trim()));
 if(!section)return null;
 const headerItems=lines.filter(l=>l.y<section.y&&section.y-l.y<65).flatMap(l=>l.items);
 const findUnique=rx=>headerItems.filter(i=>rx.test(i.str.trim()));
 const mer=findUnique(/^ratio\s*\(MER\)$/i),before=findUnique(/^MER before waivers$/i);
 const turn=findUnique(/^turnover rate$/i),trading=findUnique(/^expense ratio$/i);
 if([mer,before,turn,trading].some(a=>a.length!==1))return null;
 const anchors={MER:tokenCenter(mer[0]),PTR:tokenCenter(turn[0]),TER:tokenCenter(trading[0])};
 if(!(anchors.MER<tokenCenter(before[0])&&tokenCenter(before[0])<anchors.PTR&&anchors.PTR<anchors.TER))return null;
 const current=lines.filter(l=>l.y<section.y-20&&l.items.some(i=>i.x<180&&i.x>65&&i.str.trim()===String(targetYear)))
  .sort((a,b)=>b.y-a.y);
 const found=[];
 for(let j=0;j<current.length;j++){
  const top=current[j],bottom=current[j+1]?.y??top.y-100;
  // A full series contains its own physical Series caption, usually beside
  // the third historical year. Never infer a class from a prior page.
  const captions=lines.filter(l=>l.y<top.y&&l.y>bottom&&l.items.some(i=>i.x<125&&/^Series\s+[A-Za-z0-9-]+$/i.test(i.str.trim())));
  if(captions.length!==1||clean(captions[0].text)!==clean(row.class_name))continue;
  const years=lines.filter(l=>l.y<=top.y&&l.y>bottom&&l.items.some(i=>i.x<180&&i.x>65&&/^20\d{2}$/.test(i.str.trim())))
   .sort((a,b)=>b.y-a.y);
  if(years.length<1||!years[0].items.some(i=>i.x<180&&i.str.trim()===String(targetYear)))continue;
  // Historical rows must be chronologically descending when present.
  if(!years.every((l,i)=>l.items.some(it=>it.x<180&&it.str.trim()===String(targetYear-i))))continue;
  // Require the target-year printed cell to be inside the metric's header
  // column band, excluding adjacent MER-before-waivers even if identical.
  const targetX=anchors[key];
  const marks=cells(top);
  const selected=marks.filter(c=>matchesCell(c,value)&&c.x>290&&Math.abs(c.x+c.box.w/2-targetX)<28);
  // A tighter band excludes the neighboring MER-before-waivers value.
  const restrict=key==='MER'?selected.filter(c=>c.x<tokenCenter(before[0])-12):
   key==='PTR'?selected.filter(c=>c.x>tokenCenter(before[0])+15&&c.x<anchors.TER-20):
   selected.filter(c=>c.x>anchors.PTR+25);
  if(restrict.length===1)found.push(restrict[0]);
 }
 const unique=new Map(found.map(c=>[c.box.x.toFixed(2)+':'+c.box.y.toFixed(2),c]));
 return unique.size===1?[...unique.values()][0]:null;
}

// NEI: date/class live in one physical row, while the actual MER and the
// before-waivers MER have separate adjacent header columns. Derive anchors
// from printed column titles; missing N/A is a real source glyph, not zero.


// Evidence is separately checked against the source's manager, cover period,
// printed fund identifier, class block, year row and metric-column headers.
function brandesGqgEvidencePeriod(pages){
 const cover=String(pages[0]?.text||'');
 const m=/\b(20\d{2})\s+(Annual|Interim)\s+Management\s+Report/i.exec(cover);
 if(!m)return null;
 const body=pages.slice(0,5).map(p=>p.text||'').join('\n');
 if(!/managed\s+and\s+advised\s+by\s+Brandes\s+Investments/i.test(body)
  ||!/Bridgehouse\s+Asset\s+Managers/i.test(body))return null;
 const month=m[2].toLowerCase()==='annual'?'December 31':'June 30';
 const from=body.search(/Results\s+of\s+Operations\s+from/i);
 if(from<0 || !new RegExp(month+'[,]?\\s+'+m[1],'i').test(body.slice(from,from+450)))return null;
 return m[1]+(month.startsWith('June')?'-06-30':'-12-31');
}
// Re-check ownership, report period and title from PDF text in the evidence
// bundle independently (extraction-only helpers are not bundled here).
function brandesBridgehouseEvidencePeriod(pages){
 const head=pages.slice(0,4).map(p=>String(p.text||'')).join('\n');
 const cover=String(pages[0]?.text||'');
 const m=/\b(20\d{2})\s+(Annual|Interim)\s+Management\s+Report/i.exec(cover);
 if(!m||!/(?:managed\s+and\s+advised\s+by|managed\s+and[\s\S]{0,180}?advised\s+by|and\s+advised\s+by)\s+Brandes\s+Investments\b/i.test(head)
   ||!/\bBridgehouse\s+Asset\s+Managers\b/i.test(head))return null;
 const annual=/annual/i.test(m[2]),yr=m[1];
 const heading=pages.slice(0,8).map(p=>String(p.text||'')).join('\n');
 const rx=annual?/FINANCIAL\s+HIGHLIGHTS[\s\S]{0,110}FOR\s+PERIODS\s+ENDED\s+DECEMBER\s+31/i:
  /FINANCIAL\s+HIGHLIGHTS[\s\S]{0,110}FOR\s+THE\s+SIX\s+MONTHS\s+ENDED\s+JUNE\s+30/i;
 if(!rx.test(heading))return null;
 const ratio=pages.some(p=>/Ratios\s+and\s+Supplemental\s+Data/i.test(p.text||'')&&
  new RegExp('(?:^|\\n)\\s*'+yr+'\\s+[\\d,]+','m').test(p.text||''));
 return ratio?yr+(annual?'-12-31':'-06-30'):null;
}
function brandesBridgehouseEvidenceFund(pages){
 const cover=String(pages[0]?.text||'');
 const names=cover.split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' '))
  .filter(s=>s.length>=16&&s.length<=155&&/^[A-Z][A-Za-z0-9 .,&'’()\/-]*\bFund$/i.test(s)
   &&!/\b(?:management\s+report|fund\s+performance)\b/i.test(s));
 if(names.length!==1)return null;
 const detail=pages.slice(1,4).map(p=>String(p.text||'')).join('\n');
 return compactName(detail).includes(compactName(names[0]))?names[0]:null;
}
function validateDocumentEvidence_brandes(pages,row){
 const gqg=/^GQG Partners\s/i.test(row.fund_name||'');
 const matrix=String(row.evidence?.MER?.source||'')==='Bridgehouse current-period verified ratio matrix';
 if(!gqg&&!matrix)return true; // unchanged historical Brandes records
 const period=gqg?brandesGqgEvidencePeriod(pages):brandesBridgehouseEvidencePeriod(pages);
 if(period!==row.report_date)return false;
 const name=compactName(row.fund_name);
 if(!name || !pages.slice(0,4).some(p=>compactName(p.text.slice(0,1300)).includes(name)))return false;
 return gqg||brandesBridgehouseEvidenceFund(pages)===row.fund_name;
}
function brandesGqgCell(page,lines,row,key,value,extended=false){
 if(key==='TER'||value===null||value===undefined)return null;
 if(!/^(?:Series)\s+[A-Z][A-Z0-9]*$/i.test(row.class_name||''))return null;
 const name=compactName(row.fund_name);
 if(!name||!compactName(page.text).includes(name))return null;
 const yr=Number((row.report_date||'').slice(0,4));
 if(!(yr>=2000&&yr<2100))return null;
 const heading=lines.find(l=>/^Ratios and Supplemental Data$/i.test(l.text.trim()));
 if(!heading)return null;
 const head=lines.filter(l=>l.y<heading.y&&heading.y-l.y<45).flatMap(l=>l.items);
 const single=rx=>head.filter(i=>rx.test(i.str.trim()));
 const mer=single(/^ratio\s*\(MER\)$/i),before=single(/^MER before waivers$/i);
 const ptr=single(/^turnover rate$/i),trading=single(/^expense ratio$/i);
 if([mer,before,ptr,trading].some(a=>a.length!==1))return null;
 const anchors={MER:tokenCenter(mer[0]),PTR:tokenCenter(ptr[0])};
 if(!(anchors.MER<tokenCenter(before[0])&&tokenCenter(before[0])<anchors.PTR&&anchors.PTR<tokenCenter(trading[0])))return null;
 const rows=lines.filter(l=>l.y<heading.y-15&&l.y>heading.y-(extended?390:250))
  .map(l=>({line:l,yr:l.items.find(it=>it.x>=115&&it.x<=155&&/^20\d{2}$/.test(it.str.trim()))}))
  .filter(x=>x.yr).sort((a,b)=>b.line.y-a.line.y);
 const groups=[];let group;
 for(const r of rows){
  if(Number(r.yr.str)===yr){group=[];groups.push(group);}
  if(group)group.push(r);
 }
 const hits=[];
 for(const group of groups){
  if(!group.length||!group.every((r,i)=>Number(r.yr.str)===yr-i))continue;
  const top=group[0].line.y,next=groups[groups.indexOf(group)+1]?.[0]?.line.y;
  const bottom=next===undefined?Math.max(heading.y-(extended?410:270),top-190):next;
  const caps=lines.filter(l=>l.y<=top+2&&l.y>bottom&&
   l.items.some(it=>it.x<120&&/^Series\s+[A-Z][A-Z0-9]*$/i.test(it.str.trim())))
   .flatMap(l=>l.items.filter(it=>it.x<120&&/^Series\s+[A-Z][A-Z0-9]*$/i.test(it.str.trim())))
   .map(it=>compactName(it.str));
  if(caps.length!==1||caps[0]!==compactName(row.class_name))continue;
  const mark=cells(group[0].line).filter(c=>matchesCell(c,value)&&Math.abs(c.x+c.box.w/2-anchors[key])<24);
  if(mark.length===1)hits.push(mark[0]);
 }
 const uniq=new Map(hits.map(c=>[c.box.x.toFixed(1)+':'+c.box.y.toFixed(1),c]));
 return uniq.size===1?[...uniq.values()][0]:null;
}
function locateCell_brandes(page,lines,row,key,value,context){
 const isGqg=/^GQG Partners\s/i.test(row.fund_name||'');
 const familyMatrix=String(row.evidence?.MER?.source||'')==='Bridgehouse current-period verified ratio matrix';
 const selected=(isGqg||familyMatrix)?brandesGqgCell(page,lines,row,key,value,familyMatrix):brandesCell(page,lines,row,key,value);
 return selected?{...selected,page:page.page,metric:key,kind:row.fmc_key+(isGqg?'-gqg-verified-series-year-metric':familyMatrix?'-family-verified-series-year-metric':'-verified-class-period-column')}:null;
}

