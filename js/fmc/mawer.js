/* Mawer Investment Management Ltd. — annual and interim native-text MRFPs.
 * Product-independent ratio panels may start in either PDF column and continue
 * at the top of the next column.  All financial evidence is actual PDF.js text.
 */
// @mrfp:profile
const profile_mawer={
 key:'mawer',label:'Mawer Investment Management Ltd.',style:'mawer',
 signatures:[
  /\bportfolio\s+advisor\s*,?\s*Mawer\b/i,
  /\bMawer\s+Investment\s+Management\s+Ltd\.?/i,
  /^\s*Mawer\s+.{4,160}\bFund\s*$/im
 ],
 // A product title alone MUST NOT identify the manager.  Other managers
 // may legitimately list a Mawer fund as a holding.  Manager-role signature
 // is required; fund identity is read dynamically from the cover items.
 title:null
};
const fmcConfig_mawer={allowRowFallback:false};

// @mrfp:extraction
function mawerClean(value){return String(value||'').normalize('NFKC').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();}
function mawerReportPeriod(pages){
 const head=String(pages?.[0]?.text||'');
 const names={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
 const matches=[...head.matchAll(/\bFor\s+the\s+(?:Year|Period)\s+Ended\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/gi)];
 if(matches.length!==1)return null;
 const m=matches[0],iso=`${m[3]}-${names[m[1].toLowerCase()]}-${m[2].padStart(2,'0')}`;
 return Number(m[2])>=1&&Number(m[2])<=new Date(Date.UTC(Number(m[3]),Number(names[m[1].toLowerCase()]),0)).getUTCDate()?iso:null;
}
function selectReportDate_mawer(pages){return mawerReportPeriod(pages);}
function identifyFundEarly_mawer(pages){
 const page=pages?.[0],head=(page?.items||[]).filter(it=>it.y>700&&it.x<300).map(it=>mawerClean(it.str));
 const titles=head.filter(s=>/^Mawer\s+.{4,160}\bFund$/i.test(s));
 return titles.length===1?titles[0]:undefined;
}
function mawerHeading(s){
 const txt=mawerClean(s);const plain=mrfpV7SeriesLabel(txt);
 if(plain&&/^(?:Series|Class)\s+[A-Z][A-Z0-9-]{0,11}$/i.test(plain))return {cls:plain,display:plain};
 const renamed=/^((?:Series|Class)\s+[A-Z][A-Z0-9-]{0,11})\s+\(formerly\s+((?:Series|Class)\s+[A-Z][A-Z0-9-]{0,11})\)$/i.exec(txt);
 if(renamed){const current=mrfpV7SeriesLabel(renamed[1]),former=mrfpV7SeriesLabel(renamed[2]);
  if(current&&former)return {cls:current,display:`${current} (formerly ${former})`};}
 return null;
}
function mawerRatioPanels(page,date){
 if(!Array.isArray(page?.items)||page.ocrUsed||!/^20\d{2}-\d\d-\d\d$/.test(date||''))return [];
 const items=page.items.filter(it=>it.str&&Number.isFinite(it.x)&&Number.isFinite(it.y));
 const width=page.width||612,year=Number(date.slice(0,4));
 if(!items.some(it=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(mawerClean(it.str))))return [];
 const panels=[];
 for(const [lo,hi] of [[0,width/2+15],[width/2+15,width+8]]){
  const own=items.filter(it=>it.x>=lo&&it.x<hi);
  const headings=[];
  for(const it of own){
   if(!/^(?:Series|Class)\s+[A-Z][A-Z0-9-]{0,11}(?:\s*\(formerly\b)?/i.test(mawerClean(it.str)))continue;
   const next=own.filter(t=>Math.abs(t.x-it.x)<3&&t.y<it.y-3&&it.y-t.y<13).sort((a,b)=>b.y-a.y)[0];
   const raw=/\(formerly\s*$/i.test(mawerClean(it.str))&&next?it.str+' '+next.str:it.str;
   const heading=mawerHeading(raw);if(!heading)continue;
   const yr=own.filter(t=>/^20\d{2}$/.test(mawerClean(t.str))&&t.y<=it.y+2&&t.y>=it.y-13)
     .sort((a,b)=>a.x-b.x);
   if(yr.length<2||Number(yr[0].str)!==year||!yr.every((t,i)=>i===0||Number(t.str)<Number(yr[i-1].str)))continue;
   if(yr[0].x<=it.x+30||yr[0].x>lo+(hi-lo)*.67)continue;
   headings.push({...heading,head:it,years:yr});
  }
  headings.sort((a,b)=>b.head.y-a.head.y);
  for(let i=0;i<headings.length;i++){
   const h=headings[i],bottom=headings[i+1]?.head.y||0;
   const within=own.filter(it=>it.y<h.head.y-11&&it.y>bottom+3&&it.x< h.years[0].x-23);
   // Source cell belongs to the first printed year.  Different-year columns
   // and adjacent Series blocks must never satisfy the current value.
   const current=h.years[0],nextYear=h.years[1],boundary=(current.x+nextYear.x)/2;
   const pick=key=>{
    const possible=[];
    for(const label of within){
     const s=mawerClean(label.str);
     let rowY=null;
     if(key==='PTR'&&/^Portfolio\s+turnover\s+rate(?:\d+)?$/i.test(s))rowY=label.y;
     if(key==='MER'&&/^Management\s+expense\s+ratio(?:[¹²³⁴]|\d+)?$/i.test(s))rowY=label.y;
     if(key==='MER'&&/^Management\s+expense$/i.test(s)){
      const follow=within.find(it=>Math.abs(it.x-label.x)<3&&it.y<label.y-3&&label.y-it.y<12&&/^ratio(?:[¹²³⁴]|\d+)?$/i.test(mawerClean(it.str)));
      if(follow)rowY=follow.y;
     }
     if(rowY===null)continue;
     const candidates=own.filter(it=>Math.abs(it.y-rowY)<1.7&&it.x>current.x-17&&it.x<boundary&&/^\d+(?:\.\d+)?%$/.test(mawerClean(it.str)));
     if(candidates.length===1)possible.push({value:Number(candidates[0].str.replace('%','')),cell:candidates[0],label});
    }
    return possible.length===1?possible[0]:null;
   };
   const mer=pick('MER'),ptr=pick('PTR');
   if(mer&&ptr&&Number.isFinite(mer.value)&&Number.isFinite(ptr.value))panels.push({...h,mer,ptr,page:page.page});
  }
 }
 return panels;
}
function extract_mawer(pages,profile,fund,date){
 if(!date||date!==mawerReportPeriod(pages)||!fund||fund==='Unknown Fund'||!/^Mawer\s+.+\bFund$/i.test(fund))return [];
 const found=new Map(),conflicts=new Set();
 for(const p of pages){
  for(const panel of mawerRatioPanels(p,date)){
   const key=panel.cls.toLowerCase(),values={MER:panel.mer.value,TER:null,PTR:panel.ptr.value};
   const row={cls:panel.cls,...(panel.display!==panel.cls?{displayCls:panel.display}:{}),quality:3,values,
    evidence:{MER:{page:p.page,source:'Current-year printed management expense ratio',method:'native-js'},
              PTR:{page:p.page,source:'Current-year printed portfolio turnover rate',method:'native-js'}}};
   if(found.has(key)){if(JSON.stringify(found.get(key).values)!==JSON.stringify(values)||found.get(key).displayCls!==row.displayCls)conflicts.add(key);}
   else found.set(key,row);
  }
 }
 for(const key of conflicts)found.delete(key);
 return [...found.values()];
}
function auditRatioHeadings_mawer(text,potential){
 // A heading is only a candidate when backed by a physical ratio panel.
 // Do not promote incidental mentions in fee prose, charts, or NAV tables.
}

// @mrfp:evidence
const evidencePolicy_mawer={stamps:{mawerNativeRatioVersion:1}};
function mawerEvClean(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function validateDocumentEvidence_mawer(pages,row){
 const head=String(pages?.[0]?.text||'');
 // Read the native left-column text: page.text interleaves two columns and
 // can insert unrelated right-column prose inside the manager's legal name.
 const owner=String(pages?.[0]?.leftText||head);
 const manager=/\bportfolio\s+advisor\s*,?\s*Mawer\s+Investment\s+Management\s+Ltd\.?/i.test(owner);
 const cover=/\bFor\s+the\s+(?:Year|Period)\s+Ended\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})/i.exec(head);
 if(!manager||!cover||!/^20\d\d-\d\d-\d\d$/.test(row.report_date||''))return false;
 const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
 if(`${cover[3]}-${months[cover[1].toLowerCase()]}-${cover[2].padStart(2,'0')}`!==row.report_date)return false;
 const name=mawerEvClean(row.fund_name).toLowerCase();
 return name.length>14&&pages.slice(0,1).some(pg=>(pg.items||[]).some(it=>mawerEvClean(it.str).toLowerCase()===name));
}
function mawerEvidenceHeading(raw){
 const s=mawerEvClean(raw),m=/^((?:Series|Class)\s+[A-Z][A-Z0-9-]{0,11})(?:\s+\(formerly\s+((?:Series|Class)\s+[A-Z][A-Z0-9-]{0,11})\))?$/i.exec(s);
 if(!m)return null;
 const primary=mrfpV7SeriesLabel(m[1]);if(!primary)return null;
 if(m[2]&&!mrfpV7SeriesLabel(m[2]))return null;
 return {cls:primary,display:m[2]?`${primary} (formerly ${mrfpV7SeriesLabel(m[2])})`:primary};
}
function locateCell_mawer(page,lines,row,key,value,context){
 if(!page||page.ocrUsed||!Array.isArray(page.items)||!['MER','PTR'].includes(key)||!Number.isFinite(value))return null;
 const docName=mawerEvClean(row.fund_name).toLowerCase();
 if(!(page.items||[]).some(it=>mawerEvClean(it.str).toLowerCase()===docName))return null;
 if(!page.items.some(it=>/^Ratios\s+and\s+Supplemental\s+Data$/i.test(mawerEvClean(it.str))))return null;
 const year=Number(String(row.report_date||'').slice(0,4)),width=page.width||612,claimed=row.class_identity||row.class_name;
 const results=[];
 for(const [lo,hi] of [[0,width/2+15],[width/2+15,width+8]]){
  const own=page.items.filter(it=>it.x>=lo&&it.x<hi),heads=[];
  for(const it of own){
   if(!/^(?:Series|Class)\s+[A-Z][A-Z0-9-]{0,11}/i.test(mawerEvClean(it.str)))continue;
   const follow=own.filter(n=>Math.abs(n.x-it.x)<3&&it.y-n.y>3&&it.y-n.y<13).sort((a,b)=>b.y-a.y)[0];
   const phrase=/\(formerly\s*$/i.test(mawerEvClean(it.str))&&follow?it.str+' '+follow.str:it.str;
   const head=mawerEvidenceHeading(phrase);if(!head)continue;
   const yrs=own.filter(t=>/^20\d{2}$/.test(mawerEvClean(t.str))&&t.y<=it.y+2&&t.y>=it.y-13).sort((a,b)=>a.x-b.x);
   if(yrs.length<2||Number(yrs[0].str)!==year||!yrs.every((t,i)=>i===0||Number(t.str)<Number(yrs[i-1].str)))continue;
   if(yrs[0].x<=it.x+30||yrs[0].x>lo+(hi-lo)*.67)continue;
   heads.push({...head,head:it,yrs});
  }
  heads.sort((a,b)=>b.head.y-a.head.y);
  for(let i=0;i<heads.length;i++){
   const h=heads[i];if(h.cls.toLowerCase()!==String(claimed).toLowerCase()||h.display.toLowerCase()!==String(row.class_name).toLowerCase())continue;
   const floor=heads[i+1]?.head.y||0,headX=h.yrs[0].x,bound=(h.yrs[0].x+h.yrs[1].x)/2;
   const labels=own.filter(it=>it.x<headX-23&&it.y<h.head.y-11&&it.y>floor+3);
   const hits=[];
   for(const label of labels){
    let actualY=null,s=mawerEvClean(label.str);
    if(key==='PTR'&&/^Portfolio\s+turnover\s+rate(?:\d+)?$/i.test(s))actualY=label.y;
    if(key==='MER'&&/^Management\s+expense\s+ratio(?:[¹²³⁴]|\d+)?$/i.test(s))actualY=label.y;
    if(key==='MER'&&/^Management\s+expense$/i.test(s)){
     const next=labels.find(n=>Math.abs(n.x-label.x)<3&&label.y-n.y>3&&label.y-n.y<12&&/^ratio(?:[¹²³⁴]|\d+)?$/i.test(mawerEvClean(n.str)));
     if(next)actualY=next.y;
    }
    if(actualY===null)continue;
    const matching=own.filter(it=>Math.abs(it.y-actualY)<1.7&&it.x>headX-17&&it.x<bound&&/^\d+(?:\.\d+)?%$/.test(mawerEvClean(it.str))&&Math.abs(Number(it.str.replace('%',''))-value)<.000001);
    if(matching.length===1)hits.push(matching[0]);
   }
   if(hits.length===1)results.push(hits[0]);
  }
 }
 const unique=new Map(results.map(it=>[`${it.x.toFixed(2)}:${it.y.toFixed(2)}`,it]));
 if(unique.size!==1)return null;
 const it=[...unique.values()][0];
 return {value,raw:it.str,x:it.x,box:{x:Math.max(0,it.x-1),y:it.y-1,w:it.w+2,h:it.h+2},page:page.page,metric:key,kind:'mawer-current-year-native-source-cell'};
}
