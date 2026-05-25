/* ============================================================
   AdVision AI — studio.js  (v6 — 3D AI Presenter)
   Full-body animated character + 3D orbiting products
   ============================================================ */
'use strict';

/* ── Utilities ──────────────────────────────────────────────── */
const Studio = { images:[], currentStep:1, isGenerating:false, generatedVideoUrl:null, mode:'standard', gender:'female' };
const tick    = () => new Promise(r => setTimeout(r, 20));
const clamp   = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp    = (a,b,t) => a+(b-a)*t;
const ease    = t => t<.5 ? 2*t*t : -1+(4-2*t)*t;
const easeOut = t => 1-Math.pow(1-t,3);
const PI      = Math.PI;
function hexRGB(hex){ const h=hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgba(r,g,b,a){ return `rgba(${r},${g},${b},${a})`; }
function lp(a,b,t){ return {dx:lerp(a.dx,b.dx,t), dy:lerp(a.dy,b.dy,t)}; }

/* colour manipulation */
function adjustHex(hex,amt){
  const {r,g,b}=hexRGB(hex);
  const c=v=>Math.min(255,Math.max(0,Math.round(v+amt*255)));
  return `#${[c(r),c(g),c(b)].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}
const lightenHex=(h,a)=>adjustHex(h,a);
const darkenHex =(h,a)=>adjustHex(h,-a);

/* ── Palettes ────────────────────────────────────────────────── */
const PAL = {
  female:{
    skin:'#f0c8a0',skinHl:'#fde0c0',skinSh:'#c89070',
    lip:'#d06070',lipSh:'#a04050',
    iris:'#5d4030',pupil:'#0a0500',
    hair:'#1a0a00',hairHl:'#4a2010',
    suit1:'#2d1a4a',suit2:'#1a0f2e',shirt:'#fff',
    tie:'#c090e0',accent:'#c0a0e0'
  },
  male:{
    skin:'#e8b890',skinHl:'#f8d0a8',skinSh:'#b88860',
    lip:'#c07060',lipSh:'#904040',
    iris:'#4d3020',pupil:'#050200',
    hair:'#0a0500',hairHl:'#201000',
    suit1:'#1a2540',suit2:'#0f1525',shirt:'#fff',
    tie:'#8090c0',accent:'#9090e0'
  }
};

/* ── Arm gesture poses (offsets from shoulder, normalized to charH) ── */
const POSES = {
  welcome:  { lE:{dx:-0.17,dy:-0.01}, lH:{dx:-0.24,dy:-0.20}, rE:{dx:0.17,dy:-0.01}, rH:{dx:0.24,dy:-0.20} },
  pointR:   { lE:{dx:-0.07,dy: 0.09}, lH:{dx:-0.05,dy: 0.17}, rE:{dx:0.19,dy:-0.04}, rH:{dx:0.37,dy:-0.09} },
  present:  { lE:{dx:-0.11,dy: 0.11}, lH:{dx:-0.18,dy: 0.02}, rE:{dx:0.11,dy: 0.11}, rH:{dx:0.18,dy: 0.02} },
  emphasize:{ lE:{dx:-0.07,dy: 0.07}, lH:{dx:-0.05,dy: 0.14}, rE:{dx:0.04,dy:-0.20}, rH:{dx:0.06,dy:-0.40} }
};
const SEQ=['welcome','pointR','present','emphasize'];
const POSE_MS=3800;

function getPose(elapsed){
  const t=(elapsed%(SEQ.length*POSE_MS));
  const idx=Math.floor(t/POSE_MS), nxt=(idx+1)%SEQ.length;
  const pt=(t-idx*POSE_MS)/POSE_MS;
  const st=ease(Math.min(pt*2.5,1));
  const C=POSES[SEQ[idx]], N=POSES[SEQ[nxt]];
  return { lE:lp(C.lE,N.lE,st), lH:lp(C.lH,N.lH,st), rE:lp(C.rE,N.rE,st), rH:lp(C.rH,N.rH,st), name:SEQ[idx], t:pt };
}

/* ═══════════════════════════════════════════════════════════════
   3D PRESENTER FRAME DRAW
   ═══════════════════════════════════════════════════════════════ */
function draw3DPresenterFrame(ctx, W, H, imgs, cfg, state) {
  const { frame:fr, mouthOpen:mO, blinkT, bobPhase, captionShow, elapsed, totalMs } = state;
  const { name:prodName, color } = cfg;
  const rgb  = hexRGB(color);
  const tG   = clamp(elapsed/Math.max(totalMs,1),0,1);
  const pal  = PAL[Studio.gender] || PAL.female;
  const pose = getPose(elapsed);

  // Character geometry
  const charX    = W * 0.5;
  const charBtm  = H * 0.91;
  const charH    = H * 0.80;
  const bob      = Math.sin(bobPhase) * 3.5;

  /* ── 1. BACKGROUND ── */
  const bgG=ctx.createLinearGradient(0,0,0,H);
  bgG.addColorStop(0,'#03030c'); bgG.addColorStop(0.6,'#060610'); bgG.addColorStop(1,'#0b0b18');
  ctx.fillStyle=bgG; ctx.fillRect(0,0,W,H);

  // Subtle grid
  ctx.save(); ctx.globalAlpha=0.035; ctx.strokeStyle=color; ctx.lineWidth=1;
  for(let x=0;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.restore();

  // Atmospheric glow from center
  const atm=ctx.createRadialGradient(charX,H*0.45,H*0.05,charX,H*0.45,H*0.75);
  atm.addColorStop(0,rgba(rgb.r,rgb.g,rgb.b,0.10)); atm.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=atm; ctx.fillRect(0,0,W,H);

  /* ── 2. STUDIO FLOOR ── */
  const floorY = charBtm + charH*0.025;
  ctx.save();
  ctx.beginPath(); ctx.rect(0,floorY,W,H-floorY); ctx.clip();
  // Floor surface
  const flG=ctx.createLinearGradient(0,floorY,0,H);
  flG.addColorStop(0,rgba(rgb.r,rgb.g,rgb.b,0.08));
  flG.addColorStop(0.25,'rgba(10,10,22,0.5)');
  flG.addColorStop(1,'rgba(4,4,12,0.97)');
  ctx.fillStyle=flG; ctx.fillRect(0,floorY,W,H-floorY);
  // Perspective grid
  ctx.globalAlpha=0.10; ctx.strokeStyle=color; ctx.lineWidth=1;
  const vx=charX, vy=H*0.38;
  for(let i=-10;i<=10;i++){
    const gx=charX+i*90; ctx.beginPath(); ctx.moveTo(gx,floorY); ctx.lineTo(vx,vy); ctx.stroke();
  }
  for(let d=0;d<=8;d++){
    const ft=d/8, gy=floorY+(H-floorY)*ft, sp=1+ft*3.5;
    ctx.beginPath(); ctx.moveTo(charX-W*sp,gy); ctx.lineTo(charX+W*sp,gy); ctx.stroke();
  }
  // Character reflection glow on floor
  ctx.globalAlpha=0.45;
  const fg=ctx.createRadialGradient(charX,floorY+6,0,charX,floorY+6,charH*0.18);
  fg.addColorStop(0,rgba(rgb.r,rgb.g,rgb.b,0.70));
  fg.addColorStop(0.5,'rgba(0,0,0,0.40)');
  fg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=fg; ctx.beginPath();
  ctx.ellipse(charX,floorY+4,charH*0.17,charH*0.045,0,0,PI*2); ctx.fill();
  ctx.restore();

  /* ── 3. ORBIT SETUP ── */
  const oCX = charX;
  const oCY = charBtm - charH * 0.43;   // waist level
  const OA  = W * 0.345;                 // x-radius
  const OB  = H * 0.135;                 // y-radius (squished → 3D tilt)
  const TILT_Y = 0.09;                   // extra y tilt based on cos
  const spd = 0.00026;                   // rad/ms
  const baseAngle = elapsed * spd;

  const N = Math.max(imgs.length, 1);
  const prods = [];
  for(let i=0;i<N;i++){
    const θ = baseAngle + (i/N)*PI*2;
    const cosθ=Math.cos(θ), sinθ=Math.sin(θ);
    const px = oCX + OA*cosθ;
    const py = oCY + OB*sinθ - OA*TILT_Y*cosθ; // tilt makes products dip at sides
    const depth=(sinθ+1)/2;           // 0=back 1=front
    const sc=0.36+depth*0.64;
    const al=0.42+depth*0.58;
    prods.push({img:imgs[i%imgs.length], px, py, depth, sc, al, θ});
  }
  // Depth sort: back → front
  prods.sort((a,b)=>a.depth-b.depth);

  /* ── 4. ORBIT RING GLOW ── */
  ctx.save();
  ctx.globalAlpha=0.14; ctx.strokeStyle=color; ctx.lineWidth=3;
  ctx.setLineDash([12,18]); ctx.lineDashOffset=elapsed*0.05;
  ctx.beginPath(); ctx.ellipse(oCX,oCY,OA,OB,0,0,PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha=0.055; ctx.lineWidth=22;
  ctx.beginPath(); ctx.ellipse(oCX,oCY,OA,OB,0,0,PI*2); ctx.stroke();
  ctx.restore();

  /* ── 5. PRODUCTS BEHIND CHARACTER ── */
  prods.filter(p=>p.depth<=0.5).forEach(p=>draw3DProduct(ctx,p,cfg,W,H));

  /* ── 6. CHARACTER ── */
  draw3DCharacter(ctx, charX, charBtm, charH, pal, pose, state, bob, mO, blinkT, fr);

  /* ── 7. PRODUCTS IN FRONT ── */
  prods.filter(p=>p.depth>0.5).forEach(p=>draw3DProduct(ctx,p,cfg,W,H));

  /* ── 8. RIM LIGHT ON CHARACTER (brand color) ── */
  ctx.save();
  ctx.globalAlpha=0.10+mO*0.07;
  const rimG=ctx.createRadialGradient(charX,charBtm-charH*0.5,charH*0.12,charX,charBtm-charH*0.5,charH*0.62);
  rimG.addColorStop(0,'rgba(0,0,0,0)'); rimG.addColorStop(0.75,'rgba(0,0,0,0)');
  rimG.addColorStop(1,rgba(rgb.r,rgb.g,rgb.b,0.55));
  ctx.fillStyle=rimG; ctx.beginPath(); ctx.ellipse(charX,charBtm-charH*0.5,charH*0.55,charH*0.62,0,0,PI*2); ctx.fill();
  ctx.restore();

  /* ── 9. UI ── */
  // Top header
  const tH=Math.round(H*0.09);
  const tG2=ctx.createLinearGradient(0,0,W,0);
  tG2.addColorStop(0,color); tG2.addColorStop(0.55,rgba(rgb.r,rgb.g,rgb.b,0.42)); tG2.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=tG2; ctx.fillRect(0,0,W,tH);
  ctx.fillStyle='#fff'; ctx.font=`700 ${Math.round(H*0.043)}px Arial,sans-serif`;
  ctx.textBaseline='middle'; ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=8;
  ctx.fillText(prodName.substring(0,36),Math.round(W*0.03),tH/2); ctx.shadowBlur=0;
  const bdT='🤖 3D AI PRESENTER', bdFs=Math.round(H*0.024);
  ctx.font=`700 ${bdFs}px Arial,sans-serif`;
  const bdW=ctx.measureText(bdT).width+26,bdH2=bdFs+18;
  const bdX=W-bdW-16,bdY=(tH-bdH2)/2;
  rrect(ctx,bdX,bdY,bdW,bdH2,bdH2/2); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill();
  ctx.fillStyle='#fff'; ctx.textBaseline='middle'; ctx.fillText(bdT,bdX+13,bdY+bdH2/2);

  // Caption bar
  const capH=Math.round(H*0.155),capY=H-capH;
  ctx.fillStyle='rgba(4,4,12,0.92)'; ctx.fillRect(0,capY,W,capH);
  ctx.fillStyle=color; ctx.fillRect(0,capY,W,3.5);
  if(captionShow){
    const cFs=Math.round(H*0.031);
    ctx.font=`400 ${cFs}px Arial,sans-serif`; ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.textBaseline='top';
    const ws=captionShow.split(' '); let ln='',lns=[];
    ws.forEach(w=>{const t=ln+(ln?' ':'')+w;if(ctx.measureText(t).width>W-70&&ln){lns.push(ln);ln=w;}else ln=t;});
    if(ln)lns.push(ln); lns=lns.slice(-3);
    const lH2=cFs*1.58,blk=lns.length*lH2,ts=capY+(capH-blk)/2;
    lns.forEach((l,i)=>{ctx.fillStyle=i===lns.length-1?'#fff':'rgba(255,255,255,0.62)';ctx.fillText(l,32,ts+i*lH2);});
  }
  // Progress
  ctx.fillStyle=rgba(rgb.r,rgb.g,rgb.b,0.25); ctx.fillRect(0,H-5,W,5);
  ctx.fillStyle=color; ctx.fillRect(0,H-5,W*tG,5);
}

/* ── Draw one orbiting product card ─────────────────────────── */
function draw3DProduct(ctx,p,cfg,W,H){
  const {img,px,py,depth,sc,al}=p;
  const {color}=cfg; const rgb=hexRGB(color);
  if(!img?.naturalWidth)return;
  const cW=Math.round(195*sc), cH=Math.round(155*sc);
  const rad=Math.round(14*sc);
  ctx.save(); ctx.globalAlpha=al;
  // Glow for front products
  if(depth>0.65){
    ctx.save(); ctx.shadowColor=color; ctx.shadowBlur=Math.round(28*depth);
    rrect(ctx,px-cW/2,py-cH/2,cW,cH,rad);
    ctx.fillStyle=rgba(rgb.r,rgb.g,rgb.b,0.18); ctx.fill(); ctx.restore();
  }
  // Card bg
  rrect(ctx,px-cW/2,py-cH/2,cW,cH,rad);
  ctx.fillStyle='rgba(16,12,30,0.92)'; ctx.fill();
  // Border
  ctx.strokeStyle=depth>0.65?color:rgba(rgb.r,rgb.g,rgb.b,0.38); ctx.lineWidth=Math.ceil(2*sc); ctx.stroke();
  // Image clip
  ctx.save(); rrect(ctx,px-cW/2+3*sc,py-cH/2+3*sc,cW-6*sc,cH-6*sc,Math.round(10*sc)); ctx.clip();
  const r2=Math.max(cW/img.naturalWidth,cH/img.naturalHeight);
  ctx.drawImage(img,px-img.naturalWidth*r2/2,py-img.naturalHeight*r2/2,img.naturalWidth*r2,img.naturalHeight*r2);
  // Depth overlay (darker for back)
  ctx.fillStyle=`rgba(0,0,0,${0.35*(1-depth)})`; ctx.fillRect(px-cW/2,py-cH/2,cW,cH);
  ctx.restore();
  // Specular glint on top (3D look)
  ctx.save(); ctx.globalAlpha=0.22*depth;
  const glint=ctx.createLinearGradient(px-cW/2,py-cH/2,px,py-cH/2+cH*0.4);
  glint.addColorStop(0,'rgba(255,255,255,0.6)'); glint.addColorStop(1,'rgba(255,255,255,0)');
  rrect(ctx,px-cW/2,py-cH/2,cW,cH*0.45,rad); ctx.fillStyle=glint; ctx.fill();
  ctx.restore();
  ctx.restore();
}

/* ── Full-body 3D character ─────────────────────────────────── */
function draw3DCharacter(ctx,cx,btm,h,pal,pose,state,bob,mO,blinkT,fr){
  // Key Y positions (all from feet upward)
  const fy   = btm;
  const kneY = btm - h*0.305;
  const hipY = btm - h*0.510;
  const wstY = btm - h*0.595;
  const chtY = btm - h*0.695;
  const shdY = btm - h*0.730;
  const nkY  = btm - h*0.798;
  const hdY  = btm - h*0.875 + bob;

  // Widths
  const sW  = h*0.215; // shoulder half-width
  const cW  = h*0.175; // chest half-width
  const wW  = h*0.128; // waist half-width
  const hiW = h*0.165; // hip half-width
  const lW  = h*0.060; // leg half-width
  const nkW = h*0.038; // neck half-width
  const hdR = h*0.110; // head radius

  // Arm joint world positions
  const lSX=cx-sW*0.88, rSX=cx+sW*0.88;
  const lEX=lSX+pose.lE.dx*h, lEY=shdY+pose.lE.dy*h;
  const lHX=lSX+pose.lH.dx*h, lHY=shdY+pose.lH.dy*h;
  const rEX=rSX+pose.rE.dx*h, rEY=shdY+pose.rE.dy*h;
  const rHX=rSX+pose.rH.dx*h, rHY=shdY+pose.rH.dy*h;

  /* Draw helpers */
  function sGrad(x1,y1,x2,y2,light,mid,dark){
    const g=ctx.createLinearGradient(x1,y1,x2,y2);
    g.addColorStop(0,dark); g.addColorStop(0.22,mid); g.addColorStop(0.5,light);
    g.addColorStop(0.78,mid); g.addColorStop(1,dark); return g;
  }

  /* == SHOES == */
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=10; ctx.shadowOffsetY=3;
  const shG=ctx.createLinearGradient(0,fy-h*0.038,0,fy); shG.addColorStop(0,'#2a2a2a'); shG.addColorStop(1,'#111');
  ctx.fillStyle=shG;
  ctx.beginPath(); ctx.ellipse(cx-lW*1.35,fy-h*0.014,lW*1.7,h*0.022,-0.1,0,PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+lW*1.35,fy-h*0.014,lW*1.7,h*0.022,0.1,0,PI*2); ctx.fill();
  ctx.restore();

  /* == LOWER LEGS (calf→ankle) == */
  const llG=sGrad(cx-lW*2,0,cx+lW*2,0,lightenHex(pal.suit1,0.12),pal.suit1,pal.suit2);
  function drawLeg(side){
    const sx=side<0?-1:1;
    ctx.save(); ctx.fillStyle=llG;
    ctx.beginPath();
    ctx.moveTo(cx+sx*lW*0.55,fy); ctx.bezierCurveTo(cx+sx*lW*0.55,fy-h*0.08,cx+sx*lW*0.8,kneY+h*0.06,cx+sx*lW*0.8,kneY);
    ctx.bezierCurveTo(cx+sx*lW*0.8,kneY-h*0.02,cx+sx*lW*1.55,kneY-h*0.02,cx+sx*lW*1.55,kneY);
    ctx.bezierCurveTo(cx+sx*lW*1.55,kneY+h*0.06,cx+sx*lW*1.85,fy-h*0.08,cx+sx*lW*1.85,fy);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  drawLeg(-1); drawLeg(1);

  /* == UPPER LEGS (knee→hip) == */
  ctx.save(); ctx.fillStyle=sGrad(cx-hiW*1.1,0,cx+hiW*1.1,0,lightenHex(pal.suit1,0.10),pal.suit1,pal.suit2);
  ctx.beginPath();
  ctx.moveTo(cx-hiW,hipY); ctx.lineTo(cx-lW*1.55,kneY); ctx.lineTo(cx-lW*0.8,kneY); ctx.lineTo(cx-wW*0.32,hipY); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx+hiW,hipY); ctx.lineTo(cx+lW*1.55,kneY); ctx.lineTo(cx+lW*0.8,kneY); ctx.lineTo(cx+wW*0.32,hipY); ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* == HIP/LOWER TORSO == */
  ctx.save(); ctx.fillStyle=sGrad(cx-hiW*1.1,0,cx+hiW*1.1,0,lightenHex(pal.suit1,0.14),pal.suit1,pal.suit2);
  ctx.beginPath(); ctx.ellipse(cx,hipY,hiW,h*0.052,0,0,PI*2); ctx.fill();
  ctx.restore();

  /* == MAIN TORSO (hip→shoulder) == */
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=16; ctx.shadowOffsetX=-4;
  const torG=sGrad(cx-sW*1.1,0,cx+sW*1.1,0,lightenHex(pal.suit1,0.16),pal.suit1,pal.suit2);
  ctx.fillStyle=torG;
  ctx.beginPath();
  ctx.moveTo(cx-hiW,hipY); ctx.lineTo(cx-wW,wstY); ctx.lineTo(cx-cW,chtY); ctx.lineTo(cx-sW,shdY);
  ctx.lineTo(cx+sW,shdY); ctx.lineTo(cx+cW,chtY); ctx.lineTo(cx+wW,wstY); ctx.lineTo(cx+hiW,hipY);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  /* == BELT == */
  ctx.save(); ctx.strokeStyle=lightenHex(pal.suit1,0.09); ctx.lineWidth=h*0.019;
  ctx.beginPath(); ctx.moveTo(cx-wW-2,wstY+h*0.028); ctx.lineTo(cx+wW+2,wstY+h*0.028); ctx.stroke();
  ctx.fillStyle='#aaa'; ctx.strokeStyle='#888'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.rect(cx-h*0.020,wstY+h*0.020,h*0.040,h*0.030); ctx.fill(); ctx.stroke();
  ctx.restore();

  /* == SHIRT V and LAPELS == */
  ctx.save(); ctx.fillStyle=pal.shirt;
  ctx.beginPath(); ctx.moveTo(cx-nkW*1.9,shdY+h*0.025); ctx.lineTo(cx-nkW*0.65,wstY-h*0.07); ctx.lineTo(cx,chtY+h*0.02); ctx.lineTo(cx+nkW*0.65,wstY-h*0.07); ctx.lineTo(cx+nkW*1.9,shdY+h*0.025); ctx.closePath(); ctx.fill();
  ctx.fillStyle=pal.suit1;
  ctx.beginPath(); ctx.moveTo(cx-nkW*1.9,shdY+h*0.025); ctx.lineTo(cx-nkW*0.65,wstY-h*0.07); ctx.lineTo(cx-cW+h*0.015,chtY+h*0.06); ctx.lineTo(cx-cW+h*0.025,shdY+h*0.04); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+nkW*1.9,shdY+h*0.025); ctx.lineTo(cx+nkW*0.65,wstY-h*0.07); ctx.lineTo(cx+cW-h*0.015,chtY+h*0.06); ctx.lineTo(cx+cW-h*0.025,shdY+h*0.04); ctx.closePath(); ctx.fill();
  // Tie/scarf
  ctx.fillStyle=pal.tie; ctx.globalAlpha=0.85;
  ctx.beginPath(); ctx.moveTo(cx-nkW*0.6,shdY+h*0.04); ctx.lineTo(cx+nkW*0.6,shdY+h*0.04); ctx.lineTo(cx+nkW*0.22,wstY-h*0.08); ctx.lineTo(cx,chtY+h*0.05); ctx.lineTo(cx-nkW*0.22,wstY-h*0.08); ctx.closePath(); ctx.fill();
  ctx.restore();

  /* == BACK ARM (right arm is typically further back when pointing) == */
  drawArm3D(ctx,lSX,shdY,lEX,lEY,lHX,lHY,h,pal,'left',mO);

  /* == SHOULDER CAPS == */
  ctx.save();
  function shdCap(sx,col){
    const g=ctx.createRadialGradient(cx+sx*sW*0.82,shdY,0,cx+sx*sW*0.82,shdY,h*0.09);
    g.addColorStop(0,lightenHex(col,0.20)); g.addColorStop(1,col);
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx+sx*sW*0.82,shdY+h*0.012,h*0.08,h*0.045,sx*0.22,0,PI*2); ctx.fill();
  }
  shdCap(-1,pal.suit1); shdCap(1,pal.suit1);
  ctx.restore();

  /* == FRONT ARM == */
  drawArm3D(ctx,rSX,shdY,rEX,rEY,rHX,rHY,h,pal,'right',mO);

  /* == NECK == */
  ctx.save();
  const nkG=ctx.createLinearGradient(cx-nkW,0,cx+nkW,0);
  nkG.addColorStop(0,pal.skinSh); nkG.addColorStop(0.35,pal.skin); nkG.addColorStop(0.6,pal.skinHl); nkG.addColorStop(1,pal.skinSh);
  ctx.fillStyle=nkG;
  ctx.beginPath(); ctx.moveTo(cx-nkW,nkY+h*0.01);
  ctx.bezierCurveTo(cx-nkW,nkY-h*0.035,cx-nkW*0.78,hdY+hdR*0.72,cx-nkW*0.75,hdY+hdR*0.75);
  ctx.lineTo(cx+nkW*0.75,hdY+hdR*0.75);
  ctx.bezierCurveTo(cx+nkW*0.78,hdY+hdR*0.72,cx+nkW,nkY-h*0.035,cx+nkW,nkY+h*0.01);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  /* == HEAD == */
  ctx.save(); ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=18; ctx.shadowOffsetY=6;
  const hdG=ctx.createRadialGradient(cx-hdR*0.22,hdY-hdR*0.28,hdR*0.04,cx,hdY,hdR*1.08);
  hdG.addColorStop(0,pal.skinHl); hdG.addColorStop(0.5,pal.skin); hdG.addColorStop(0.88,pal.skin); hdG.addColorStop(1,pal.skinSh);
  ctx.fillStyle=hdG; ctx.beginPath(); ctx.ellipse(cx,hdY,hdR*0.88,hdR,0,0,PI*2); ctx.fill(); ctx.restore();

  /* Ears */
  function ear(sx){
    ctx.save(); ctx.fillStyle=pal.skin;
    ctx.beginPath(); ctx.ellipse(cx+sx*hdR*0.84,hdY+hdR*0.08,hdR*0.13,hdR*0.20,sx*0.1,0,PI*2); ctx.fill();
    ctx.strokeStyle=pal.skinSh; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx+sx*hdR*0.84,hdY+hdR*0.08,hdR*0.065,hdR*0.12,sx*0.1,0,PI*2);
    ctx.fillStyle=pal.skinSh; ctx.fill(); ctx.restore();
  }
  ear(-1); ear(1);

  /* Hair */
  drawHair3D(ctx, cx, hdY, hdR, pal);

  /* == FACE FEATURES == */
  const eY=hdY-hdR*0.12, eLX=cx-hdR*0.30, eRX=cx+hdR*0.30;
  const eW=hdR*0.200, eH=hdR*0.132*(1-blinkT);

  // Eye makeup shadow (female)
  if(Studio.gender==='female'){
    ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#7060a0';
    ctx.beginPath(); ctx.ellipse(eLX,eY-eH*0.4,eW*1.12,eH*2.0,0,0,PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(eRX,eY-eH*0.4,eW*1.12,eH*2.0,0,0,PI*2); ctx.fill();
    ctx.restore();
  }
  // Whites
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.ellipse(eLX,eY,eW,Math.max(eH,blinkT>0.5?1.2:2),0,0,PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(eRX,eY,eW,Math.max(eH,blinkT>0.5?1.2:2),0,0,PI*2); ctx.fill();
  if(eH>2){
    const px2=Math.sin((fr||0)*0.022)*eW*0.18;
    ctx.fillStyle=pal.iris;
    ctx.beginPath(); ctx.ellipse(eLX+px2,eY,eW*0.62,eH*0.84,0,0,PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(eRX+px2,eY,eW*0.62,eH*0.84,0,0,PI*2); ctx.fill();
    ctx.fillStyle=pal.pupil;
    ctx.beginPath(); ctx.ellipse(eLX+px2,eY,eW*0.30,eH*0.52,0,0,PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(eRX+px2,eY,eW*0.30,eH*0.52,0,0,PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.78)';
    ctx.beginPath(); ctx.arc(eLX+px2-eW*0.1,eY-eH*0.16,eW*0.10,0,PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eRX+px2-eW*0.1,eY-eH*0.16,eW*0.10,0,PI*2); ctx.fill();
  }
  // Eyelashes
  ctx.save(); ctx.strokeStyle='#0a0500'; ctx.lineWidth=hdR*0.018; ctx.lineCap='round';
  for(let i=-3;i<=3;i++){
    const ex=eLX+i*eW*0.3; ctx.beginPath(); ctx.moveTo(ex,eY-eH); ctx.lineTo(ex-i*hdR*0.008,eY-eH-hdR*0.048); ctx.stroke();
    const ex2=eRX+i*eW*0.3; ctx.beginPath(); ctx.moveTo(ex2,eY-eH); ctx.lineTo(ex2-i*hdR*0.008,eY-eH-hdR*0.048); ctx.stroke();
  }
  ctx.restore();
  // Eyebrows
  const brY=eY-hdR*0.18, brRaise=mO*5.5;
  ctx.save(); ctx.strokeStyle=pal.hair; ctx.lineWidth=hdR*0.05; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(eLX-eW*0.92,brY+hdR*0.04-brRaise); ctx.quadraticCurveTo(eLX,brY-brRaise,eLX+eW*0.92,brY-hdR*0.02-brRaise); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(eRX-eW*0.92,brY-hdR*0.02-brRaise); ctx.quadraticCurveTo(eRX,brY-brRaise,eRX+eW*0.92,brY+hdR*0.04-brRaise); ctx.stroke();
  ctx.restore();
  // Nose
  ctx.save(); ctx.strokeStyle=`rgba(140,80,42,0.48)`; ctx.lineWidth=hdR*0.026; ctx.lineCap='round';
  const nY2=hdY+hdR*0.17;
  ctx.beginPath(); ctx.moveTo(cx-hdR*0.05,nY2-hdR*0.13); ctx.lineTo(cx-hdR*0.13,nY2+hdR*0.18); ctx.quadraticCurveTo(cx-hdR*0.06,nY2+hdR*0.26,cx,nY2+hdR*0.30); ctx.quadraticCurveTo(cx+hdR*0.06,nY2+hdR*0.26,cx+hdR*0.13,nY2+hdR*0.18); ctx.lineTo(cx+hdR*0.05,nY2-hdR*0.13); ctx.stroke();
  ctx.restore();
  // Mouth
  const mY2=hdY+hdR*0.54, mW2=hdR*0.40, oH=mO*hdR*0.24;
  ctx.save();
  if(oH>3){
    ctx.fillStyle='#180508'; ctx.beginPath(); ctx.ellipse(cx,mY2,mW2,oH,0,0,PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(cx,mY2-oH*0.1,mW2*0.78,oH*0.38,0,0,PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx,mY2+oH*0.16,mW2*0.65,oH*0.28,0,PI,0); ctx.fill();
    ctx.strokeStyle=pal.lipSh; ctx.lineWidth=hdR*0.025; ctx.beginPath(); ctx.ellipse(cx,mY2,mW2,oH,0,0,PI*2); ctx.stroke();
  } else {
    ctx.strokeStyle=pal.lip; ctx.lineWidth=hdR*0.030; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx-mW2,mY2); ctx.quadraticCurveTo(cx,mY2+hdR*0.076,cx+mW2,mY2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-mW2,mY2); ctx.quadraticCurveTo(cx-mW2*0.5,mY2-hdR*0.045,cx,mY2-hdR*0.01); ctx.quadraticCurveTo(cx+mW2*0.5,mY2-hdR*0.045,cx+mW2,mY2); ctx.stroke();
  }
  // Lip fill
  ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=pal.lip;
  ctx.beginPath(); ctx.ellipse(cx,mY2,mW2,hdR*0.065,0,0,PI*2); ctx.fill();
  ctx.restore(); ctx.restore();
  // Cheeks (female)
  if(Studio.gender==='female'){
    ctx.save(); ctx.globalAlpha=0.12; ctx.fillStyle='#e06070';
    ctx.beginPath(); ctx.ellipse(cx-hdR*0.5,mY2-hdR*0.18,hdR*0.22,hdR*0.14,0,0,PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+hdR*0.5,mY2-hdR*0.18,hdR*0.22,hdR*0.14,0,0,PI*2); ctx.fill();
    ctx.restore();
  }
}

/* ── Hair ───────────────────────────────────────────────────── */
function drawHair3D(ctx, hx, hy, hr, pal){
  ctx.save();
  const hG=ctx.createLinearGradient(hx,hy-hr*1.12,hx,hy+hr*0.35);
  hG.addColorStop(0,pal.hairHl); hG.addColorStop(0.45,pal.hair); hG.addColorStop(1,pal.hair);
  ctx.fillStyle=hG;
  if(Studio.gender==='female'){
    // Top
    ctx.beginPath(); ctx.arc(hx,hy,hr,PI*1.05,PI*1.95); ctx.lineTo(hx+hr*0.94,hy-hr*0.06); ctx.arc(hx,hy-hr*0.04,hr,0,PI,true); ctx.closePath(); ctx.fill();
    // Left side flowing
    ctx.beginPath(); ctx.moveTo(hx-hr*0.92,hy+hr*0.08);
    ctx.bezierCurveTo(hx-hr*1.14,hy+hr*0.55,hx-hr*1.08,hy+hr*1.35,hx-hr*0.65,hy+hr*1.48);
    ctx.bezierCurveTo(hx-hr*0.42,hy+hr*1.50,hx-hr*0.32,hy+hr*0.55,hx-hr*0.82,hy+hr*0.08); ctx.closePath(); ctx.fill();
    // Right side flowing
    ctx.beginPath(); ctx.moveTo(hx+hr*0.92,hy+hr*0.08);
    ctx.bezierCurveTo(hx+hr*1.14,hy+hr*0.55,hx+hr*1.08,hy+hr*1.35,hx+hr*0.65,hy+hr*1.48);
    ctx.bezierCurveTo(hx+hr*0.42,hy+hr*1.50,hx+hr*0.32,hy+hr*0.55,hx+hr*0.82,hy+hr*0.08); ctx.closePath(); ctx.fill();
    // Highlight
    ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle=pal.hairHl;
    ctx.beginPath(); ctx.ellipse(hx-hr*0.12,hy-hr*0.68,hr*0.20,hr*0.38,-0.22,0,PI*2); ctx.fill();
    ctx.restore();
  } else {
    // Short professional male hair
    ctx.beginPath(); ctx.arc(hx,hy,hr,PI*1.08,PI*1.92); ctx.lineTo(hx+hr*0.92,hy+hr*0.06); ctx.arc(hx,hy-hr*0.01,hr,0,PI,true); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=pal.hairHl;
    ctx.beginPath(); ctx.ellipse(hx-hr*0.08,hy-hr*0.62,hr*0.16,hr*0.28,-0.18,0,PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* ── Arm segment (shoulder→elbow→hand) ─────────────────────── */
function drawArm3D(ctx,shX,shY,elbX,elbY,hndX,hndY,h,pal,side,mO){
  const aW=h*0.048, fW=h*0.040;
  ctx.save();

  // Upper arm
  function makeTubeGrad(x1,y1,x2,y2,col,wid){
    const dx=y1-y2, dy=x2-x1, len=Math.sqrt(dx*dx+dy*dy)||1;
    const nx=dx/len*wid, ny=dy/len*wid;
    const g=ctx.createLinearGradient(x1-nx,y1-ny,x1+nx,y1+ny);
    g.addColorStop(0,darkenHex(col,0.28)); g.addColorStop(0.3,col);
    g.addColorStop(0.55,lightenHex(col,0.16)); g.addColorStop(1,darkenHex(col,0.22)); return g;
  }
  ctx.strokeStyle=makeTubeGrad(shX,shY,elbX,elbY,pal.suit1,aW);
  ctx.lineWidth=aW*2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(shX,shY); ctx.lineTo(elbX,elbY); ctx.stroke();

  // Elbow joint
  const elG=ctx.createRadialGradient(elbX,elbY,0,elbX,elbY,aW*1.1);
  elG.addColorStop(0,lightenHex(pal.suit1,0.14)); elG.addColorStop(1,pal.suit1);
  ctx.fillStyle=elG; ctx.beginPath(); ctx.arc(elbX,elbY,aW*1.0,0,PI*2); ctx.fill();

  // Forearm (suit sleeve fades to skin at wrist)
  const fgStart=makeTubeGrad(elbX,elbY,hndX,hndY,pal.suit1,fW);
  ctx.strokeStyle=fgStart; ctx.lineWidth=fW*2;
  ctx.beginPath(); ctx.moveTo(elbX,elbY); ctx.lineTo(hndX,hndY); ctx.stroke();

  // Wrist skin
  const wG=makeTubeGrad(elbX,elbY,hndX,hndY,pal.skin,fW*0.88);
  ctx.strokeStyle=wG; ctx.lineWidth=fW*1.6; ctx.lineCap='round';
  const wx=lerp(elbX,hndX,0.82), wy=lerp(elbY,hndY,0.82);
  ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(hndX,hndY); ctx.stroke();

  // Hand
  drawHand3D(ctx,hndX,hndY,h,pal,side,mO);
  ctx.restore();
}

/* ── Expressive hand with fingers ───────────────────────────── */
function drawHand3D(ctx,hx,hy,h,pal,side,mO){
  const hs=h*0.048;
  ctx.save();
  const hG=ctx.createRadialGradient(hx-hs*0.15,hy-hs*0.15,0,hx,hy,hs);
  hG.addColorStop(0,pal.skinHl); hG.addColorStop(0.5,pal.skin); hG.addColorStop(1,pal.skinSh);
  ctx.fillStyle=hG;
  // Palm
  ctx.beginPath(); ctx.ellipse(hx,hy,hs*0.68,hs*0.55,0,0,PI*2); ctx.fill();
  // 4 fingers
  const sx=side==='right'?1:-1;
  for(let f=0;f<4;f++){
    const ang=-PI*0.5 + (f-1.5)*0.28*sx;
    const fl=hs*(0.55+f*0.02-Math.abs(f-1.5)*0.04);
    const fx=hx+Math.cos(ang)*hs*0.5; const fy2=hy+Math.sin(ang)*hs*0.5;
    ctx.beginPath(); ctx.ellipse(fx+Math.cos(ang)*fl*0.5,fy2+Math.sin(ang)*fl*0.5,hs*0.14,fl*0.55,ang,0,PI*2); ctx.fill();
  }
  // Thumb
  const tAng=side==='right'?0.5:2.65;
  ctx.beginPath(); ctx.ellipse(hx+Math.cos(tAng)*hs*0.52,hy+Math.sin(tAng)*hs*0.36,hs*0.16,hs*0.32,tAng+0.5,0,PI*2); ctx.fill();
  ctx.restore();
}

/* ── rrect path ─────────────────────────────────────────────── */
function rrect(ctx,x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

/* ══════════════════════════════════════════════════════════════
   STANDARD AD VIDEO GENERATOR (unchanged)
   ══════════════════════════════════════════════════════════════ */
function drawStdFrame(ctx,W,H,imgs,cfg,ms){
  const {name,tag,color,anim,tone,totalMs}=cfg;
  const tG=clamp(ms/totalMs,0,1); const rgb=hexRGB(color);
  const ci=Math.min(Math.floor(ms/(totalMs/imgs.length)),imgs.length-1);
  const tC=clamp((ms-ci*(totalMs/imgs.length))/(totalMs/imgs.length),0,1);
  const fade=tC>0.78?(tC-0.78)/0.22:0;
  function cov(img,t,a){
    if(!img?.naturalWidth)return; ctx.save(); ctx.globalAlpha=clamp(a,0,1); ctx.translate(W/2,H/2);
    if(anim==='zoom'){const s=1+ease(t)*0.15;ctx.scale(s,s);ctx.translate(-ease(t)*W*0.03,-ease(t)*H*0.03);}
    if(anim==='slide'){ctx.scale(1.1,1.1);ctx.translate(-ease(t)*W*0.07,0);}
    if(anim==='fade'){ctx.scale(1+ease(t)*0.06,1+ease(t)*0.06);}
    if(anim==='pulse'){const s=1+Math.sin(t*PI*4)*0.025;ctx.scale(s,s);}
    ctx.translate(-W/2,-H/2); const r=Math.max(W/img.naturalWidth,H/img.naturalHeight);
    ctx.drawImage(img,(W-img.naturalWidth*r)/2,(H-img.naturalHeight*r)/2,img.naturalWidth*r,img.naturalHeight*r); ctx.restore();
  }
  ctx.fillStyle='#111'; ctx.fillRect(0,0,W,H);
  cov(imgs[ci],tC,1); if(fade>0&&ci+1<imgs.length)cov(imgs[ci+1],0,ease(fade));
  const v=ctx.createRadialGradient(W/2,H*0.45,H*0.1,W/2,H*0.5,H*0.8);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,0.55)'); ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,H*0.5,0,H*0.94); bg.addColorStop(0,'rgba(0,0,0,0)'); bg.addColorStop(1,'rgba(0,0,0,0.88)'); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const bH=Math.round(H*0.058); ctx.fillStyle=color; ctx.fillRect(0,H-bH,W,bH); ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(0,H-bH,W,2);
  ctx.fillStyle=rgba(rgb.r,rgb.g,rgb.b,0.3); ctx.fillRect(0,0,W,5); ctx.fillStyle=color; ctx.fillRect(0,0,W*tG,5);
  const tA=clamp(ease(clamp(tG*imgs.length*2,0,1)),0,1), slY=(1-ease(clamp(tG*imgs.length*3,0,1)))*30;
  ctx.save(); ctx.globalAlpha=tA;
  if(tag){ctx.font=`400 ${Math.round(H*0.034)}px Arial,sans-serif`;ctx.fillStyle='rgba(255,255,255,0.82)';ctx.shadowColor='rgba(0,0,0,0.95)';ctx.shadowBlur=14;ctx.textBaseline='bottom';ctx.fillText(tag.substring(0,72),Math.round(W*0.055),H-bH-Math.round(H*0.096)+slY);}
  ctx.font=`900 ${Math.round(H*0.068)}px Arial,sans-serif`; ctx.fillStyle='#fff'; ctx.shadowBlur=28; ctx.textBaseline='bottom';
  ctx.fillText(name.substring(0,40),Math.round(W*0.055),H-bH-Math.round(H*0.046)+slY); ctx.restore();
  const bmap={professional:'✨ PREMIUM',energetic:'⚡ GET YOURS',luxury:'♛ EXCLUSIVE',playful:'🎉 SALE!',minimalist:'MINIMAL'};
  const btxt=bmap[tone]||'✨ PREMIUM';
  ctx.save(); ctx.globalAlpha=ease(clamp(tG*5,0,1));
  const bfs=Math.round(H*0.026); ctx.font=`700 ${bfs}px Arial,sans-serif`;
  const bM=ctx.measureText(btxt),bpx=18,bpy=10,bW=bM.width+bpx*2,bHH=bfs+bpy*2;
  const bX=W-bW-Math.round(W*0.04),bY=Math.round(H*0.04),br=bHH/2;
  rrect(ctx,bX,bY,bW,bHH,br); ctx.fillStyle=color; ctx.fill();
  ctx.fillStyle='#fff'; ctx.textBaseline='middle'; ctx.shadowBlur=0; ctx.fillText(btxt,bX+bpx,bY+bHH/2);
  ctx.restore(); ctx.save(); ctx.globalAlpha=0.6;
  ctx.font=`600 ${Math.round(H*0.022)}px Arial,sans-serif`; ctx.fillStyle='rgba(255,255,255,0.9)';
  ctx.textBaseline='middle'; ctx.shadowBlur=0; ctx.fillText('AdVision AI',W-Math.round(W*0.16),H-bH/2); ctx.restore();
}

function getBestMime(){ const m=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4']; return m.find(t=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(t))||'video/webm'; }
function loadImg(url){ return new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=url; }); }
function showProgress(pct,msg){ const s=document.getElementById('progress-section'); if(s)s.style.display=''; const f=document.getElementById('progress-fill'),p=document.getElementById('progress-pct'),m=document.getElementById('progress-msg'); if(f)f.style.width=clamp(pct,0,100)+'%'; if(p)p.textContent=Math.round(pct)+'%'; if(m)m.textContent=msg; }
function resetGenerateBtn(){ const b=document.getElementById('generate-btn'); if(b){b.disabled=false;b.innerHTML='🎬 Generate Video';} Studio.isGenerating=false; }

async function generateStandardVideo(){
  const name=(document.getElementById('product-name')?.value||'My Product').trim();
  const tag=(document.getElementById('product-tagline')?.value||'').trim();
  const color=document.getElementById('brand-color')?.value||'#7c3aed';
  const anim=document.querySelector('.style-option input:checked')?.value||'zoom';
  const tone=document.querySelector('.tone-option input:checked')?.value||'professional';
  if(!Studio.images.length){Toast.show('Upload images first.','warning');resetGenerateBtn();return;}
  if(typeof MediaRecorder==='undefined'){Toast.show('Use Chrome for video generation.','error');resetGenerateBtn();return;}
  showProgress(5,'Loading images...'); await tick();
  const imgs=(await Promise.all(Studio.images.map(i=>loadImg(i.url)))).filter(i=>i?.naturalWidth>0);
  if(!imgs.length){Toast.show('Could not load images.','error');resetGenerateBtn();return;}
  showProgress(18,'Setting up...'); await tick();
  const W=1280,H=720; const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d'); const totalMs=imgs.length*3500;
  const cfg={name,tag,color,anim,tone,totalMs}; drawStdFrame(ctx,W,H,imgs,cfg,0);
  let stream; try{stream=canvas.captureStream(30);}catch(e){Toast.show('captureStream failed. Use Chrome.','error');resetGenerateBtn();return;}
  const mime=getBestMime(); let recorder;
  try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5_000_000});}catch(e){try{recorder=new MediaRecorder(stream);}catch(e2){Toast.show('Recorder failed.','error');resetGenerateBtn();return;}}
  const chunks=[]; recorder.ondataavailable=e=>{if(e.data?.size>0)chunks.push(e.data);};
  recorder.onstop=()=>{
    if(!chunks.length){Toast.show('No video data. Use Chrome.','error');resetGenerateBtn();return;}
    const blob=new Blob(chunks,{type:mime}); const url=URL.createObjectURL(blob);
    Studio.generatedVideoUrl=url; showProgress(100,'Done! 🎉');
    setTimeout(()=>showResult(url,mime.includes('mp4')?'mp4':'webm',mime,'',false),400);
  };
  recorder.start(500); showProgress(25,'Rendering...'); await tick();
  const st=performance.now();
  function frame(now){ const el=now-st; if(el>=totalMs){drawStdFrame(ctx,W,H,imgs,cfg,totalMs);setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},600);return;} drawStdFrame(ctx,W,H,imgs,cfg,el); const pct=25+(el/totalMs)*72; if(Math.round(el/33)%10===0)showProgress(pct,`Rendering… ${(el/1000).toFixed(1)}s`); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
}

/* ══════════════════════════════════════════════════════════════
   AI PRESENTER (3D) VIDEO GENERATOR
   ══════════════════════════════════════════════════════════════ */
function buildScript(name,tagline,desc,tone){
  const I={professional:`Hello! I'm excited to introduce you to ${name}.`,energetic:`Hey everyone! Get ready to discover the incredible ${name}!`,luxury:`Good day. Today I have the privilege of presenting the extraordinary ${name}.`,playful:`Hi there! We have something amazing — meet ${name}!`,minimalist:`${name}. Here's what you need to know.`};
  const body=(desc||'').trim()||`${name} is crafted with precision to deliver outstanding results you will love.`;
  const tLine=tagline?`As we like to say — ${tagline}.`:'';
  const O={professional:`Don't miss your chance to experience ${name}. Get yours today.`,energetic:`So what are you waiting for? Grab ${name} right now!`,luxury:`${name} — crafted for those who appreciate the finest. Reserve yours today.`,playful:`${name} — it's going to be your absolute new favourite thing!`,minimalist:`${name}. Experience it for yourself.`};
  return [I[tone]||I.professional,body,tLine,O[tone]||O.professional].filter(Boolean).join(' ');
}

async function generateAIPresenterVideo(){
  // ── Credits check ──────────────────────────────────────────
  if(typeof Auth!=='undefined'&&Auth.isLoggedIn&&Auth.isLoggedIn()){
    if(!Auth.hasCredits()){
      Toast.show('❌ No credits left! Buy more to continue generating videos.','error',6000);
      setTimeout(()=>window.location.href='pricing.html',1500);
      resetGenerateBtn(); return;
    }
  }
  const name=(document.getElementById('product-name')?.value||'My Product').trim();
  const tagline=(document.getElementById('product-tagline')?.value||'').trim();
  const desc=(document.getElementById('product-desc')?.value||'').trim();
  const color=document.getElementById('brand-color')?.value||'#7c3aed';
  const tone=document.querySelector('.tone-option input:checked')?.value||'professional';
  const script=(document.getElementById('presenter-script')?.value||buildScript(name,tagline,desc,tone)).trim();
  localStorage.removeItem('advision_did_key');
  if(!Studio.images.length){Toast.show('Upload at least one image.','warning');resetGenerateBtn();return;}
  if(typeof MediaRecorder==='undefined'){Toast.show('Use Google Chrome.','error');resetGenerateBtn();return;}
  if(!window.speechSynthesis){Toast.show('SpeechSynthesis not available.','error');resetGenerateBtn();return;}
  showProgress(5,'Loading images...'); await tick();
  const imgs=(await Promise.all(Studio.images.map(i=>loadImg(i.url)))).filter(i=>i?.naturalWidth>0);
  if(!imgs.length){Toast.show('Could not load images.','error');resetGenerateBtn();return;}
  showProgress(18,'Building 3D scene...'); await tick();
  const W=1280,H=720; const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  const cfg={name,tagline,color,tone};
  const wpm=132, wc=script.split(/\s+/).length;
  const estMs=(wc/wpm)*60000+3000;
  const state={frame:0,mouthOpen:0,mouthTarget:0,blinkT:0,bobPhase:0,captionShow:'',imgIdx:0,elapsed:0,totalMs:estMs,speaking:false};
  draw3DPresenterFrame(ctx,W,H,imgs,cfg,state);
  let stream; try{stream=canvas.captureStream(30);}catch(e){Toast.show('captureStream failed. Use Chrome.','error');resetGenerateBtn();return;}
  const mime=getBestMime(); let recorder;
  try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6_000_000});}catch(e){try{recorder=new MediaRecorder(stream);}catch(e2){Toast.show('Recorder failed.','error');resetGenerateBtn();return;}}
  const chunks=[]; recorder.ondataavailable=e=>{if(e.data?.size>0)chunks.push(e.data);};
  let stopped=false;
  recorder.onstop=()=>{
    if(stopped)return; stopped=true; window.speechSynthesis.cancel();
    if(!chunks.length){Toast.show('No video data. Use Chrome.','error');resetGenerateBtn();return;}
    // ── Deduct 10 credits on success ──────────────────────────
    if(typeof Auth!=='undefined'&&Auth.isLoggedIn&&Auth.isLoggedIn()) Auth.deductCredits();
    const blob=new Blob(chunks,{type:mime}); const url=URL.createObjectURL(blob);
    Studio.generatedVideoUrl=url; showProgress(100,'3D AI Presenter video ready! 🎉');
    setTimeout(()=>showResult(url,mime.includes('mp4')?'mp4':'webm',mime,script,true),400);
  };

  // ── Build utterance BEFORE starting recorder ───────────────
  const voices=window.speechSynthesis.getVoices();
  const utt=new SpeechSynthesisUtterance(script);
  utt.rate=0.90; utt.pitch=1.05; utt.lang='en-US';
  const v=voices.find(v=>v.name.toLowerCase().includes('samantha'))||voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang.startsWith('en-US'))||voices.find(v=>v.lang.startsWith('en'))||null;
  if(v)utt.voice=v;
  let lastBnd=performance.now();
  utt.onboundary=e=>{if(e.name==='word'){state.mouthTarget=0.58+Math.random()*0.38;state.speaking=true;state.captionShow=script.substring(0,e.charIndex+e.charLength);lastBnd=performance.now();setTimeout(()=>{state.mouthTarget=Math.random()*0.10;},175+Math.random()*75);}if(e.name==='sentence')state.imgIdx++;};
  utt.onstart=()=>{state.speaking=true;};
  utt.onend=()=>{state.speaking=false;state.mouthTarget=0;state.captionShow=script;setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},1500);};
  utt.onerror=e=>{console.warn('TTS error:',e.error);state.speaking=false;setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},800);};

  // ── Animation loop ─────────────────────────────────────────
  showProgress(30,'🎬 Starting 3D scene...');
  const st2=performance.now(); let lastFr=st2,nxtBlink=2500+Math.random()*2500,nxtImg=4500;
  function animLoop(now){
    const delta=now-lastFr; lastFr=now; state.elapsed=now-st2; state.frame++;
    state.bobPhase+=0.042;
    state.mouthOpen+=clamp((state.mouthTarget-state.mouthOpen)*(delta/50)*0.40,-.10,.10);
    state.mouthOpen=clamp(state.mouthOpen,0,1);
    if(!state.speaking&&performance.now()-lastBnd>350)state.mouthTarget=Math.max(0,state.mouthTarget-0.05);
    nxtBlink-=delta; if(nxtBlink<=0){nxtBlink=2200+Math.random()*3000;triggerBlink(t=>{state.blinkT=t;});}
    nxtImg-=delta; if(nxtImg<=0){nxtImg=4500;state.imgIdx=(state.imgIdx+1)%Math.max(1,imgs.length);}
    state.totalMs=Math.max(state.totalMs,state.elapsed+1000);
    draw3DPresenterFrame(ctx,W,H,imgs,cfg,state);
    const pct=30+Math.min((state.elapsed/state.totalMs)*68,68);
    if(state.frame%12===0)showProgress(pct,`🎙️ AI speaking… ${(state.elapsed/1000).toFixed(1)}s`);
    if(state.elapsed>state.totalMs+8000){if(recorder.state==='recording')recorder.stop();return;}
    requestAnimationFrame(animLoop);
  }
  function triggerBlink(cb){const s2=performance.now(),d=140;function g(n){const t=(n-s2)/d;if(t<.5){cb(t*2);requestAnimationFrame(g);}else if(t<1){cb((1-t)*2);requestAnimationFrame(g);}else cb(0);}requestAnimationFrame(g);}

  // ── START SIMULTANEOUSLY: recorder + animation + speech ────
  // (no delays = character speaks from frame 1 of the video)
  recorder.start(200);
  requestAnimationFrame(animLoop);
  window.speechSynthesis.speak(utt);
  showProgress(32,'🎙️ Recording 3D AI Presenter…');
  Toast.show('🎙️ 3D AI is speaking! Do NOT close this tab.','info',5000);
}



function showResult(url,ext,mime,script,isPresenter){
  document.getElementById('progress-section').style.display='none';
  document.getElementById('preview-section').style.display='none';
  const sec=document.getElementById('video-result-section'); if(!sec)return; sec.style.display='';
  const vid=document.getElementById('result-video'); if(vid){vid.src='';vid.load();vid.src=url;vid.load();vid.play().catch(()=>{});}
  const dl=document.getElementById('download-video-btn'); if(dl){dl.href=url;dl.download='advertisement.'+ext;dl.textContent=`⬇️ Download ${ext.toUpperCase()} Video`;}
  const badge=document.getElementById('video-format-badge'); if(badge)badge.textContent=(isPresenter?'🤖 3D Presenter · ':'🎬 ')+ext.toUpperCase()+' · HD 1280×720';
  const vb=document.getElementById('replay-voice-btn');
  if(vb){if(isPresenter&&script){vb.style.display='';vb.onclick=()=>{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(script);u.rate=0.90;u.pitch=1.05;u.lang='en-US';window.speechSynthesis.speak(u);vid?.play().catch(()=>{});Toast.show('🔊 AI voice + video playing!','success',3000);};}else vb.style.display='none';}
  // Show credits remaining
  if(typeof Auth!=='undefined'&&Auth.isLoggedIn&&Auth.isLoggedIn()){
    const cr=Auth.getCredits();
    const cEl=document.getElementById('result-credits-left');
    if(cEl){cEl.style.display='';cEl.innerHTML=`⚡ <strong>${cr} credits</strong> remaining · <a href="pricing.html" style="color:var(--primary-light);">Buy more</a>`;}
  }
  Toast.show(isPresenter?'🎬 3D AI Presenter video ready! 10 credits used.':'🎬 Ad video ready! 10 credits used.','success',5000);
  resetGenerateBtn();
}

/* ══════════════════════════════════════════════════════════════
   STEP / UPLOAD / FORM / BUTTON MANAGEMENT
   ══════════════════════════════════════════════════════════════ */
function goToStep(step){
  Studio.currentStep=step;
  document.querySelectorAll('.step').forEach((el,i)=>{const n=i+1;el.classList.remove('active','completed');if(n===step)el.classList.add('active');if(n<step)el.classList.add('completed');const c=el.querySelector('.step-circle');if(c)c.textContent=n<step?'✓':n;});
  document.querySelectorAll('.studio-step').forEach(el=>{el.style.display=el.dataset.step==step?'':'none';});
}

function autoFillScript(){
  const el=document.getElementById('presenter-script'); if(!el||el.dataset.edited==='1')return;
  const name=document.getElementById('product-name')?.value||'';
  const tag=document.getElementById('product-tagline')?.value||'';
  const desc=document.getElementById('product-desc')?.value||'';
  const tone=document.querySelector('.tone-option input:checked')?.value||'professional';
  if(name)el.value=buildScript(name,tag,desc,tone);
}

function initUpload(){
  const zone=document.getElementById('upload-zone'),input=document.getElementById('file-input');
  const grid=document.getElementById('image-preview-grid'),nextBtn=document.getElementById('upload-next-btn');
  if(!zone||!input)return;
  zone.addEventListener('click',()=>input.click());
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag-over');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag-over');go(e.dataTransfer.files);});
  input.addEventListener('change',()=>{go(input.files);input.value='';});
  function go(list){
    const ok=['image/jpeg','image/png','image/webp','image/gif'];
    Array.from(list).forEach(f=>{
      if(!ok.includes(f.type)){Toast.show(f.name+': unsupported','error');return;}
      if(f.size>10*1024*1024){Toast.show(f.name+': max 10 MB','error');return;}
      if(Studio.images.length>=6){Toast.show('Max 6 images','warning');return;}
      Studio.images.push({file:f,url:URL.createObjectURL(f),name:f.name});
    }); renderGrid();
  }
  function renderGrid(){
    if(!grid)return; grid.innerHTML='';
    Studio.images.forEach((img,idx)=>{const d=document.createElement('div');d.className='preview-item';d.innerHTML=`${idx===0?'<div class="preview-main-badge">Main</div>':''}<img src="${img.url}" alt="${img.name}"><div class="preview-item-overlay"><button class="preview-remove" data-idx="${idx}">✕</button></div>`;grid.appendChild(d);});
    const c=document.getElementById('img-count'); if(c)c.textContent=Studio.images.length;
    const s=document.getElementById('preview-grid-section'); if(s)s.style.display=Studio.images.length?'':'none';
    if(nextBtn)nextBtn.disabled=!Studio.images.length; updatePreview(); autoFillScript();
  }
  document.addEventListener('click',e=>{const btn=e.target.closest('.preview-remove');if(!btn)return;const i=parseInt(btn.dataset.idx);URL.revokeObjectURL(Studio.images[i]?.url);Studio.images.splice(i,1);renderGrid();});
  if(nextBtn)nextBtn.addEventListener('click',()=>{if(!Studio.images.length){Toast.show('Upload at least one image','warning');return;}goToStep(2);});
}

function updatePreview(){
  const bg=document.getElementById('preview-bg'),pN=document.getElementById('preview-product-name');
  const pT=document.getElementById('preview-tagline'),pB=document.getElementById('preview-badge');
  const color=document.getElementById('brand-color')?.value||'#7c3aed';
  const tone=document.querySelector('.tone-option input:checked')?.value||'professional';
  const bmap={professional:'✨ Premium',energetic:'⚡ Get Yours!',luxury:'♛ Exclusive',playful:'🎉 Fun!',minimalist:'Simple.'};
  if(pN)pN.textContent=document.getElementById('product-name')?.value||'Your Product';
  if(pT)pT.textContent=document.getElementById('product-tagline')?.value||'Discover something amazing';
  if(pB){pB.textContent=bmap[tone]||bmap.professional;pB.style.background=color;}
  if(bg&&Studio.images.length){bg.src=Studio.images[Math.min(Studio.currentImageIdx||0,Studio.images.length-1)].url;bg.style.display='';const ph=document.getElementById('preview-placeholder');if(ph)ph.style.display='none';}
}

function initProductForm(){
  const form=document.getElementById('product-form'),nextBtn=document.getElementById('form-next-btn'),backBtn=document.getElementById('form-back-btn');
  if(!form)return;
  form.addEventListener('input',()=>{updatePreview();autoFillScript();});
  form.addEventListener('change',()=>{updatePreview();autoFillScript();});
  const ci=document.getElementById('brand-color'),cs=document.getElementById('color-swatch');
  if(ci&&cs){ci.type='color';ci.addEventListener('input',()=>{cs.style.background=ci.value;updatePreview();});cs.addEventListener('click',()=>ci.click());}
  if(backBtn)backBtn.addEventListener('click',()=>goToStep(1));
  if(nextBtn)nextBtn.addEventListener('click',()=>{
    const n=document.getElementById('product-name')?.value.trim();
    if(!n){Toast.show('Enter a product name','warning');document.getElementById('product-name')?.focus();return;}
    const g=id=>document.getElementById(id);
    if(g('sum-name'))g('sum-name').textContent=n;
    if(g('sum-tagline'))g('sum-tagline').textContent=g('product-tagline')?.value||'—';
    if(g('sum-tone'))g('sum-tone').textContent=document.querySelector('.tone-option input:checked')?.value||'—';
    if(g('sum-anim'))g('sum-anim').textContent=document.querySelector('.style-option input:checked')?.value||'—';
    if(g('sum-color'))g('sum-color').style.background=g('brand-color')?.value||'#7c3aed';
    const sg=g('summary-images');
    if(sg){sg.innerHTML='';Studio.images.slice(0,3).forEach(img=>{sg.innerHTML+=`<div style="aspect-ratio:1;border-radius:6px;overflow:hidden;border:1px solid var(--border)"><img src="${img.url}" style="width:100%;height:100%;object-fit:cover;"></div>`;});}
    autoFillScript(); goToStep(3); updatePreview();
  });
}

function initGenerateButton(){
  const genBtn=document.getElementById('generate-btn'),backBtn=document.getElementById('generate-back-btn');
  if(backBtn)backBtn.addEventListener('click',()=>goToStep(2));

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      Studio.mode=btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      document.getElementById('std-panel').style.display  =Studio.mode==='standard'?'':'none';
      document.getElementById('pres-panel').style.display =Studio.mode==='presenter'?'':'none';
      if(genBtn)genBtn.innerHTML=Studio.mode==='presenter'?'🤖 Generate 3D AI Presenter Video':'🎬 Generate Real HD Video';
    });
  });

  // Gender toggle
  document.querySelectorAll('.gender-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      Studio.gender=btn.dataset.gender;
      document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    });
  });



  // Script controls
  const scriptEl=document.getElementById('presenter-script');
  if(scriptEl)scriptEl.addEventListener('input',()=>{scriptEl.dataset.edited='1';});
  const resetSc=document.getElementById('reset-script');
  if(resetSc)resetSc.addEventListener('click',()=>{if(scriptEl)scriptEl.dataset.edited='';autoFillScript();Toast.show('Script reset.','info');});
  const prevV=document.getElementById('preview-voice-btn');
  if(prevV)prevV.addEventListener('click',()=>{window.speechSynthesis.cancel();const sc=(document.getElementById('presenter-script')?.value||'').trim()||'Hello! This is how the AI presenter will sound for your product.';const u=new SpeechSynthesisUtterance(sc.substring(0,200));u.rate=0.92;u.pitch=1.05;u.lang='en-US';window.speechSynthesis.speak(u);Toast.show('🔊 Previewing AI voice...','info',3000);});

  // Generate
  if(genBtn){
    genBtn.addEventListener('click',async()=>{
      if(Studio.isGenerating)return;
      if(!Studio.images.length){Toast.show('Upload images first','warning');return;}
      Studio.isGenerating=true; genBtn.disabled=true; genBtn.innerHTML='<span class="spinner"></span>&nbsp;Rendering…';
      document.getElementById('preview-section').style.display='none';
      document.getElementById('video-result-section').style.display='none';
      showProgress(2,'Starting…'); await tick();
      if(Studio.mode==='presenter')generateAIPresenterVideo(); else generateStandardVideo();
    });
  }

  // Share
  document.addEventListener('click',e=>{
    if(!e.target.closest('#share-preview-btn')&&!e.target.closest('#share-preview-btn-2'))return;
    if(Studio.generatedVideoUrl)Toast.show('Right-click video → "Save video as…" to save','info',4000);
    else{navigator.clipboard?.writeText(window.location.href);Toast.show('Link copied!','success');}
  });
}

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  // Clear old session keys from previous auth system versions
  localStorage.removeItem('advision_user');
  if(!Auth||!Auth.isLoggedIn()){window.location.href='auth.html?redirect=studio.html';return;}
  goToStep(1); initUpload(); initProductForm(); initGenerateButton();
  const ks=document.getElementById('api-key-status');
  if(ks){ks.textContent='🟢 3D Engine Ready';ks.className='badge badge-success';}
  const notice=document.getElementById('api-notice');
  const cr=typeof Auth!=='undefined'?Auth.getCredits():0;
  const crColor=cr>=30?'#10b981':cr>=10?'#f59e0b':'#ef4444';
  if(notice){
    notice.innerHTML=`<span class="notice-icon">✅</span><p><strong>3D AI Presenter is ready!</strong> Each video uses <strong>10 credits</strong>. You have <strong style="color:${crColor};">${cr} credits</strong> remaining (${Math.floor(cr/10)} videos).<br><span style="font-size:0.78rem;color:var(--text-400);">Use Chrome or Edge · Male or Female character · <a href="pricing.html" style="color:var(--primary-light);">Buy more credits</a></span></p>`;
    notice.style.cssText+='background:rgba(16,185,129,0.08);border-color:rgba(16,185,129,0.3);';
  }
  if(!document.getElementById('spinner-style')){const s=document.createElement('style');s.id='spinner-style';s.textContent=`.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle}`;document.head.appendChild(s);}
  window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged=()=>{};
  localStorage.removeItem('advision_did_key');
});

