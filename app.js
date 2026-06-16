// ── CONFIG ────────────────────────────────────────────────────────────────────
var PR_MIN=0.75, PR_MAX=0.82, PR_BASE=0.78;
var PHP_TO_USD=0.0164, EUR_TO_USD=0.92, COP_TO_USD=0.000244, BRL_TO_USD=0.172, DOP_TO_USD=0.0167;
var ENDPOINT='https://script.google.com/macros/s/AKfycbzDQMUfYTdJTqedmgH4ArYqOi5Ms73CE7pw2dnXgtBoxl4KnlZoNK4UjqA2vgfkRD02PQ/exec';
var SYM={USD:'$',EUR:'E'};

// ── REGION CONFIG ─────────────────────────────────────────────────────────────
var REGIONS = {
  carib:     { label:'Caribbean & Central America',              pshMin:5.0, pshMax:6.5, pshMid:5.8, rateMin:0.12, rateMax:0.20, rateMid:0.16 },
  'sam-n':   { label:'South America - Andean & Caribbean Coast', pshMin:4.5, pshMax:5.5, pshMid:5.0, rateMin:0.07, rateMax:0.15, rateMid:0.11 },
  'sam-s':   { label:'South America - Southern Cone & Brazil',   pshMin:4.0, pshMax:5.5, pshMid:4.8, rateMin:0.10, rateMax:0.20, rateMid:0.15 },
  'europe-s':{ label:'Southern Europe',                          pshMin:3.8, pshMax:5.2, pshMid:4.5, rateMin:0.12, rateMax:0.20, rateMid:0.16 },
  sea:       { label:'Southeast Asia',                           pshMin:4.5, pshMax:5.5, pshMid:5.0, rateMin:0.10, rateMax:0.22, rateMid:0.16 }
};
var DEFAULT_REGION = { label:'Southeast Asia', pshMin:4.5, pshMax:5.5, pshMid:5.0, rateMin:0.10, rateMax:0.22, rateMid:0.16 };

var zeroGenConfirmed=false;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function toUSD(a,c){
  if(c==='PHP')return a*PHP_TO_USD;
  if(c==='EUR')return a*EUR_TO_USD;
  if(c==='COP')return a*COP_TO_USD;
  if(c==='BRL')return a*BRL_TO_USD;
  if(c==='DOP')return a*DOP_TO_USD;
  return a;
}
function toDisplay(usd,c){return c==='EUR'?usd/EUR_TO_USD:usd;}
function fmt(n,c){
  var s=SYM[c]||'$';
  n=Math.round(n);
  if(n>=1000000)return s+(n/1000000).toFixed(1).replace(/\.0$/,'')+'M';
  if(n>=1000)return s+(n/1000).toFixed(0)+'K';
  return s+n.toLocaleString();
}
function fmtN(n){return Math.round(n||0).toLocaleString();}
function degradedPR(yr){return Math.max(0.60,PR_BASE-Math.max(0,2026-parseInt(yr||2020))*0.005);}
function colorVal(a,b,hi){var r=a/b;if(hi)return r>=0.95?'c-ok':r>=0.80?'c-warn':'c-bad';return r<=1.05?'c-ok':r<=1.20?'c-warn':'c-bad';}
function toLeft(s){return 8+s*0.84;}
function getRegion(r){return REGIONS[r]||DEFAULT_REGION;}
function getRates(r){var rc=getRegion(r);return{min:rc.rateMin,max:rc.rateMax,mid:rc.rateMid};}
function getSY(r){
  var rc=getRegion(r);
  var avg=Math.round(rc.pshMid*365*PR_BASE);
  var b20=Math.round(rc.pshMin*365*(PR_BASE-0.08));
  var t20=Math.round(rc.pshMax*365*(PR_BASE+0.04));
  return{avg:avg,b20:b20,t20:t20};
}
function getPSH(r){var rc=getRegion(r);return{min:rc.pshMin,max:rc.pshMax,mid:rc.pshMid};}

function getRegionLabel(r){
  var rc=getRegion(r);
  return rc.label;
}

function getSourceNote(r,syB20,syT20,rMin,rMax,pMin,pMax){
  var base='PR range: '+PR_MIN+'-'+PR_MAX+'. Specific yield: '+syB20.toLocaleString()+'-'+syT20.toLocaleString()+' kWh/kWp/yr. Peak sun hours: '+pMin+'-'+pMax+' hrs/day. Degradation: 0.5%/year. Indicative estimates only.';
  var rateNote='Rate range: $'+rMin+'-$'+rMax+'/kWh. ';
  if(r==='carib') return 'Benchmarks: SIE Dominican Republic, Global Solar Atlas Caribbean, Climatescope 2025. '+rateNote+base;
  if(r==='sam-n') return 'Benchmarks: UPME Colombia, Global Solar Atlas Andean region, Intratec 2025. '+rateNote+base;
  if(r==='sam-s') return 'Benchmarks: ANEEL Brazil, Global Solar Atlas Southern Cone, Intratec 2025. '+rateNote+base;
  if(r==='europe-s') return 'Benchmarks: ENTSO-E, Global Solar Atlas Southern Europe, Eurostat 2025. '+rateNote+base;
  return 'Benchmarks: Philippine DOE, Meralco rates, Global Solar Atlas Southeast Asia. '+rateNote+base;
}

function tierInfo(score,loc){
  var l=loc||'Southeast Asia';
  if(score>=80)return{label:'Top 20%',pill:'background:#d4f5e9;color:#085041',txt:'Your system is in the top 20% of industrial solar systems in '+l+'.'};
  if(score>=60)return{label:'Above average',pill:'background:#e1f5ee;color:#1D9E75',txt:'Your system is performing above average for your sector in '+l+'.'};
  if(score>=38)return{label:'Average',pill:'background:#fff8e1;color:#b7791f',txt:'Your system is around the sector average in '+l+'. There is room to move into the top tier.'};
  if(score>=18)return{label:'Below average',pill:'background:#fff3e0;color:#c0392b',txt:'Your system is underperforming compared to similar facilities in '+l+'.'};
  return{label:'Bottom 20%',pill:'background:#fdecea;color:#c0392b',txt:'Your system is in the bottom 20% of industrial solar in '+l+'. Significant losses are occurring.'};
}

function diagnose(actualPR,ageBenchPR,ageYrs){
  var r=actualPR/ageBenchPR;
  if(ageYrs<3&&r<0.85)return{title:'Probable cause: inverter underperformance or shading - not age-related',text:'This system is only '+ageYrs+' year'+(ageYrs!==1?'s':'')+' old so panel degradation is not the cause. A performance ratio of '+actualPR.toFixed(2)+' on a new system points to inverter clipping, partial shading, or a wiring fault.',isOk:false};
  if(ageYrs>=5&&r<0.88)return{title:'Probable cause: degradation and soiling',text:'At '+ageYrs+' years old, this system has lost approximately '+(ageYrs*0.5).toFixed(1)+'% to natural degradation. The remaining gap is likely soiling. A panel wash and IR thermal inspection would confirm.',isOk:false};
  if(r<0.92)return{title:'Probable cause: soiling and minor losses',text:'The gap is consistent with surface soiling and normal losses. Regular cleaning every 6-8 weeks typically closes this gap.',isOk:false};
  return{title:'System performing within benchmark range',text:'Performance ratio of '+actualPR.toFixed(2)+' is within the expected range. Focus on maintaining your cleaning schedule.',isOk:true};
}

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
function switchTab(tab){
  document.getElementById('tab-solar').classList.toggle('active',tab==='solar');
  document.getElementById('tab-fuel').classList.toggle('active',tab==='fuel');
  document.getElementById('tab-downtime').classList.toggle('active',tab==='downtime');
  document.getElementById('phase1').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('results').innerHTML='';
  var banner=document.getElementById('coming-soon-banner');
  banner.classList.add('hidden');
  banner.innerHTML='';
  if(tab==='solar'){document.getElementById('phase1').classList.remove('hidden');return;}
  var lbl=tab==='fuel'?'Fuel consumption':'Machine downtime';
  var desc=tab==='fuel'
    ?'Benchmark your fuel and steam consumption against sector averages across Southeast Asia, Colombia, Brazil and the Dominican Republic. Identify excess consumption, estimate cost of losses, and get a probable cause.'
    :'Benchmark your unplanned machine downtime against sector averages. Calculate the revenue cost of reactive maintenance and find out whether a planned maintenance programme would pay for itself.';
  banner.innerHTML=
    '<div class="coming-soon-icon">Coming soon</div>'+
    '<div class="coming-soon-title">'+lbl+' diagnostic - coming soon</div>'+
    '<div class="coming-soon-desc">'+desc+'</div>'+
    '<div class="waitlist-row">'+
      '<input type="text" id="wl-name-'+tab+'" placeholder="Your name">'+
      '<input type="email" id="wl-email-'+tab+'" placeholder="Your email">'+
    '</div>'+
    '<button class="waitlist-btn" id="wl-btn-'+tab+'" onclick="joinWaitlist(\''+tab+'\',\''+lbl+'\')">Join waitlist</button>'+
    '<div class="waitlist-success" id="wl-success-'+tab+'">You are on the list - we will let you know when it launches.</div>';
  banner.classList.remove('hidden');
}

// ── FORM LOGIC ────────────────────────────────────────────────────────────────
function updateCountryField(){
  var r=document.getElementById('region').value;
  var f=document.getElementById('country-field');
  var i=document.getElementById('country');
  if(r){
    f.classList.remove('hidden');
    i.value='';
    i.placeholder='e.g. '+({
      'carib':'Dominican Republic, Mexico, Costa Rica...',
      'sam-n':'Colombia, Ecuador, Peru, Venezuela...',
      'sam-s':'Brazil, Argentina, Chile, Uruguay...',
      'europe-s':'Romania, Spain, Portugal, Italy...',
      'sea':'Philippines, Vietnam, Indonesia...'
    }[r]||'Your country...');
  } else {
    f.classList.add('hidden');
    i.value='';
  }
  updatePowerFields();
}

function updatePowerFields(){
  var v=document.getElementById('power-source').value;
  var has=['grid-solar','grid-solar-genset','solar-genset'].indexOf(v)!==-1;
  document.getElementById('solar-fields').classList.toggle('hidden',!has);
  zeroGenConfirmed=false;
}

function clearGenConfirm(){
  if(parseFloat(document.getElementById('actual-gen').value)>0){
    document.getElementById('gen-confirm').classList.add('hidden');
    document.getElementById('actual-gen').classList.remove('err');
    zeroGenConfirmed=false;
  }
}

function confirmZeroGen(yes){
  if(yes){
    zeroGenConfirmed=true;
    document.getElementById('gen-confirm').classList.add('hidden');
  } else {
    document.getElementById('actual-gen').value='';
    document.getElementById('actual-gen').focus();
    document.getElementById('actual-gen').classList.add('err');
    document.getElementById('gen-confirm').classList.add('hidden');
    zeroGenConfirmed=false;
  }
}

// ── WAITLIST ──────────────────────────────────────────────────────────────────
function joinWaitlist(tab,lbl){
  var ne=document.getElementById('wl-name-'+tab);
  var ee=document.getElementById('wl-email-'+tab);
  var name=ne?ne.value.trim():'';
  var email=ee?ee.value.trim():'';
  if(!name||!email){alert('Please enter your name and email to join the waitlist.');return;}
  var btn=document.getElementById('wl-btn-'+tab);
  var suc=document.getElementById('wl-success-'+tab);
  btn.disabled=true;
  btn.textContent='Joining...';
  var params=new URLSearchParams({waitlist:'true',module:tab,moduleLabel:lbl,name:name,email:email,t:Date.now()}).toString();
  var img=new Image();
  img.onload=img.onerror=function(){suc.style.display='block';btn.textContent='Joined';};
  img.src=ENDPOINT+'?'+params;
}

// ── MAIN CALCULATION ──────────────────────────────────────────────────────────
function run(){
  var sector=document.getElementById('sector').value;
  var region=document.getElementById('region').value;
  var country=(document.getElementById('country').value||'').trim();
  var cur=document.getElementById('currency').value;
  var powerSource=document.getElementById('power-source').value;
  var bill=parseFloat(document.getElementById('bill').value)||0;
  var billCur=document.getElementById('bill-currency').value;
  var comments=document.getElementById('comments').value.trim();
  var hasSolar=['grid-solar','grid-solar-genset','solar-genset'].indexOf(powerSource)!==-1;
  var cap=hasSolar?(parseFloat(document.getElementById('capacity').value)||0):0;
  var year=hasSolar?document.getElementById('install-year').value:'';
  var actualGen=hasSolar?(parseFloat(document.getElementById('actual-gen').value)||0):0;

  if(!sector||!region||!powerSource||!bill){alert('Please answer all required questions.');return;}
  if(hasSolar&&(!cap||!year)){alert('Please enter your solar system capacity and installation year.');return;}
  if(hasSolar&&actualGen===0&&!zeroGenConfirmed){
    document.getElementById('gen-confirm').classList.remove('hidden');
    document.getElementById('actual-gen').classList.add('err');
    document.getElementById('actual-gen').scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  if(bill<=0){showError('Please enter a valid electricity bill.');return;}

  var billUSD=toUSD(bill,billCur);
  var ageYrs=year?Math.max(0,2026-parseInt(year)):0;
  var ageBenchPR=year?degradedPR(year):PR_BASE;
  var isOffline=hasSolar&&actualGen===0&&zeroGenConfirmed;
  var psLabels={'grid':'Grid only','grid-solar':'Grid + solar','grid-solar-genset':'Grid + solar + genset','solar-genset':'Solar + genset (off-grid)','grid-genset':'Grid + genset','other':'Other'};
  var psLabel=psLabels[powerSource]||powerSource;
  var regionLabel=getRegionLabel(region);
  var rates=getRates(region);
  var sybench=getSY(region);
  var psh=getPSH(region);
  var RATE_MIN=rates.min,RATE_MAX=rates.max,RATE_MID=rates.mid;
  var SY_B20=sybench.b20,SY_T20=sybench.t20,syAvg=sybench.avg;
  var PSH_MIN_R=psh.min,PSH_MAX_R=psh.max,PSH_MID_R=psh.mid;

  var html='';

  if(hasSolar&&actualGen>0){
    var maxT=cap*PSH_MAX_R*30*PR_MAX;
    if(actualGen>maxT*1.1){showError('A '+cap+' kW system cannot physically produce '+fmtN(actualGen)+' kWh/month here. Maximum possible is ~'+fmtN(maxT)+' kWh. The reading may be in MWh rather than kWh.');return;}
    var actualPR=actualGen/(cap*PSH_MID_R*30);
    var actualSY=(actualGen/cap)*12;
    var bMin=cap*PSH_MIN_R*30*PR_MIN,bMid=cap*PSH_MID_R*30*ageBenchPR,bMax=cap*PSH_MAX_R*30*PR_MAX;
    var gMin=Math.max(0,bMin-actualGen)*12,gMax=Math.max(0,bMax-actualGen)*12,gMid=Math.max(0,bMid-actualGen)*12;
    var aMinUSD=gMin*RATE_MIN,aMaxUSD=gMax*RATE_MAX,aMidUSD=gMid*RATE_MID;
    var aMin=toDisplay(aMinUSD,cur),aMax=toDisplay(aMaxUSD,cur),aMid=toDisplay(aMidUSD,cur);
    var score;
    if(actualSY>=SY_T20)score=95;
    else if(actualSY>=syAvg)score=65+(actualSY-syAvg)/(SY_T20-syAvg)*25;
    else if(actualSY>=SY_B20)score=25+(actualSY-SY_B20)/(syAvg-SY_B20)*40;
    else score=Math.max(3,(actualSY/SY_B20)*25);
    var t=tierInfo(score,regionLabel);
    var left=toLeft(score);
    var dx=diagnose(actualPR,ageBenchPR,ageYrs);
    var estLoad=billUSD/RATE_MID;
    var coverage=Math.round((actualGen/estLoad)*100);
    var warns=[];
    if(coverage<15&&cap>0)warns.push({t:'System likely undersized',d:'Your '+cap+' kW system covers only ~'+coverage+'% of estimated consumption. A well-sized system should cover 30-40%.',g:false});
    if(ageYrs>=5&&actualGen>cap*PSH_MID_R*30*ageBenchPR)warns.push({t:ageYrs+'-year-old system outperforming benchmark',d:'Despite '+ageYrs+' years of natural degradation, this system is generating above its age-adjusted benchmark.',g:true});
    if(actualGen>=bMax*0.95)warns.push({t:'Gap is minimal - near top of benchmark range',d:'Your system is generating at or near the maximum benchmark. Focus on sustaining current performance.',g:true});
    var wHTML=warns.map(function(w){return'<div class="'+(w.g?'opp-box':'warn-box')+'"><div class="'+(w.g?'opp-title':'warn-title')+'">'+w.t+'</div><div class="'+(w.g?'opp-text':'warn-text')+'">'+w.d+'</div></div>';}).join('');

    html=buildSolarResult(regionLabel,left,t,dx,wHTML,cap,bMin,bMax,bMid,actualGen,actualPR,ageBenchPR,actualSY,SY_B20,SY_T20,syAvg,region,RATE_MIN,RATE_MAX,PSH_MIN_R,PSH_MAX_R,gMin,gMax,aMid,aMin,aMax,aMidUSD,cur,ageYrs);
    window._summary={sector:sector,region:regionLabel,country:country,powerSource:psLabel,cap:cap,year:year,actualGen:actualGen,bill:bill,billCur:billCur,cur:cur,annualMin:Math.round(aMinUSD),annualMax:Math.round(aMaxUSD),annualMid:Math.round(aMidUSD),tier:t.label,comments:comments,isOffline:false};

  } else if(isOffline){
    var eM=cap*PSH_MID_R*30*ageBenchPR;
    var aMinUSD=eM*12*RATE_MIN,aMaxUSD=eM*12*RATE_MAX,aMidUSD=eM*12*RATE_MID;
    var dMin=toDisplay(aMinUSD/365,cur),dMax=toDisplay(aMaxUSD/365,cur);
    var aMin=toDisplay(aMinUSD,cur),aMax=toDisplay(aMaxUSD,cur),aMid=toDisplay(aMidUSD,cur);
    html=buildOfflineResult(regionLabel,fmt,eM,cap,dMin,dMax,aMin,aMax,aMid,RATE_MIN,RATE_MAX,cur);
    window._summary={sector:sector,region:regionLabel,country:country,powerSource:psLabel,cap:cap,year:year,actualGen:0,bill:bill,billCur:billCur,cur:cur,annualMin:Math.round(aMinUSD),annualMax:Math.round(aMaxUSD),annualMid:Math.round(aMidUSD),tier:'System offline',comments:comments,isOffline:true};

  } else {
    var mMin=billUSD*0.30,mMax=billUSD*0.40;
    var aMinUSD=mMin*12,aMaxUSD=mMax*12,aMidUSD=(aMinUSD+aMaxUSD)/2;
    var aMin=toDisplay(aMinUSD,cur),aMax=toDisplay(aMaxUSD,cur),aMid=toDisplay(aMidUSD,cur);
    var estSize=Math.round(billUSD/RATE_MID/30/PSH_MID_R*1.4/PR_BASE);
    html=buildNoSolarResult(regionLabel,estSize,mMin,mMax,aMin,aMax,aMid,region,SY_B20,SY_T20,RATE_MIN,RATE_MAX,PSH_MIN_R,PSH_MAX_R,cur,billUSD);
    window._summary={sector:sector,region:regionLabel,country:country,powerSource:psLabel,cap:estSize,year:'',actualGen:0,bill:bill,billCur:billCur,cur:cur,annualMin:Math.round(aMinUSD),annualMax:Math.round(aMaxUSD),annualMid:Math.round(aMidUSD),tier:'No solar installed',comments:comments,isOffline:false};
  }

  html+=buildLeadCapture();
  var el=document.getElementById('results');
  el.innerHTML=html;
  el.classList.remove('hidden');
  setTimeout(function(){el.scrollIntoView({behavior:'smooth',block:'start'});},50);
}

// ── RESULT BUILDERS ───────────────────────────────────────────────────────────
function buildBand(left,t){
  return '<div class="band-wrap"><div class="band"><div class="band-gradient"></div><div class="band-marker" style="left:'+left+'%"></div></div></div>'
    +'<div class="band-ticks"><span>Bottom 20%</span><span>Below avg</span><span>Average</span><span>Above avg</span><span>Top 20%</span></div>'
    +'<span class="position-pill" style="'+t.pill+'">'+t.label+'</span>'
    +'<div class="position-sentence">'+t.txt+'</div>';
}

function buildSolarResult(regionLabel,left,t,dx,wHTML,cap,bMin,bMax,bMid,actualGen,actualPR,ageBenchPR,actualSY,SY_B20,SY_T20,syAvg,region,RATE_MIN,RATE_MAX,PSH_MIN_R,PSH_MAX_R,gMin,gMax,aMid,aMin,aMax,aMidUSD,cur,ageYrs){
  return '<div class="card"><div class="phase-label">Readiness result</div>'
    +'<div class="band-intro">Compared to industrial solar installations in '+regionLabel+', benchmarked for your sector and system age.</div>'
    +buildBand(left,t)
    +'<div class="'+(dx.isOk?'opp-box':'cause-box')+'"><div class="'+(dx.isOk?'opp-title':'cause-title')+'">'+dx.title+'</div><div class="'+(dx.isOk?'opp-text':'cause-text')+'">'+dx.text+'</div></div>'
    +wHTML+'</div>'
    +'<div class="card"><div class="phase-label">Where the gap is</div>'
    +'<table class="gap-table"><thead><tr><td>Metric</td><td>Benchmark range</td><td>Your system</td></tr></thead><tbody>'
    +'<tr><td>Monthly generation<br><small style="font-size:11px;color:#ccc">'+cap+' kW system</small></td><td class="bench-val">'+fmtN(bMin)+'-'+fmtN(bMax)+' kWh</td><td class="actual-val '+colorVal(actualGen,bMid,true)+'">'+fmtN(actualGen)+' kWh</td></tr>'
    +'<tr><td>Performance ratio</td><td class="bench-val">'+PR_MIN+'-'+PR_MAX+'</td><td class="actual-val '+colorVal(actualPR,ageBenchPR,true)+'">'+actualPR.toFixed(2)+'</td></tr>'
    +'<tr><td>Annual yield per kW</td><td class="bench-val">'+SY_B20.toLocaleString()+'-'+SY_T20.toLocaleString()+' kWh/kW</td><td class="actual-val '+colorVal(actualSY,syAvg,true)+'">'+fmtN(actualSY)+' kWh/kW</td></tr>'
    +'</tbody></table>'
    +'<div class="source-note">'+getSourceNote(region,SY_B20,SY_T20,RATE_MIN,RATE_MAX,PSH_MIN_R,PSH_MAX_R)+'</div></div>'
    +'<div class="money-card"><div class="money-eyebrow">What your performance gap is costing you</div>'
    +'<div class="money-range">Estimated annual range</div>'
    +'<div class="money-amount">'+fmt(aMin,cur)+' - '+fmt(aMax,cur)+'</div>'
    +'<div class="money-mid">Midpoint estimate: '+fmt(aMid,cur)+'/year</div>'
    +'<div class="money-sub">Based on a generation shortfall of '+fmtN(gMin)+'-'+fmtN(gMax)+' kWh/year against the '+regionLabel+' benchmark.</div>'
    +'<div class="money-row"><span>Monthly equivalent (mid)</span><span>'+fmt(aMid/12,cur)+'/month</span></div>'
    +'<div class="money-row"><span>System age</span><span>'+ageYrs+' yr ('+(ageYrs*0.5).toFixed(1)+'% degradation)</span></div>'
    +'<div class="money-row"><span>Rate range used</span><span>$'+RATE_MIN+'-$'+RATE_MAX+'/kWh</span></div>'
    +'<div class="disclaimer">Indicative estimates based on published benchmarks for '+regionLabel+'. Range reflects variation in sunlight hours and electricity rates.</div></div>';
}

function buildOfflineResult(regionLabel,fmtFn,eM,cap,dMin,dMax,aMin,aMax,aMid,RATE_MIN,RATE_MAX,cur){
  return '<div class="card"><div class="phase-label">Readiness result</div>'
    +'<div class="band-intro">Your system is currently offline. Every day it remains down is a day of lost savings.</div>'
    +'<div class="band-wrap"><div class="band"><div class="band-gradient"></div><div class="band-marker" style="left:10%"></div></div></div>'
    +'<div class="band-ticks"><span>Bottom 20%</span><span>Below avg</span><span>Average</span><span>Above avg</span><span>Top 20%</span></div>'
    +'<span class="position-pill" style="background:#fdecea;color:#c0392b">System offline</span>'
    +'<div class="alert-box" style="margin-top:12px"><div class="alert-title">Immediate attention required</div>'
    +'<div class="alert-text">Common causes: inverter fault, tripped breaker, grid disconnect, or physical damage. Every day offline costs '+fmt(dMin,cur)+'-'+fmt(dMax,cur)+'.</div></div></div>'
    +'<div class="money-card"><div class="money-eyebrow">Cost of being offline</div>'
    +'<div class="money-range">Estimated annual range</div>'
    +'<div class="money-amount">'+fmt(aMin,cur)+' - '+fmt(aMax,cur)+'</div>'
    +'<div class="money-mid">Daily cost: '+fmt(dMin,cur)+'-'+fmt(dMax,cur)+'/day</div>'
    +'<div class="money-sub">Based on expected generation of '+fmtN(eM)+' kWh/month for a '+cap+' kW system at '+regionLabel+' benchmark.</div>'
    +'<div class="money-row"><span>Monthly cost (mid)</span><span>'+fmt(aMid/12,cur)+'/month</span></div>'
    +'<div class="disclaimer">Indicative estimate. Rate range: $'+RATE_MIN+'-$'+RATE_MAX+'/kWh.</div></div>';
}

function buildNoSolarResult(regionLabel,estSize,mMin,mMax,aMin,aMax,aMid,region,SY_B20,SY_T20,RATE_MIN,RATE_MAX,PSH_MIN_R,PSH_MAX_R,cur,billUSD){
  return '<div class="card"><div class="phase-label">Readiness result</div>'
    +'<div class="band-intro">Based on your energy spend compared to similar facilities in '+regionLabel+' that have deployed solar.</div>'
    +'<div class="band-wrap"><div class="band"><div class="band-gradient"></div><div class="band-marker" style="left:10%"></div></div></div>'
    +'<div class="band-ticks"><span>Bottom 20%</span><span>Below avg</span><span>Average</span><span>Above avg</span><span>Top 20%</span></div>'
    +'<span class="position-pill" style="background:#fff8e1;color:#b7791f">No solar installed</span>'
    +'<div class="opp-box" style="margin-top:12px"><div class="opp-title">Opportunity identified</div>'
    +'<div class="opp-text">Facilities in your sector with a well-designed solar system offset 30-40% of their electricity bill. Based on your spend, a correctly sized system (~'+estSize+' kW, ~'+Math.round(estSize*2.2)+' panels) could save '+fmt(toDisplay(mMin,cur),cur)+'-'+fmt(toDisplay(mMax,cur),cur)+' every month.</div></div></div>'
    +'<div class="card"><div class="phase-label">Where the gap is</div>'
    +'<table class="gap-table"><thead><tr><td>Metric</td><td>With solar (sector avg)</td><td>Your facility now</td></tr></thead><tbody>'
    +'<tr><td>Solar bill offset</td><td class="bench-val">30-40%</td><td class="actual-val c-bad">0%</td></tr>'
    +'<tr><td>Monthly saving potential</td><td class="bench-val">'+fmt(toDisplay(mMin,cur),cur)+'-'+fmt(toDisplay(mMax,cur),cur)+'</td><td class="actual-val c-bad">'+(SYM[cur]||'$')+'0</td></tr>'
    +'<tr><td>Estimated system size</td><td class="bench-val">~'+estSize+' kW</td><td class="actual-val c-bad">None</td></tr>'
    +'</tbody></table>'
    +'<div class="source-note">'+getSourceNote(region,SY_B20,SY_T20,RATE_MIN,RATE_MAX,PSH_MIN_R,PSH_MAX_R)+'</div></div>'
    +'<div class="money-card"><div class="money-eyebrow">What a well-designed solar system could save you</div>'
    +'<div class="money-range">Estimated annual range</div>'
    +'<div class="money-amount">'+fmt(aMin,cur)+' - '+fmt(aMax,cur)+'</div>'
    +'<div class="money-mid">Midpoint estimate: '+fmt(aMid,cur)+'/year</div>'
    +'<div class="money-sub">Based on 30-40% bill reduction - sector average outcome for facilities with a correctly sized system in '+regionLabel+'.</div>'
    +'<div class="money-row"><span>Monthly equivalent (mid)</span><span>'+fmt(aMid/12,cur)+'/month</span></div>'
    +'<div class="money-row"><span>Solar offset assumed</span><span>30-40% of bill</span></div>'
    +'<div class="disclaimer">Indicative estimate. Actual savings depend on system sizing, site conditions, and local tariffs.</div></div>';
}

function buildLeadCapture(){
  return '<div class="lead-card"><div class="lead-eyebrow">Your full report</div>'
    +'<div class="lead-headline">Receive this diagnosis by email</div>'
    +'<div class="lead-sub">TCO Studio will send you a detailed written report and reach out to discuss what a well-designed system looks like for your facility. Half-day on-site review. Assessment within 5 working days. No obligation.</div>'
    +'<div class="field"><div class="q-label">Your name</div><input type="text" id="lead-name" placeholder="e.g. Maria Santos"></div>'
    +'<div class="field"><div class="q-label">Your email</div><input type="email" id="lead-email" placeholder="e.g. maria@facility.com"></div>'
    +'<div class="field"><div class="q-label">Company</div><input type="text" id="lead-company" placeholder="e.g. Pacific Foods Inc."></div>'
    +'<div class="field"><div class="q-label">Your role</div>'
    +'<select id="lead-role"><option value="">Select your role...</option><option>Operations / Facility manager</option><option>Engineering</option><option>Finance / Management</option><option>Owner / Director</option><option>Other</option></select></div>'
    +'<button class="send-btn" id="send-btn" onclick="submitLead()">Send me the report</button>'
    +'<div id="lead-success" class="hidden success-box"><p>Report on its way, <strong id="success-name"></strong>. Check your inbox. Ready to talk? <a href="https://calendar.app.google/LNAJqA9m824djTY68" target="_blank" style="color:#1D9E75;font-weight:600">Book a conversation</a></p></div></div>'
    +'<button class="restart-btn" onclick="restartTool()">Run another diagnosis</button>'
    +'<div class="cta-strip"><div class="cta-strip-text"><strong>TCO Studio</strong><p>Energy system design for industrial facilities across emerging markets.</p></div>'
    +'<a class="cta-strip-btn" href="https://thecommonones.com" target="_blank">Learn more</a></div>';
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function showError(msg){
  var el=document.getElementById('results');
  el.innerHTML='<div class="error-box"><div class="error-title">Please check your inputs</div><div class="error-text">'+msg+'</div></div>';
  el.classList.remove('hidden');
  el.scrollIntoView({behavior:'smooth',block:'start'});
}

function restartTool(){
  document.getElementById('results').classList.add('hidden');
  document.getElementById('results').innerHTML='';
  switchTab('solar');
  document.getElementById('phase1').scrollIntoView({behavior:'smooth',block:'start'});
}

function submitLead(){
  var name=document.getElementById('lead-name').value.trim();
  var email=document.getElementById('lead-email').value.trim();
  var company=document.getElementById('lead-company').value.trim();
  var role=document.getElementById('lead-role').value;
  if(!name||!email){alert('Please enter your name and email to receive the report.');return;}
  var btn=document.getElementById('send-btn');
  btn.disabled=true;
  btn.textContent='Sending...';
  var s=window._summary||{};
  var params=new URLSearchParams({
    name:name,email:email,company:company||'',role:role||'',
    sector:s.sector||'',region:s.region||'',country:s.country||'',
    powerSource:s.powerSource||'',capacity:s.cap||'',year:s.year||'',
    actualGen:s.actualGen!==undefined?s.actualGen:'',
    bill:s.bill||'',billCur:s.billCur||'',currency:s.cur||'',
    tier:s.tier||'',annualGap:s.annualMid||'',
    annualMin:s.annualMin||'',annualMax:s.annualMax||'',
    isOffline:s.isOffline?'Yes':'No',comments:s.comments||''
  }).toString();
  var img=new Image();
  img.onload=img.onerror=function(){
    document.getElementById('lead-success').classList.remove('hidden');
    document.getElementById('success-name').textContent=name.split(' ')[0];
    btn.textContent='Sent';
  };
  img.src=ENDPOINT+'?'+params+'&t='+Date.now();
}