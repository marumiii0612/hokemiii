import './style.css';
import { Audio } from './audio';
import { createRound, missions, type GameId, type Round } from './games';
import { C, W, H, rect, shuffle } from './draw';

const mark = '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m20 3 17 17-17 17L3 20Z" stroke="currentColor"/><path d="M20 11v18M11 20h18" stroke="currentColor"/><circle cx="20" cy="20" r="5" stroke="currentColor"/></svg>';
const arrow='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5"/></svg>';
const pauseIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2"/></svg>';
const soundIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Zm4 3c3 2 3 6 0 8m3-11c5 4 5 10 0 14" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
  <div class="site-frame">
    <header class="site-header">
      <button class="brand" id="home-button" aria-label="タイトルへ">${mark}<span>潜入<span class="brand-en">FIELD TEST</span></span></button>
      <div class="header-right"><span class="classified">極秘<span> / CLASSIFIED</span></span><button id="sound-button" class="icon-button sound-button" aria-label="音をオフにする" aria-pressed="true">${soundIcon}<span>ON</span></button></div>
    </header>

    <main id="title-screen" class="title-screen">
      <div class="title-art" aria-hidden="true"><div class="arch"><div class="door"><i></i><b></b></div></div><div class="floor-lines"></div><div class="red-thread"></div></div>
      <div class="title-meta"><span class="status-dot"></span> SINGLE PLAYER <span class="meta-divider">/</span> 8 MISSIONS</div>
      <div class="title-content">
        <span class="eyebrow">THE FIELD IS WAITING.</span>
        <h1><button id="start-button" class="start-button">はじめる<span class="start-arrow">${arrow}</span></button></h1>
        <p class="title-tagline">判断は、一瞬。</p>
        <div class="title-rule"></div>
        <p class="title-description">八つの任務。一度きりの判断。<br>どこまで生き残れるか。</p>
        <div class="title-record"><span>自己最高記録</span><strong id="title-best">00</strong><span>STAGES</span></div>
      </div>
      <div class="title-bottom"><button id="help-button" class="text-button"><span class="help-symbol">?</span> 遊び方を見る</button><span class="title-id">OPERATION No. 008</span></div>
    </main>

    <main id="play-screen" class="play-screen" hidden>
      <div class="game-status">
        <div class="stage-count"><span class="eyebrow">STAGE</span><strong id="stage-number">01</strong></div>
        <div class="live-status"><span id="loop-label" class="loop-label">LOOP 01</span><span id="speed-label">SPEED ×1.00</span></div>
        <button id="pause-button" class="icon-button" aria-label="一時停止">${pauseIcon}</button>
      </div>
      <div class="mission-heading"><div><span id="mission-en" class="eyebrow">MISSION 01</span><h2 id="mission-title">刺せ<span>。</span></h2></div><div class="timer-number"><span>TIME LEFT</span><strong id="time-value">6.0<span>s</span></strong></div></div>
      <div class="timer-track"><div id="time-bar"></div></div>
      <div class="game-window" id="game-window">
        <canvas id="game-canvas" width="720" height="640" tabindex="0" role="img" aria-label="ミニゲームの画面。操作説明と下のボタンでも操作できます。"></canvas>
        <div id="transition" class="transition" hidden><span id="transition-label" class="eyebrow"></span><div id="pursuer" class="pursuer" hidden><svg viewBox="0 0 100 110" aria-hidden="true"><path d="M18 110v-24q0-26 32-26t32 26v24" fill="#0b1511" stroke="#789075"/><path d="m35 65 15 25 15-25M50 90v20" fill="none" stroke="#92a181"/><ellipse cx="50" cy="34" rx="19" ry="23" fill="#7b8c70"/><path d="M31 31q-3-29 19-28 23 0 19 28l-10-15-15 5Z" fill="#0b1511"/><path d="M56 40h21V27M76 27h5v25h-7" fill="none" stroke="#b4bda0" stroke-width="3"/><path d="M38 35h6m12 0h6" stroke="#18251b" stroke-width="2"/></svg><span>追跡者 / 無線</span></div><strong id="transition-title"></strong><p id="transition-message"></p><div class="transition-mark">${mark}</div></div>
        <div id="pause-panel" class="pause-panel" role="dialog" aria-modal="true" aria-label="一時停止" hidden><span class="eyebrow">OPERATION SUSPENDED</span><h2>一時停止</h2><p>焦らず、次の一手を。</p><button id="resume-button" class="primary-button">つづける ${arrow}</button><button id="quit-button" class="text-button">任務を終了する</button></div>
      </div>
      <p id="game-hint" class="game-hint" aria-live="polite"></p>
      <div id="controls" class="controls"></div>
      <div class="game-bottom"><span id="cleared-label">0 STAGES CLEARED</span><span>判断は、一瞬。</span></div>
    </main>

    <main id="result-screen" class="result-screen" hidden>
      <div class="result-symbol">${mark}</div><span class="eyebrow">OPERATION COMPLETE</span><h1>任務終了<span>。</span></h1>
      <p id="result-message" class="result-message"></p>
      <div class="score-block"><span>到達記録</span><div><strong id="final-score">0</strong><span>STAGES<br>CLEARED</span></div></div>
      <p id="new-record" class="new-record" hidden>NEW PERSONAL BEST</p>
      <div class="result-best">自己最高記録 <strong id="result-best">0</strong> STAGES</div>
      <button id="retry-button" class="primary-button">もう一度、潜入する ${arrow}</button>
      <button id="share-button" class="secondary-button">記録を共有する <span>↗</span></button>
      <div id="share-fallback" hidden><p>この記録をコピーして共有できます。</p><textarea id="share-text" readonly aria-label="共有用の記録"></textarea></div>
      <button id="back-button" class="text-button">タイトルへ戻る</button>
    </main>

    <footer class="site-footer"><span>FICTIONAL OPERATIONS BUREAU</span><span>EST. 2026 <i>●</i> JP</span></footer>
  </div>
  <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-header"><span class="eyebrow">FIELD MANUAL</span><button id="close-help" class="icon-button" aria-label="遊び方を閉じる">×</button></div><h2 id="help-title">任務の手引き<span>。</span></h2><p class="help-intro">ランダムに続く8つのミニゲーム。<br>制限時間内に成功させ、自己最高記録を目指せ。</p><div class="mission-list">${missions.map(m=>`<div class="manual-mission"><span>${m.icon}</span><div><h3>${m.title}</h3><p>${m.sub}</p></div></div>`).join('')}</div><div class="manual-note"><p>1ミスで任務失敗。8ステージごとに1周し、2周目は1.2倍、3周目は1.4倍と加速（最大2.4倍）。記録はこの端末に保存されます。</p><p>PC：画面クリック・Space・矢印キー・数字1〜4。P / Escで一時停止。スマホ：画面または操作ボタンをタップ。</p></div><details><summary>このゲームについて・地図の出典</summary><p>VIVANTに着想を得た、非公式のオリジナルファンゲームです。作品の画像・音源や俳優の肖像は使用していません。記憶写真はオリジナルイラスト、キャンパスは記憶ゲーム用の簡略図です。</p><p>日本地図：国土地理院「地球地図日本」。dataofjapan/land の地理データを簡略化して使用。一部の島嶼は省略しています。地図データの利用条件は <a href="https://github.com/dataofjapan/land" target="_blank" rel="noreferrer">配布元</a> を参照してください。</p></details></dialog>
  <div id="toast" class="toast" role="status" hidden></div>
`;

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const audio=new Audio();
let best=0;
try{const n=Number(localStorage.getItem('sennyu-best-v1'));if(Number.isFinite(n)&&n>=0)best=Math.floor(n);audio.enabled=localStorage.getItem('sennyu-sound')!=='off';}catch{}
let state:'title'|'briefing'|'playing'|'feedback'|'result'='title';
let round:Round|null=null, bag:GameId[]=[], lastGame:GameId|null=null;
let cleared=0,paused=false,transitionTime=0,controlSignature='',lastHint='',oldBest=best;
let finalReason='',lastFrame=performance.now(),toastTimer=0;
const canvas=el<HTMLCanvasElement>('game-canvas');
const ctx=canvas.getContext('2d')!;
function resizeCanvas(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
resizeCanvas();window.addEventListener('resize',resizeCanvas);

function updateSound(){el('sound-button').setAttribute('aria-pressed',String(audio.enabled));el('sound-button').setAttribute('aria-label',audio.enabled?'音をオフにする':'音をオンにする');el('sound-button').querySelector('span')!.textContent=audio.enabled?'ON':'OFF';}
updateSound();
function updateBest(){el('title-best').textContent=String(best).padStart(2,'0');el('result-best').textContent=String(best);}
updateBest();
function showScreen(name:'title'|'play'|'result'){
  for(const s of ['title','play','result'])el(`${s}-screen`).hidden=s!==name;
  document.body.dataset.screen=name;
}
function title(){state='title';round=null;paused=false;el('pause-panel').hidden=true;showScreen('title');updateBest();el('start-button').focus({preventScroll:true});}
function begin(){audio.unlock();oldBest=best;cleared=0;bag=[];lastGame=null;paused=false;el('pause-panel').hidden=true;el('share-fallback').hidden=true;showScreen('play');nextRound();}
function nextRound(){
  if(!bag.length){bag=shuffle(missions.map(m=>m.id));if(bag[0]===lastGame)[bag[0],bag[1]]=[bag[1],bag[0]];}
  const id=bag.shift()!;lastGame=id;
  const m=missions.find(m=>m.id===id)!;
  round=createRound(id,{finish:finishRound,sound:s=>audio.play(s)},cleared+1);
  state='briefing';transitionTime=0;controlSignature='';lastHint='';
  el('stage-number').textContent=String(cleared+1).padStart(2,'0');
  el('mission-en').textContent=`MISSION ${String(missions.indexOf(m)+1).padStart(2,'0')} / ${['PRECISION','OBSERVATION','CONTACT','EVASION','CONTROL','MEMORY','ESCAPE','REFUEL'][missions.indexOf(m)]}`;
  el('mission-title').innerHTML=`${m.title}<span>。</span>`;
  el('speed-label').textContent=`SPEED ×${Math.min(2.4,1+Math.floor(cleared/8)*.2).toFixed(2)}`;
  el('loop-label').textContent=`LOOP ${String(Math.floor(cleared/8)+1).padStart(2,'0')}`;
  el('cleared-label').textContent=`${cleared} STAGES CLEARED`;
  el('transition').className='transition briefing';el('transition').hidden=false;
  el('pursuer').hidden=true;
  el('transition-label').textContent=`STAGE ${String(cleared+1).padStart(2,'0')}`;el('transition-title').textContent=`${m.title}。`;el('transition-message').textContent=m.sub;
  el('controls').replaceChildren();el('controls').hidden=true;
  el('game-hint').textContent=m.sub;
  el('time-value').innerHTML=`${round.duration.toFixed(1)}<span>s</span>`;
  el('time-bar').style.width='100%';el('time-bar').classList.remove('urgent');
  canvas.setAttribute('aria-label',`${m.title}。${m.sub}`);
}
function finishRound(ok:boolean,message:string){
  if(state!=='playing')return;
  state='feedback';transitionTime=0;finalReason=message;
  if(ok){cleared++;if(cleared>best){best=cleared;try{localStorage.setItem('sennyu-best-v1',String(best));}catch{}}}
  audio.play(ok?'good':'bad');
  if(!ok){endRun();return;}
  el('transition').className=`transition feedback ${ok?'success':'failure'}`;el('transition').hidden=false;
  el('transition-label').textContent=ok?'MISSION ACCOMPLISHED':'OPERATION FAILED';
  el('transition-title').textContent=ok?'任務完了':'任務失敗';el('transition-message').textContent=message;
  if(round?.id==='chase'){el('pursuer').hidden=false;el('transition-title').textContent='追跡解除';el('transition-label').textContent='PURSUIT LOST';el('transition').classList.add('chase-clear');}
  if(round?.id==='knock'){
    el('transition').classList.add('door-clear');
    el('game-hint').textContent='認証成功。扉が開きます。';
    canvas.setAttribute('aria-label','接触コードの照合に成功し、扉が開きます。');
  }
  el('controls').querySelectorAll('button').forEach(b=>b.disabled=true);
}
function endRun(){
  state='result';paused=false;el('pause-panel').hidden=true;round=null;showScreen('result');
  el('result-screen').querySelector('h1')!.innerHTML='任務失敗<span>。</span>';
  el('result-screen').querySelector('.eyebrow')!.textContent='OPERATION FAILED';
  el('final-score').textContent=String(cleared);el('result-message').textContent=finalReason;
  el('new-record').hidden=best<=oldBest;updateBest();el('retry-button').focus({preventScroll:true});
}
function setPaused(value:boolean){
  if(!['playing','briefing','feedback'].includes(state))return;
  paused=value;el('pause-panel').hidden=!value;el('pause-button').setAttribute('aria-label',value?'再開':'一時停止');
  if(value)el('resume-button').focus({preventScroll:true});else canvas.focus({preventScroll:true});
}
function dispatch(action:string){if(state==='playing'&&!paused){audio.unlock();round?.action(action);}}
function updateControls(){
  if(!round)return;
  const controls=round.controls();const signature=JSON.stringify(controls);
  if(signature!==controlSignature){
    controlSignature=signature;
    el('controls').hidden=controls.length===0;
    const activeAction=(document.activeElement as HTMLElement)?.dataset.action;
    el('controls').className=`controls ${controls.length===4?'four':controls.length===2?'two':''}`;
    el('controls').replaceChildren(...controls.map(control=>{
      const button=document.createElement('button');button.className='control-button';button.dataset.action=control.action;
      const label=document.createElement('span');label.textContent=control.label;button.append(label);
      if(control.key){const k=document.createElement('kbd');k.textContent=control.key;button.append(k);}
      button.addEventListener('click',()=>dispatch(control.action));return button;
    }));
    if(activeAction)el('controls').querySelector<HTMLButtonElement>(`[data-action="${activeAction}"]`)?.focus({preventScroll:true});
  }
  if(lastHint!==round.hint){lastHint=round.hint;el('game-hint').textContent=lastHint;}
}
function frame(now:number){
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(round&&state!=='title'&&state!=='result'){
    if(!paused){
      if(state==='briefing'){transitionTime+=dt;if(transitionTime>1.25){state='playing';el('transition').hidden=true;updateControls();}}
      else if(state==='playing'){
        const current=round;
        current.tick(dt);
        const left=Math.max(0,current.duration-current.elapsed);
        el('time-value').innerHTML=`${left.toFixed(1)}<span>s</span>`;el('time-bar').style.width=`${left/current.duration*100}%`;el('time-bar').classList.toggle('urgent',left<2);
        if(state==='playing')updateControls();
      }else if(state==='feedback'){
        round.animateSuccess(dt);transitionTime+=dt;
        if(transitionTime>round.successDuration)nextRound();
      }
    }
    if(round){rect(ctx,0,0,W,H,C.bg);round.draw(ctx);}
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

canvas.addEventListener('pointerdown',e=>{
  if(state!=='playing'||paused)return;e.preventDefault();audio.unlock();
  const b=canvas.getBoundingClientRect();round?.pointer((e.clientX-b.left)/b.width*W,(e.clientY-b.top)/b.height*H);
});
canvas.addEventListener('pointermove',e=>{if(state!=='playing'||paused)return;const b=canvas.getBoundingClientRect();round?.move((e.clientX-b.left)/b.width*W,(e.clientY-b.top)/b.height*H);});
document.addEventListener('keydown',e=>{
  if(el<HTMLDialogElement>('help-dialog').open)return;
  if((e.key==='Escape'||e.code==='KeyP')&&['playing','briefing','feedback'].includes(state)){e.preventDefault();if(!e.repeat)setPaused(!paused);return;}
  if(state!=='playing'||paused)return;
  const action:Record<string,string>={Space:'primary',ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Digit1:'choice-0',Digit2:'choice-1',Digit3:'choice-2',Digit4:'choice-3',Numpad1:'choice-0',Numpad2:'choice-1',Numpad3:'choice-2',Numpad4:'choice-3'};
  if(action[e.code]){e.preventDefault();if(!e.repeat||round?.id==='aim')dispatch(action[e.code]);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPaused(true);});
window.addEventListener('blur',()=>setPaused(true));
el('start-button').onclick=begin;el('retry-button').onclick=begin;el('back-button').onclick=title;
el('home-button').onclick=()=>{if(state==='title'||state==='result')title();else setPaused(true);};
el('pause-button').onclick=()=>setPaused(!paused);el('resume-button').onclick=()=>setPaused(false);
el('quit-button').onclick=()=>{finalReason='任務から帰還した。';endRun();el('result-screen').querySelector('h1')!.innerHTML='任務終了<span>。</span>';el('result-screen').querySelector('.eyebrow')!.textContent='OPERATION COMPLETE';};
el('sound-button').onclick=()=>{audio.enabled=!audio.enabled;audio.unlock();updateSound();try{localStorage.setItem('sennyu-sound',audio.enabled?'on':'off');}catch{}};
el('help-button').onclick=()=>el<HTMLDialogElement>('help-dialog').showModal();
el('close-help').onclick=()=>el<HTMLDialogElement>('help-dialog').close();
el<HTMLDialogElement>('help-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const b=(e.currentTarget as HTMLElement).getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)el<HTMLDialogElement>('help-dialog').close();}});
function toast(s:string){el('toast').textContent=s;el('toast').hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>el('toast').hidden=true,2800);}
el('share-button').onclick=async()=>{
  const shareText=`潜入｜FIELD TEST\n${cleared}ステージを突破。判断は、一瞬。\n#潜入FIELDTEST`;
  const url=window.location.href;
  const isPublic=!['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(location.hostname)&&/^https?:$/.test(location.protocol);
  const shared=shareText+(isPublic?`\n${url}`:'');
  try{
    if(navigator.share){await navigator.share({title:'潜入｜FIELD TEST',text:shareText,...(isPublic?{url}:{})});return;}
    await navigator.clipboard.writeText(shared);toast('記録をコピーしました。');
  }catch(error){
    if(error instanceof DOMException&&error.name==='AbortError')return;
    el('share-fallback').hidden=false;el<HTMLTextAreaElement>('share-text').value=shared;el<HTMLTextAreaElement>('share-text').select();
  }
};
document.body.dataset.screen='title';
