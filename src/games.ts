import japan from './data/japan.json';
import okinawa from './data/okinawa.json';
import { C, W, H, rect, text, line, circle, grid, label, cross, person, vignette, rand, pick, shuffle } from './draw';

export type GameId = 'knife' | 'map' | 'knock' | 'laser' | 'aim' | 'memory' | 'chase' | 'eat';
export type Control = { label: string; action: string; key?: string };
type Api = { finish: (ok: boolean, message: string) => void; sound: (kind: 'tap'|'shoot'|'warning') => void };
export const missions: { id: GameId; title: string; sub: string; icon: string }[] = [
  {id:'knife',title:'刺せ',sub:'バナナが中央に来たら、ナイフを投げろ。チャンスは一度。',icon:'↟'},
  {id:'map',title:'見つけろ',sub:'日本地図の間違いを見つけて、その場所をタップ。',icon:'⌖'},
  {id:'knock',title:'伝えろ',sub:'5桁の接触コードを、自分・相手・自分・相手・自分で伝えろ。',icon:'⠿'},
  {id:'laser',title:'よけろ',sub:'予告の赤いラインから離れ、レーザーをよけ続けろ。',icon:'╳'},
  {id:'aim',title:'狙え',sub:'心臓のすぐ横の白い照準を撃て。赤い心臓は撃つな。',icon:'⊕'},
  {id:'memory',title:'覚えろ',sub:'短時間だけ表示される写真を記憶し、続く質問に答えろ。',icon:'◷'},
  {id:'chase',title:'撒け',sub:'3列の人混みを左右によけ、追っ手を振り切れ。',icon:'⇄'},
  {id:'eat',title:'食べろ',sub:'黄色い和服の大男。10人前のチャーハンを食べ切れ。',icon:'◒'},
];

export abstract class Round {
  abstract id: GameId;
  elapsed=0;
  protected ended=false;
  duration=8;
  successDuration=1.05;
  abstract hint: string;
  protected speed: number;
  constructor(protected api: Api, public stage: number) { this.speed=Math.min(2.4,1+Math.floor((stage-1)/8)*.2); }
  tick(dt: number) { if(this.ended)return; this.elapsed+=dt; this.update(dt); if(this.elapsed>=this.duration&&!this.ended)this.timeout(); }
  protected update(_dt: number) {}
  animateSuccess(_dt: number) {}
  protected timeout() { this.end(false,'時間切れ。判断は、一瞬だ。'); }
  protected end(ok: boolean, message: string) { if(this.ended)return; this.ended=true; this.api.finish(ok,message); }
  abstract draw(c: CanvasRenderingContext2D): void;
  controls(): Control[] { return []; }
  pointer(_x: number,_y: number) {}
  move(_x: number,_y: number) {}
  action(_value: string) {}
}

class Knife extends Round {
  id='knife' as const;
  hint='画面をタップして、真上にナイフを投げる';
  private bx=-80; private by=230; private ky=559; private thrown=false;
  constructor(api: Api, stage: number) { super(api,stage); this.duration=6/this.speed; }
  protected update(dt: number) {
    this.bx+=260*this.speed*dt;
    this.by=246-68*Math.sin(Math.max(0,(this.bx+80)/880)*Math.PI);
    if(this.thrown) {
      const old=this.ky; this.ky-=1030*dt;
      if(Math.abs(this.bx-360)<43 && this.ky-30<=this.by+25 && old+25>=this.by-25) this.end(true,'一撃で、捉えた。');
      else if(this.ky < -60) this.end(false,'ナイフが空を切った。');
    }
    if(this.bx>800)this.end(false,'バナナを見送ってしまった。');
  }
  controls() { return [{label:'投げる',action:'primary',key:'SPACE'}]; }
  action(s:string) { if(s==='primary'&&!this.thrown&&!this.ended){ this.thrown=true; this.api.sound('shoot'); } }
  pointer() { this.action('primary'); }
  draw(c: CanvasRenderingContext2D) {
    rect(c,0,0,W,H,'#202a25'); grid(c,60,'#2b3730');
    rect(c,42,56,636,530,'#17211c',2);
    line(c,[[70,293],[650,293]],'#354437');
    label(c,'01 / TRAJECTORY',72,88); label(c,'KNIFE × 01',72,551,C.gold);
    c.setLineDash([4,8]); line(c,[[360,290],[360,511]],'#677058'); c.setLineDash([]);
    cross(c,360,220,35,'#546044');
    c.save(); c.translate(this.bx,this.by); c.rotate(-.35+this.elapsed*.5);
    c.shadowColor='#d9ba68'; c.shadowBlur=24;
    c.beginPath(); c.moveTo(-43,-22); c.bezierCurveTo(-12,5,17,8,46,-24); c.bezierCurveTo(34,38,-13,55,-43,-22);
    c.fillStyle='#e8c65a'; c.fill(); c.shadowBlur=0;
    c.beginPath(); c.moveTo(-39,-18); c.bezierCurveTo(-7,30,17,30,43,-20); c.strokeStyle='#ad8c36'; c.lineWidth=2; c.stroke();
    rect(c,-47,-25,9,12,'#5e4b2b',2); rect(c,42,-27,8,9,'#64502f',2); c.restore();
    c.save(); c.translate(360,this.ky);
    c.shadowColor='#000'; c.shadowBlur=10;
    c.beginPath(); c.moveTo(0,-48); c.lineTo(10,12); c.lineTo(-7,12); c.closePath(); c.fillStyle='#dedfd2'; c.fill();
    line(c,[[0,-35],[0,8]],'#87998e',2); rect(c,-13,10,26,5,C.gold,1); rect(c,-6,15,12,31,'#644e34',3);
    c.restore();
    label(c,'TAP TO THROW',505,551); vignette(c);
  }
}

type Place={name:string;x:number;y:number;rx:number;ry:number};
const places:Place[]=[
  {name:'四国',x:213,y:442,rx:63,ry:38},
  {name:'滋賀県',x:300,y:394,rx:30,ry:32},
  {name:'佐渡島',x:379,y:303,rx:26,ry:30},
  {name:'沖縄',x:590,y:505,rx:100,ry:60},
];
const mapFeatures=[...japan,...okinawa];
class Find extends Round {
  id='map' as const;
  hint='地図の間違っている場所をタップ';
  private target=rand(places.length);
  constructor(api:Api, stage:number){
    super(api,stage); this.duration=10/this.speed;
  }
  private answer(correct:boolean){
    const name=places[this.target].name;
    this.end(correct,correct?`${name}の異変を発見。`:`異変は${name}だった。`);
  }
  pointer(x:number,y:number){
    const p=places[this.target];
    this.answer(((x-p.x)/p.rx)**2+((y-p.y)/p.ry)**2<=1);
  }
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#17292d'); grid(c,48,'#1f3539');
    label(c,'GEOGRAPHIC INTELLIGENCE / JP',28,30,C.blue);
    text(c,'日本列島に、ひとつの異変。',360,600,20,C.paper);
    c.save();c.setLineDash([5,5]);c.strokeStyle='#486167';c.lineWidth=1;
    c.strokeRect(472,430,210,138);c.restore();
    label(c,'沖縄本島周辺 / 位置を移動',477,417,C.muted);
    c.save();
    mapFeatures.forEach(feature=>{
      if(this.target===0&&[36,37,38,39].includes(feature.id))return;
      if(this.target===1&&feature.id===25)return;
      if(this.target===2&&feature.sado)return;
      if(this.target===3&&feature.id===47)return;
      c.beginPath();
      feature.rings.forEach(r=>{r.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();});
      c.fillStyle='#a4ad88'; c.fill('evenodd'); c.strokeStyle='#6c7b68'; c.lineWidth=.8; c.stroke();
    });
    line(c,[[628,87],[628,132]],C.paper);text(c,'N',628,69,15,C.paper);text(c,'▲',628,86,13,C.paper);
    label(c,'一部島嶼は省略',30,551); c.restore();
  }
}

class Knock extends Round {
  id='knock' as const;
  successDuration=1.45;
  hint='光っている数字の回数だけノック。青い番は相手が返す。';
  private code=Array.from({length:5},()=>Math.min(6,2+Math.floor((this.stage-1)/8))+rand(4));
  private turn=0; private taps=0; private delay=0; private lastAuto=0; private ripples:number[]=[];
  private doorOpening=0;
  constructor(api:Api,stage:number){super(api,stage);this.duration=16/this.speed;}
  controls(){return this.turn===5?[]:[{label:this.turn%2?'応答を待て…':'ノック',action:'primary',key:'SPACE'}];}
  animateSuccess(dt:number){if(this.turn===5)this.doorOpening=Math.min(1,this.doorOpening+dt/.8);}
  protected update(dt:number){
    this.ripples=this.ripples.map(r=>r+dt).filter(r=>r<.7);
    if(this.delay>0){this.delay-=dt;if(this.delay<=0){this.turn++;this.taps=0;this.lastAuto=this.elapsed;if(this.turn===5)this.end(true,'接触コード、照合完了。');}return;}
    if(this.turn%2&&this.elapsed-this.lastAuto>.32/this.speed){this.lastAuto=this.elapsed;this.knock();}
  }
  private knock(){this.taps++;this.api.sound('tap');this.ripples.push(0);if(this.taps===this.code[this.turn])this.delay=.55/this.speed;}
  action(s:string){
    if(s!=='primary'||this.turn%2||this.ended)return;
    if(this.delay>0){this.end(false,'ノックが多い。接触コード不一致。');return;}
    this.knock();
  }
  pointer(){this.action('primary');}
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#19201d');
    const g=c.createRadialGradient(360,300,50,360,300,470);g.addColorStop(0,'#434433');g.addColorStop(1,'#141a17');c.fillStyle=g;c.fillRect(0,0,W,H);
    label(c,'CONTACT CODE / EYES ONLY',40,35,C.gold);
    this.code.forEach((v,i)=>{const active=i===this.turn;rect(c,177+i*77,68,60,67,active?(this.turn%2?'#4e6d75':'#c7b180'):'#26302b',3);text(c,String(v),207+i*77,102,34,active?C.ink:i<this.turn?C.green:C.muted,'center',600);text(c,i%2?'相手':'自分',207+i*77,155,13,C.muted);});
    this.drawDoor(c);
    if(this.turn<5){
      this.ripples.forEach(r=>{circle(c,347,451,18+r*100,`rgba(221,198,143,${.7-r})`,true,2);});
      rect(c,223,543,274,54,'#17201be8',3);
      text(c,this.turn%2?'相手の応答を待て':'あなたの番',360,569,23,this.turn%2?C.blue:C.gold,'center',600);
    }
    vignette(c);
  }
  private drawDoor(c:CanvasRenderingContext2D){
    rect(c,175,190,370,450,'#0e1512',4);
    c.save();c.beginPath();c.rect(190,204,340,436);c.clip();
    const light=c.createLinearGradient(190,204,530,640);
    light.addColorStop(0,'#435144');light.addColorStop(.55,'#807a54');light.addColorStop(1,'#d8c28b');
    c.fillStyle=light;c.fillRect(190,204,340,436);
    rect(c,237,232,245,198,'#313c30');rect(c,251,244,217,182,'#55604a');
    line(c,[[361,244],[361,426]],'#798060',2);
    line(c,[[190,431],[530,431]],'#c5b482',3);
    for(let i=0;i<5;i++)line(c,[[190,452+i*i*12],[530,452+i*i*12]],'#b9a97466');
    line(c,[[310,431],[242,640]],'#b9a97466');line(c,[[415,431],[487,640]],'#b9a97466');
    person(c,402,527,1.1,'#19251e','#a49470');

    // Project the wooden leaf about its left hinge into a shallow trapezoid.
    const eased=1-Math.pow(1-this.doorOpening,3),angle=eased*1.37;
    const widthScale=Math.cos(angle),inset=Math.sin(angle)*34;
    const point=(x:number,y:number)=>[190+x*widthScale,204+inset*x/340+y*(1-2*inset*x/(340*436))];
    const panel=(x:number,y:number,w:number,h:number,color:string)=>{
      c.beginPath();[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].forEach(([px,py],i)=>{
        const [dx,dy]=point(px,py);i?c.lineTo(dx,dy):c.moveTo(dx,dy);
      });c.closePath();c.fillStyle=color;c.fill();
    };
    panel(0,0,340,436,'#4d4432');
    for(let i=0;i<14;i++)line(c,[point(5+i*25,1),point(5+i*25,436)],'#60513b',1);
    panel(24,32,292,178,'#3e382b');panel(24,230,292,187,'#3e382b');
    line(c,[point(28,36),point(312,36),point(312,207)],'#655741',2);
    panel(334,0,6,436,'#9a8255');panel(127,72,86,40,'#202a24');
    const [plateX,plateY]=point(170,93);
    c.save();c.translate(plateX,plateY);c.scale(widthScale,1);text(c,'別室',0,0,16,C.gold);c.restore();
    const [knobX,knobY]=point(287,230);
    c.beginPath();c.ellipse(knobX,knobY,Math.max(2,12*widthScale),12,0,0,Math.PI*2);c.fillStyle='#b39b5d';c.fill();
    panel(285,230,6,29,'#b39b5d');
    c.restore();
    line(c,[[182,198],[538,198],[538,640]],this.doorOpening>0?'#9f8d58':'#4e4b35',2);
  }
}

class Laser extends Round {
  id='laser' as const;
  hint='赤い予告線から離れる。左右キー / 画面の左右をタップ';
  private lane=1; private px=360; private wave=-1; private danger:number[]=[];
  private period=1.65; private phase=0;
  constructor(api:Api,stage:number){super(api,stage);this.duration=7/this.speed;this.period=1.65/this.speed;}
  controls(){return[{label:'左へ',action:'left',key:'←'},{label:'右へ',action:'right',key:'→'}];}
  action(s:string){if(s==='left')this.lane=Math.max(0,this.lane-1);if(s==='right')this.lane=Math.min(2,this.lane+1);}
  pointer(x:number){this.action(x<360?'left':'right');}
  protected update(dt:number){
    this.px+=(180+this.lane*180-this.px)*Math.min(1,dt*18);
    const t=this.elapsed-.6/this.speed;if(t<0)return;
    const w=Math.floor(t/this.period); this.phase=(t%this.period)/this.period;
    if(w!==this.wave){this.wave=w;this.danger=shuffle([0,1,2]).slice(0,this.stage>=9&&w%2?2:1);this.api.sound('warning');}
    if(this.phase>.57&&this.phase<.77&&this.danger.includes(this.lane))this.end(false,'レーザーに触れた。');
  }
  protected timeout(){this.end(true,'セキュリティを突破した。');}
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#111b20');
    const vx=360,vy=130;
    for(let i=0;i<8;i++){const y=200+i*i*8;line(c,[[40,y],[680,y]],'#28373c');}
    for(let x=-500;x<1300;x+=200)line(c,[[vx,vy],[x,H]],'#28373c');
    rect(c,64,62,592,109,'#1c2a2e');line(c,[[64,171],[656,171]],'#587275',2);
    [180,360,540].forEach((x,i)=>{
      rect(c,x-53,77,106,68,'#0e171a',4);circle(c,x,112,8,this.danger.includes(i)?C.red:'#54766f');
      text(c,`0${i+1}`,x,197,15,C.muted);
      if(this.danger.includes(i)){
        const on=this.phase>.57&&this.phase<.77;
        if(this.phase<.57||on){
          c.save(); c.globalAlpha=on?1:.2+.2*Math.sin(this.elapsed*24);
          rect(c,x-60,226,120,360,'#e5534022');
          c.shadowColor=C.red;c.shadowBlur=on?25:0;line(c,[[x,168],[x,604]],on?'#ffcead':C.red,on?9:2);
          c.restore(); if(!on)text(c,'!',x,271,24,C.red,'center',700);
        }
      }
    });
    circle(c,this.px,557,39,'#00000070');
    person(c,this.px,521,1.25,'#080c11','#161d22',Math.sin(this.elapsed*9)*4);
    line(c,[[this.px-8,412],[this.px+8,412]],'#7b8888',3);
    label(c,'SECURITY GRID / A-03',35,30,C.blue); label(c,'SURVIVE',35,604,C.gold);vignette(c);
  }
}

class Aim extends Round {
  id='aim' as const;
  hint='赤い心臓の横、白い照準の中をタップして撃つ';
  private hx=340+rand(41); private hy=262+rand(25); private ax=360;private ay=440;
  private side=Math.random()<.5?-1:1;
  constructor(api:Api,stage:number){super(api,stage);this.duration=6/this.speed;}
  controls(){return[{label:'照準を撃つ',action:'primary',key:'SPACE'}];}
  move(x:number,y:number){this.ax=x;this.ay=y;}
  pointer(x:number,y:number){this.ax=x;this.ay=y;this.action('primary');}
  action(s:string){
    if(['left','right','up','down'].includes(s)){this.ax+=s==='left'?-8:s==='right'?8:0;this.ay+=s==='up'?-8:s==='down'?8:0;return;}
    if(s!=='primary')return;this.api.sound('shoot');
    const hit=Math.hypot(this.ax-(this.hx+this.side*65),this.ay-this.hy)<23;
    const heart=Math.hypot(this.ax-this.hx,this.ay-this.hy)<32;
    this.end(hit,hit?'急所を外し、正確に制圧。':heart?'心臓に命中。任務失敗。':'狙いが外れた。');
  }
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#172724');grid(c,40,'#223732');
    label(c,'PRECISION / NON-LETHAL',35,32,C.green);
    c.save();c.translate(360,338);
    c.beginPath();c.moveTo(-55,-170);c.lineTo(-140,-123);c.lineTo(-168,81);c.lineTo(-117,88);c.lineTo(-93,-24);c.lineTo(-84,198);c.lineTo(83,198);c.lineTo(93,-24);c.lineTo(117,88);c.lineTo(168,81);c.lineTo(140,-123);c.lineTo(55,-170);c.closePath();
    c.fillStyle='#55756960';c.fill();c.strokeStyle='#89a395';c.lineWidth=2;c.stroke();
    circle(c,0,-209,44,'#54746555');circle(c,0,-209,44,'#89a395',true,2);
    for(let i=0;i<7;i++){
      c.beginPath();c.ellipse(-45,-81+i*23,47,12,-.12,0,Math.PI*1.6);c.strokeStyle='#80988955';c.stroke();
      c.beginPath();c.ellipse(45,-81+i*23,47,12,.12,-.6,Math.PI);c.stroke();
    }
    line(c,[[0,-132],[0,106]],'#8da99b',4);c.restore();
    const pulse=1+Math.sin(this.elapsed*9)*.05;
    c.save();c.translate(this.hx,this.hy);c.scale(pulse,pulse);c.shadowColor=C.red;c.shadowBlur=20;
    c.beginPath();c.moveTo(0,19);c.bezierCurveTo(-39,-4,-23,-32,0,-15);c.bezierCurveTo(23,-32,39,-4,0,19);c.fillStyle=C.red;c.fill();c.restore();
    const tx=this.hx+this.side*65;
    cross(c,tx,this.hy,21,C.paper);
    line(c,[[tx+this.side*30,this.hy],[tx+this.side*100,this.hy]],C.paper);
    text(c,'ここを狙え',tx+this.side*98,this.hy-21,15,C.paper);
    cross(c,this.ax,this.ay,10,'#d6b77977');
    rect(c,201,565,318,42,'#0c1916',3);text(c,'心臓は、撃つな。',360,587,20,C.red,'center',600);vignette(c);
  }
}

class Memory extends Round {
  id='memory' as const;
  hint='写真を3秒で覚える。服、床、時計、人の数に注目。';
  private floor=pick([{name:'深い赤',hex:'#824c46'},{name:'グレー',hex:'#7d817c'},{name:'ベージュ',hex:'#b2a083'},{name:'緑',hex:'#647e65'}]);
  private uniform=pick([{name:'青',hex:'#4b7b9d'},{name:'オレンジ',hex:'#c37d42'},{name:'緑',hex:'#668c67'},{name:'白',hex:'#dbd8c6'}]);
  private time=pick([{name:'10時10分',h:10,m:10},{name:'3時00分',h:3,m:0},{name:'8時20分',h:8,m:20},{name:'12時30分',h:12,m:30}]);
  private count=pick([5,6,7,8]);
  private question=rand(4);private options:string[]=[];private answer='';
  private viewTime=3;
  constructor(api:Api,stage:number){
    super(api,stage);this.viewTime=3/this.speed;this.duration=10/this.speed;
    const data=[
      {answer:this.floor.name,options:['深い赤','グレー','ベージュ','緑']},
      {answer:this.uniform.name,options:['青','オレンジ','緑','白']},
      {answer:this.time.name,options:['10時10分','3時00分','8時20分','12時30分']},
      {answer:`${this.count}人`,options:['5人','6人','7人','8人']},
    ][this.question];
    this.answer=data.answer;this.options=shuffle(data.options);
  }
  controls(){return this.elapsed<this.viewTime?[]:this.options.map((label,i)=>({label,action:`choice-${i}`,key:String(i+1)}));}
  action(s:string){if(this.elapsed<this.viewTime||!s.startsWith('choice-'))return;const yes=this.options[Number(s.slice(7))]===this.answer;this.end(yes,yes?'記憶は、正確だった。':`正解は「${this.answer}」。細部を見逃すな。`);}
  draw(c:CanvasRenderingContext2D){
    const viewing=this.elapsed<this.viewTime;
    this.hint=viewing?`写真を${this.viewTime.toFixed(1)}秒で覚える。服、床、時計、人の数に注目。`:'正しい答えをひとつ選ぶ';
    rect(c,0,0,W,H,'#1c231e');label(c,'ARCHIVE / CABINET PORTRAIT',30,30,C.gold);
    if(!viewing){
      grid(c,48,'#253229');
      const questions=['階段・床の色は？','整備士の服の色は？','時計が示していた時刻は？','写真に写っていたのは何人？'];
      text(c,'RECALL THE DETAILS',360,180,14,C.gold);text(c,'?',360,292,116,'#485a47');
      text(c,questions[this.question],360,423,30,C.paper,'center',600);
      text(c,'たった3秒。何が見えていた？',360,483,17,C.muted);return;
    }
    rect(c,38,69,644,511,'#c6c0a9',3);rect(c,50,81,620,487,'#9eaa99');
    for(let i=0;i<7;i++)rect(c,50+i*96,81,42,260,'#bfc3ad');
    rect(c,222,81,278,222,'#4b5d52');rect(c,234,90,254,213,'#53695c');
    line(c,[[360,92],[360,303]],'#243c31',3);
    circle(c,563,151,43,'#d8d5bd');circle(c,563,151,38,'#414d43',true,2);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;line(c,[[563+Math.sin(a)*31,151-Math.cos(a)*31],[563+Math.sin(a)*35,151-Math.cos(a)*35]],'#414d43',2);}
    const ha=(this.time.h%12+this.time.m/60)*Math.PI/6, ma=this.time.m*Math.PI/30;
    line(c,[[563,151],[563+Math.sin(ha)*22,151-Math.cos(ha)*22]],'#27372d',4);
    line(c,[[563,151],[563+Math.sin(ma)*31,151-Math.cos(ma)*31]],'#27372d',2);
    c.save();c.beginPath();c.rect(50,81,620,487);c.clip();
    const shade=(factor:number)=>`rgb(${[1,3,5].map(i=>Math.round(parseInt(this.floor.hex.slice(i,i+2),16)*factor)).join(',')})`;
    rect(c,50,296,620,272,shade(.78));
    for(let i=0;i<6;i++){
      const x=140-i*18,y=296+i*42,right=720-x;
      c.beginPath();c.moveTo(x,y);c.lineTo(right,y);c.lineTo(right+18,y+19);c.lineTo(x-18,y+19);c.closePath();
      c.fillStyle=shade(1.2);c.fill();
      const riser=c.createLinearGradient(0,y+19,0,y+42);
      riser.addColorStop(0,shade(.88));riser.addColorStop(1,shade(.64));
      c.fillStyle=riser;c.fillRect(x-18,y+19,right-x+36,23);
      line(c,[[x-18,y+19],[right+18,y+19]],'#f0e9d666',2);
      line(c,[[x,y],[x-18,y+19]],'#ffffff25');
      line(c,[[right,y],[right+18,y+19]],'#ffffff25');
    }
    for(let i=0;i<5;i++){
      const y=290+i*42,x=123-i*18;
      line(c,[[x,y],[x,y+40]],'#abb4a1',4);line(c,[[720-x,y],[720-x,y+40]],'#abb4a1',4);
    }
    line(c,[[123,290],[51,458]],'#d0d0b7',6);line(c,[[597,290],[669,458]],'#d0d0b7',6);
    for(let i=0;i<this.count-1;i++){
      const row=i<4?0:1, col=row?i-4:i;
      const x=row?280+col*92:205+col*102;
      const y=304+row*84;
      c.beginPath();c.ellipse(x,y+13,22,6,0,0,Math.PI*2);c.fillStyle='#17201755';c.fill();
      person(c,x,y,.84,row?'#323d3c':i%2?'#273038':'#424640',i%3?'#bd9c81':'#d0b398');
      c.save();c.translate(x,y);line(c,[[0,-53],[0,-29]],'#d8d6c0',4);line(c,[[0,-47],[0,-29]],'#7d413c',2);c.restore();
    }
    c.beginPath();c.ellipse(139,525,27,8,0,0,Math.PI*2);c.fillStyle='#17201766';c.fill();
    person(c,139,508,1.05,this.uniform.hex,'#b79475');
    rect(c,120,406,38,8,this.uniform.hex,3);rect(c,144,410,23,4,this.uniform.hex,2);
    rect(c,126,445,9,12,'#d8dec680',1);rect(c,143,445,9,12,'#d8dec650',1);
    line(c,[[125,481],[153,481]],'#37463e',4);
    c.save();c.translate(166,483);c.rotate(.35);
    line(c,[[0,12],[0,-33]],'#263a38',10);line(c,[[0,12],[0,-33]],'#d8e2dc',6);
    c.beginPath();
    [[-7,-30],[-14,-40],[-10,-53],[-5,-41],[5,-41],[10,-53],[14,-40],[7,-30]].forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.closePath();c.fillStyle='#e2e9e2';c.fill();
    circle(c,0,13,5,'#e2e9e2');circle(c,0,13,2,'#4b6259');c.restore();
    c.restore();
    rect(c,53,535,614,31,'#101a13b0');text(c,'記録写真  /  人物・衣服・床・時刻を記憶せよ',360,551,14,C.paper);
    text(c,`残り ${Math.max(1,Math.ceil(this.viewTime-this.elapsed))} 秒`,360,611,18,C.gold);vignette(c);
  }
}

type Walker={lane:number;z:number;color:string};
class Chase extends Round {
  id='chase' as const;
  hint='左右へ移動して人混みをよける。最後まで走り切れ。';
  private lane=1;private px=360;private walkers:Walker[]=[];private next=.1;
  constructor(api:Api,stage:number){super(api,stage);this.duration=8.5/this.speed;}
  controls(){return[{label:'左へ',action:'left',key:'←'},{label:'右へ',action:'right',key:'→'}];}
  action(s:string){if(s==='left')this.lane=Math.max(0,this.lane-1);if(s==='right')this.lane=Math.min(2,this.lane+1);}
  pointer(x:number){this.action(x<360?'left':'right');}
  protected update(dt:number){
    this.px+=(190+this.lane*170-this.px)*Math.min(1,dt*18);
    if(this.elapsed>=this.next&&this.elapsed<this.duration-2.6/this.speed){
      shuffle([0,1,2]).slice(0,this.stage>8?2:1).forEach(lane=>this.walkers.push({lane,z:0,color:pick(['#777260','#796075','#627b7c','#818574'])}));
      this.next=this.elapsed+1/this.speed;
    }
    this.walkers.forEach(w=>{
      const old=w.z;w.z+=dt*.39*this.speed;
      if(old<1&&w.z>=1&&Math.abs(this.px-(190+w.lane*170))<32)this.end(false,'人混みに行く手を阻まれた。');
    });
    this.walkers=this.walkers.filter(w=>w.z<1.18);
  }
  protected timeout(){this.end(true,'「失尾しました」');}
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#141d29');
    const sky=c.createLinearGradient(0,0,0,500);sky.addColorStop(0,'#182336');sky.addColorStop(1,'#443c45');c.fillStyle=sky;c.fillRect(0,0,W,450);
    rect(c,0,104,130,400,'#242d37');rect(c,590,64,130,449,'#242b34');rect(c,124,180,83,240,'#31333b');rect(c,516,161,80,270,'#303440');
    rect(c,203,232,54,202,'#232f38');rect(c,465,220,54,212,'#27333c');
    [[30,151,52,128,'#c16670','酒場'],[630,100,48,176,'#497c87','珈琲'],[143,231,40,112,'#a18f61','夜市'],[538,206,36,121,'#8f688a','食堂']].forEach(a=>{
      const [x,y,w,h,col,s]=a as [number,number,number,number,string,string];rect(c,x,y,w,h,col,2);[...s].forEach((ch,i)=>text(c,ch,x+w/2,y+31+i*39,24,'#f1e6c9','center',600));
    });
    for(let side=0;side<2;side++)for(let i=0;i<4;i++)rect(c,side?690-i*28:9+i*29,323+i*10,16,53,'#d2ad7060',1);
    c.beginPath();c.moveTo(285,278);c.lineTo(435,278);c.lineTo(720,640);c.lineTo(0,640);c.closePath();c.fillStyle='#303436';c.fill();
    [0,1,2,3].forEach(i=>line(c,[[285+i*50,278],[-85+i*296,640]],'#81806d',i===0||i===3?2:1));
    for(let i=0;i<9;i++){
      const z=((i/9+this.elapsed*.16)%1), y=278+Math.pow(z,1.8)*362;
      line(c,[[360-z*260,y],[360+z*260,y]],'#79716640',2);
    }
    [...this.walkers].sort((a,b)=>a.z-b.z).forEach(w=>{
      const z=Math.pow(w.z,1.55),x=360+(w.lane-1)*(35+z*135),y=292+z*290;
      circle(c,x,y+5,10+z*24,'#00000045');person(c,x,y,.25+z*1.15,w.color,'#b8a18d',Math.sin(this.elapsed*12)*4);
    });
    circle(c,this.px,602,35,'#00000075');person(c,this.px,566,1.05,'#141c24','#5b625d',Math.sin(this.elapsed*17)*9);
    label(c,'PURSUIT / DOWNTOWN',28,29,C.paper);
    rect(c,268,75,184,34,'#152020bb',3);text(c,'追跡を振り切れ',360,93,15,C.gold);vignette(c);
  }
}

class Eat extends Round {
  id='eat' as const;
  hint='画面を連打して、チャーハンを食べ切る';
  private portions=0; private bite=0;
  private grains:{x:number;y:number;vx:number;vy:number;life:number}[]=[];
  constructor(api:Api,stage:number){super(api,stage);this.duration=5.5/this.speed;}
  controls(){return[{label:'食べる',action:'primary',key:'SPACE'}];}
  action(s:string){
    if(s!=='primary'||this.ended)return;this.portions++;this.bite=.2;this.api.sound('tap');
    for(let i=0;i<7;i++)this.grains.push({x:360,y:375,vx:(Math.random()-.5)*220,vy:-80-Math.random()*150,life:.55});
    if(this.portions>=10)this.end(true,'10人前、完食。ごっつぁんです。');
  }
  pointer(){this.action('primary');}
  protected update(dt:number){this.bite=Math.max(0,this.bite-dt);this.grains=this.grains.filter(g=>g.life>0);this.grains.forEach(g=>{g.life-=dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.vy+=420*dt;});}
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#292d23');
    for(let i=0;i<6;i++){rect(c,35+i*115,40,105,369,'#4b4d37');for(let j=0;j<4;j++)rect(c,40+i*115,45+j*90,95,80,'#9b987130');}
    label(c,'REFUEL / TEN SERVINGS',30,28,C.gold);
    rect(c,555,79,76,190,'#d7c89c',2);text(c,'炒',593,126,38,'#414735','center',600);text(c,'飯',593,179,38,'#414735','center',600);text(c,'十人前',593,235,15,'#414735');
    const bounce=this.bite>0?Math.sin(this.bite/.2*Math.PI)*8:0;
    c.save();c.translate(0,bounce);
    c.beginPath();c.ellipse(358,434,143,152,0,Math.PI,0);c.lineTo(506,528);c.lineTo(208,528);c.closePath();c.fillStyle='#d0ae46';c.fill();
    c.beginPath();c.moveTo(282,316);c.lineTo(358,445);c.lineTo(433,316);c.lineTo(407,310);c.lineTo(358,392);c.lineTo(308,310);c.closePath();c.fillStyle='#f1d376';c.fill();
    rect(c,223,492,276,31,'#6b6f4c');line(c,[[358,442],[358,490]],'#ad8e36',3);
    circle(c,358,238,89,'#caa281');circle(c,269,248,15,'#caa281');circle(c,447,248,15,'#caa281');
    c.beginPath();c.ellipse(358,180,77,42,0,Math.PI,Math.PI*2);c.fillStyle='#22291f';c.fill();
    rect(c,339,130,39,14,'#22291f',7);rect(c,351,117,39,15,'#22291f',7);
    line(c,[[309,225],[335,222]],'#3e3929',4);line(c,[[383,222],[409,225]],'#3e3929',4);
    line(c,[[319,234],[329,234]],'#383a2b',3);line(c,[[389,234],[399,234]],'#383a2b',3);
    c.beginPath();c.ellipse(358,285,18,this.bite>0?15:5,0,0,Math.PI*2);c.fillStyle='#6d4633';c.fill();
    circle(c,301,264,15,'#bd82683b');circle(c,415,264,15,'#bd82683b');
    line(c,[[243,388],[302,399],[329,368]],'#dfbd64',36);circle(c,330,365,17,'#caa281');
    line(c,[[335,364],[366,305]],'#d4d6c4',6);c.beginPath();c.ellipse(368,302,10,17,.4,0,Math.PI*2);c.fillStyle='#d4d6c4';c.fill();
    c.restore();
    rect(c,0,508,W,132,'#564735');rect(c,0,508,W,8,'#89734f');
    c.beginPath();c.ellipse(360,524,115,29,0,0,Math.PI*2);c.fillStyle='#dfd9bf';c.fill();
    if(this.portions<10){
      c.beginPath();c.ellipse(360,516,83-(this.portions*5),Math.max(6,34-this.portions*3),0,Math.PI,0);c.fillStyle='#cead62';c.fill();
      for(let i=0;i<28;i++){const x=360+Math.sin(i*2.4)*(68-this.portions*4),y=510-Math.abs(Math.cos(i*1.7))*(24-this.portions*2);rect(c,x,y,5,3,i%4===0?'#798550':i%5===0?'#ba7050':'#e6c579',1);}
    }
    text(c,'TAP TO EAT',360,589,14,C.gold);
    this.grains.forEach(g=>rect(c,g.x,g.y,5,3,'#e6c579',1));vignette(c);
  }
}

export function createRound(id:GameId,api:Api,stage:number):Round {
  const classes={knife:Knife,map:Find,knock:Knock,laser:Laser,aim:Aim,memory:Memory,chase:Chase,eat:Eat};
  return new classes[id](api,stage);
}
