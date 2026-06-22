/* =====================================================================
   NextBio 영업앱 — 데이터 · 로그인(데모) · KPI 레이어
   ▼ 지금은 브라우저 localStorage. 실제 보안 로그인/다중사용자/영구저장은
     나중에 백엔드(DB+Auth) 붙일 때 이 파일만 교체. ▲
   ===================================================================== */
const TODAY=new Date(2026,5,19);
const fmt=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
const yymmdd=d=>{const x=new Date(d);return String(x.getFullYear()).slice(2)+String(x.getMonth()+1).padStart(2,'0')+String(x.getDate()).padStart(2,'0');};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const won=n=>(Number(n)||0).toLocaleString('ko-KR');
const eok=n=>{n=Number(n)||0; if(n>=1e8)return (n/1e8).toFixed(2)+'억'; if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만'; return won(n);};
const nowt=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};

/* ---------- 로그인(데모) / 권한 ---------- */
const TEAMS=['영업1팀','영업2팀','해외영업팀'];
const USERS=[
  {id:'kim',  pw:'1234', name:'김지훈', team:'영업1팀',   role:'팀장'},
  {id:'lee',  pw:'1234', name:'이서연', team:'영업1팀',   role:'멤버'},
  {id:'choi', pw:'1234', name:'최민호', team:'영업2팀',   role:'팀장'},
  {id:'jung', pw:'1234', name:'정해외', team:'해외영업팀', role:'팀장'},
  {id:'admin',pw:'1234', name:'관리자', team:'전체',      role:'관리자(허가자)'},
];
const SKEY='nb_sales_session';
function currentUser(){ const id=localStorage.getItem(SKEY); return USERS.find(u=>u.id===id)||null; }
function login(id,pw){ const u=USERS.find(x=>x.id===id&&x.pw===pw); if(u){localStorage.setItem(SKEY,u.id);return u;} return null; }
function logout(){ localStorage.removeItem(SKEY); location.href='login.html'; }
function requireLogin(){ const u=currentUser(); if(!u){location.replace('login.html');} return u; }
function isAdmin(u){ return u && u.role.startsWith('관리자'); }
function canSeeTeam(u,team){ return isAdmin(u)||u.team===team; }
function canEdit(u,team){ return isAdmin(u)||u.team===team; }
// 사용자가 볼 수 있는 팀 목록(관리자=전체, 멤버=자기팀)
function visibleTeams(u){ return isAdmin(u)?TEAMS.slice():[u.team]; }

/* ---------- 마스터 ---------- */
const TEAM_CUSTOMERS={
  '영업1팀':['코너스톤랩스','할리스','이디야'],
  '영업2팀':['엠즈씨드','썬푸드','제이드'],
  '해외영업팀':['글로벌커피(US)','아시아마트(SG)','유로빈즈(DE)'],
};
const PRODUCTS={
  '40001580':{name:'와플대학 디카페인 콜드브루',unit:'EA'},
  '40001503':{name:'폴 바셋 콜드브루 시그니처 원액',unit:'EA'},
  '40005002':{name:'넥스트 커피분말 [COL 100%]',unit:'KG'},
  '40001500':{name:'할리스 콜드브루',unit:'BOX'},
  '40007030':{name:'횡성 깜놀 토마토주스 180ml',unit:'EA'},
};
const PRICE={'40001580':5720,'40001503':8770,'40005002':27500,'40001500':6600,'40007030':31680};
const PRICEBOOK={'코너스톤랩스':{'40001580':5720},'썬푸드':{'40001580':5500},'엠즈씨드':{'40001503':8770},'할리스':{'40005002':27500},'글로벌커피(US)':{'40001503':9200}};
const OSTAT={'미확정':'t-adj','확정':'t-prod','생산완료':'t-cons','출고준비완료':'t-in','부분출고':'t-out','출고지시':'t-out','출고완료':'t-in','취소':'t-adj'};
const ADDRESSES={
  '코너스톤랩스':[{code:'C01691-01',name:'코너스톤랩스 본사'},{code:'C01691-02',name:'코너스톤랩스 물류센터'}],
  '엠즈씨드':[{code:'C01295-18',name:'성은센터(임시)'}],'할리스':[{code:'C01197-01',name:'할리스 음성공장'}],
  '썬푸드':[{code:'C03001-01',name:'썬푸드 김포'}],'제이드':[{code:'C03222-01',name:'제이드 본사'}],
  '이디야':[{code:'C01136-01',name:'이디야 평택물류'}],
  '글로벌커피(US)':[{code:'EX-US-01',name:'LA Port Warehouse'}],'아시아마트(SG)':[{code:'EX-SG-01',name:'Singapore DC'}],'유로빈즈(DE)':[{code:'EX-DE-01',name:'Hamburg Hub'}],
};

/* ---------- 저장/로드 ---------- */
const KEY='nb_sales_v4';
let DB={orders:[],shipOrders:[],sales:[]}, seq=1;
function save(){ localStorage.setItem(KEY,JSON.stringify({DB,seq})); }
function load(){
  const raw=localStorage.getItem(KEY);
  if(raw){ try{const o=JSON.parse(raw);DB=o.DB;seq=o.seq;if(!DB.orders)DB.orders=[];if(!DB.shipOrders)DB.shipOrders=[];if(!DB.sales)DB.sales=[];return;}catch(e){} }
  seed();
}
function resetAll(){ if(confirm('샘플 데이터로 초기화할까요?')){ localStorage.removeItem(KEY); location.reload(); } }

// 월별 매출(백만원 단위) 시드 → KPI/차트용 실현 매출 이력
const M2025={'영업1팀':[42,38,45,50,48,52,55,60,58,62,65,70],'영업2팀':[30,33,31,35,40,38,42,45,44,47,50,55],'해외영업팀':[20,22,25,24,28,30,33,35,38,40,42,48]};
const M2026={'영업1팀':[48,45,52,58,55,40],'영업2팀':[36,38,40,44,48,33],'해외영업팀':[28,30,34,36,40,30]};
function seed(){
  seq=1;
  const sales=[];
  const prodPool=Object.keys(PRODUCTS);
  TEAMS.forEach(team=>{
    const custs=TEAM_CUSTOMERS[team];
    M2025[team].forEach((v,m)=> sales.push({date:`2025-${String(m+1).padStart(2,'0')}-15`,team,partner:custs[m%custs.length],item:prodPool[m%prodPool.length],amount:v*1e6}));
    M2026[team].forEach((v,m)=> sales.push({date:`2026-${String(m+1).padStart(2,'0')}-15`,team,partner:custs[m%custs.length],item:prodPool[(m+1)%prodPool.length],amount:v*1e6}));
    // 오늘(2026-06-19) 매출 — 팀별
    const todayAmt={'영업1팀':12,'영업2팀':8,'해외영업팀':15}[team]*1e6;
    sales.push({date:'2026-06-19',team,partner:custs[0],item:prodPool[0],amount:todayAmt});
  });
  const O=(id,team,due,partner,item,qty,price,pq,status,logs)=>({id,team,date:'2026-06-1'+(seq%9),due,partner,item,qty,price,producedQty:pq,status,log:logs});
  const orders=[
    O('SO-260610-01','영업1팀','2026-06-22','코너스톤랩스','40001580',1000,5720,1000,'부분출고',[{at:'2026-06-11 14:00',who:'영업1팀',txt:'확정'},{at:'2026-06-19 09:20',who:'영업1팀',txt:'1차 출고지시 600 (본사) → SH-260619-02, 잔여 400'}]),
    O('SO-260614-05','영업1팀','2026-06-28','이디야','40001580',600,5720,600,'출고준비완료',[{at:'2026-06-15 09:00',who:'영업1팀',txt:'확정'},{at:'2026-06-19 09:00',who:'품질팀',txt:'검수완료 → 출고준비완료'}]),
    O('SO-260605-03','영업1팀','2026-06-18','할리스','40005002',200,27500,200,'출고완료',[{at:'2026-06-06 09:00',who:'영업1팀',txt:'확정'},{at:'2026-06-16 15:30',who:'물류팀',txt:'출고완료'}]),
    O('SO-260612-02','영업2팀','2026-06-25','엠즈씨드','40001503',500,8770,0,'확정',[{at:'2026-06-13 10:30',who:'영업2팀',txt:'확정 (생산계획 공유)'}]),
    O('SO-260613-07','영업2팀','2026-06-27','제이드','40001580',400,5720,400,'출고준비완료',[{at:'2026-06-14 10:00',who:'영업2팀',txt:'확정'},{at:'2026-06-19 08:40',who:'품질팀',txt:'검수완료 → 출고준비완료'}]),
    O('SO-260618-04','영업2팀','2026-06-30','썬푸드','40001580',300,5500,0,'미확정',[{at:'2026-06-18 10:40',who:'영업2팀',txt:'생성 (미확정)'}]),
    O('SO-260616-06','해외영업팀','2026-07-05','글로벌커피(US)','40001503',800,9200,800,'출고준비완료',[{at:'2026-06-16 11:00',who:'해외영업팀',txt:'확정'},{at:'2026-06-19 08:00',who:'품질팀',txt:'검수완료 → 출고준비완료'}]),
    O('SO-260617-08','해외영업팀','2026-07-10','아시아마트(SG)','40005002',300,28000,0,'미확정',[{at:'2026-06-17 14:00',who:'해외영업팀',txt:'생성 (미확정)'}]),
  ];
  const shipOrders=[
    {id:'SH-260619-02',orderId:'SO-260610-01',team:'영업1팀',partner:'코너스톤랩스',item:'40001580',price:5720,
      lines:[{addr:'코너스톤랩스 본사',qty:400,paidSample:0,freeSample:5,memo:'본사 + 샘플5'},{addr:'코너스톤랩스 물류센터',qty:195,paidSample:0,freeSample:0,memo:'분할'}],
      paidQty:595,freeQty:5,amount:595*5720,date:'2026-06-19',status:'지시',log:[{at:'2026-06-19 09:20',who:'영업1팀',txt:'1차 출고지시 (배송지 2곳, 유상 595 + 무상샘플 5)'}]},
    {id:'SH-260616-01',orderId:'SO-260605-03',team:'영업1팀',partner:'할리스',item:'40005002',price:27500,
      lines:[{addr:'할리스 음성공장',qty:200,paidSample:0,freeSample:0,memo:''}],
      paidQty:200,freeQty:0,amount:200*27500,date:'2026-06-16',status:'출고완료',log:[{at:'2026-06-16 10:00',who:'영업1팀',txt:'출고지시 (유상 200)'},{at:'2026-06-16 15:30',who:'물류팀',txt:'실출고 완료'}]},
  ];
  DB={orders,shipOrders,sales}; seq=100; save();
}

/* ---------- KPI ---------- */
function salesOf(team){ return team==='전체'?DB.sales:DB.sales.filter(s=>s.team===team); }
function sumIf(team,pred){ return salesOf(team).filter(pred).reduce((a,s)=>a+s.amount,0); }
function kpiToday(team){ return sumIf(team,s=>s.date===fmt(TODAY)); }
function kpiMonth(team){ const ym=fmt(TODAY).slice(0,7); return sumIf(team,s=>s.date.slice(0,7)===ym); }
function kpiYear(team,y){ return sumIf(team,s=>s.date.slice(0,4)==String(y)); }
function kpiYTD(team,y,maxMonth){ return sumIf(team,s=>s.date.slice(0,4)==String(y)&&Number(s.date.slice(5,7))<=maxMonth); }
function monthlyPair(team){ // Jan~Jun 2025 vs 2026
  const a=[],b=[];
  for(let m=1;m<=6;m++){ const mm=String(m).padStart(2,'0');
    a.push(sumIf(team,s=>s.date.slice(0,7)===`2025-${mm}`));
    b.push(sumIf(team,s=>s.date.slice(0,7)===`2026-${mm}`)); }
  return {labels:['1월','2월','3월','4월','5월','6월'],y2025:a,y2026:b};
}
function topBy(team,key){ // key='partner'|'item', 2026 누적
  const m={}; salesOf(team).filter(s=>s.date.slice(0,4)==='2026').forEach(s=>{ const k=s[key]; m[k]=(m[k]||0)+s.amount; });
  return Object.entries(m).map(([k,v])=>({name:key==='item'?(PRODUCTS[k]?PRODUCTS[k].name:k):k,amt:v})).sort((a,b)=>b.amt-a.amt).slice(0,5);
}

/* ---------- 단가 추천 ---------- */
function suggestPrice(partner,item){
  const past=[...DB.orders].reverse().find(o=>o.partner===partner&&o.item===item&&o.price>0);
  if(past) return {price:past.price,src:'최근가('+past.id+')'};
  if(PRICEBOOK[partner]&&PRICEBOOK[partner][item]) return {price:PRICEBOOK[partner][item],src:'거래처 계약가'};
  if(PRICE[item]) return {price:PRICE[item],src:'제품 기본가'};
  return {price:0,src:'미정'};
}

/* ---------- 수주/출고지시 mutation ---------- */
function teamSummary(team){
  const os=DB.orders.filter(o=>team==='전체'||o.team===team); const c=s=>os.filter(o=>o.status===s).length;
  return {total:os.length,미확정:c('미확정'),확정:c('확정'),생산완료:c('생산완료'),출고준비완료:c('출고준비완료'),부분출고:c('부분출고'),출고:os.filter(o=>['출고지시','출고완료','부분출고'].includes(o.status)).length};
}
function addOrder(team,partner,item,qty,due,price){
  const n=String(DB.orders.length+1).padStart(2,'0'); const p=Number(price)||0;
  const o={id:'SO-'+yymmdd(TODAY)+'-'+n,team,date:fmt(TODAY),due,partner,item,qty:Number(qty),price:p,producedQty:0,status:'미확정',
    log:[{at:fmt(TODAY)+' '+nowt(),who:team,txt:'생성 (미확정'+(p?', 단가 '+won(p):', 단가 미정')+')'}]};
  DB.orders.push(o); save(); return o;
}
function confirmOrder(id){ const o=DB.orders.find(x=>x.id===id); if(!o||o.status!=='미확정')return false;
  o.status='확정'; o.log.push({at:fmt(TODAY)+' '+nowt(),who:o.team,txt:'확정 (생산계획 공유 — 이후 수정은 생산팀 협의 필요)'}); save(); return true; }
function editOrder(id,nq,nd,ns,np,reason){ const o=DB.orders.find(x=>x.id===id); if(!o)return false; np=Number(np)||0;
  const ch=[]; if(nq!==o.qty)ch.push(`수량 ${won(o.qty)}→${won(nq)}`); if(nd!==o.due)ch.push(`납기 ${o.due}→${nd}`);
  if(ns!==o.status)ch.push(`상태 ${o.status}→${ns}`); if(np!==o.price)ch.push(`단가 ${won(o.price)}→${won(np)}`);
  if(!ch.length)return false; o.qty=nq;o.due=nd;o.status=ns;o.price=np;
  o.log.push({at:fmt(TODAY)+' '+nowt(),who:'관리자',txt:'수정: '+ch.join(', ')+(reason?' ('+reason+')':'')}); save(); return true; }
// 출고 줄(line) = 배송지 1곳: {addr, qty(출고수량·유상정상), paidSample(유상샘플·택배별도), freeSample(무상샘플), memo}
function sumField(ls,f){ return (ls||[]).reduce((a,l)=>a+(Number(l[f])||0),0); }
function lineTotalQ(l){ return (Number(l.qty)||0)+(Number(l.paidSample)||0)+(Number(l.freeSample)||0); }
function soTotal(s){ return (s.lines||[]).reduce((a,l)=>a+lineTotalQ(l),0); }
function soPaid(s){ return sumField(s.lines,'qty')+sumField(s.lines,'paidSample'); }   // 매출 대상(유상+유상샘플)
function soFree(s){ return sumField(s.lines,'freeSample'); }                            // 무상샘플
// 출고 누계/잔여 (분할출고)
function shippedOf(orderId){ return DB.shipOrders.filter(s=>s.orderId===orderId).reduce((a,s)=>a+soTotal(s),0); }
function remainingOf(o){ return (o.producedQty||0) - shippedOf(o.id); }
function addShipOrder(orderId,lines,price,date){
  const o=DB.orders.find(x=>x.id===orderId); if(!o)return null;
  if(o.status!=='출고준비완료'&&o.status!=='부분출고')return null;
  lines=(lines||[]).map(l=>({addr:l.addr||'',qty:Number(l.qty)||0,paidSample:Number(l.paidSample)||0,freeSample:Number(l.freeSample)||0,memo:l.memo||''})).filter(l=>lineTotalQ(l)>0);
  if(!lines.length)return null;
  const p=Number(price)||0;
  const paid=lines.reduce((a,l)=>a+l.qty+l.paidSample,0);   // 유상 + 유상샘플 = 매출 대상
  const free=lines.reduce((a,l)=>a+l.freeSample,0);          // 무상샘플
  const amount=paid*p;
  const n=String(DB.shipOrders.length+1).padStart(2,'0');
  const so={id:'SH-'+yymmdd(TODAY)+'-'+n,orderId,team:o.team,partner:o.partner,item:o.item,price:p,lines,
    paidQty:paid,freeQty:free,amount,date:date||fmt(TODAY),status:'지시',
    log:[{at:fmt(TODAY)+' '+nowt(),who:o.team,txt:`출고지시 (배송지 ${lines.length}곳 · 유상 ${won(paid)} + 무상샘플 ${won(free)})`}]};
  DB.shipOrders.push(so);
  if(paid>0) DB.sales.push({date:fmt(TODAY),team:o.team,partner:o.partner,item:o.item,amount,ref:so.id}); // 유상(유상샘플 포함) 매출 연결
  if(p&&p!==o.price){ o.log.push({at:fmt(TODAY)+' '+nowt(),who:o.team,txt:`단가 확정 ${won(o.price)}→${won(p)}`}); o.price=p; }
  const rem=remainingOf(o);
  o.status = rem<=0 ? '출고지시' : '부분출고';
  o.log.push({at:fmt(TODAY)+' '+nowt(),who:o.team,txt:`${so.id} 생성 (출고누계 ${won(shippedOf(o.id))}/${won(o.producedQty)}, 잔여 ${won(Math.max(0,rem))})`});
  save(); return so;
}

load();
