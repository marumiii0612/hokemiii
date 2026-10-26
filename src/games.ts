import japan from './data/japan.json';
import okinawa from './data/okinawa.json';
import {musicFiles} from './music-files';
import { C, W, H, rect, text, line, circle, grid, cross, person, vignette, rand, pick, shuffle } from './draw';

export type GameId = 'knife' | 'map' | 'knock' | 'laser' | 'aim' | 'memory' | 'chase' | 'eat' | 'files';
export type Control = { label: string; action: string; key?: string };
type Api = { finish: (ok: boolean, message: string) => void; sound?: (kind: 'tap'|'shoot'|'warning') => void };
export const missions: { id: GameId; title: string; sub: string; icon: string }[] = [
  {id:'knife',title:'刺せ',sub:'バナナが中央に来たら、ナイフを投げろ。チャンスは一度。',icon:'↟'},
  {id:'map',title:'見つけろ',sub:'日本地図の間違いを見つけて、その場所をタップ。',icon:'⌖'},
  {id:'knock',title:'伝えろ',sub:'紙の5桁の認証コードを覚え、自分・相手・自分・相手・自分でノック。',icon:'⠿'},
  {id:'laser',title:'避けろ',sub:'4列の縦レーザーを左右によけ、下の横レーザーはジャンプ。',icon:'╳'},
  {id:'aim',title:'狙え',sub:'中央から真上に1発。動く白い照準を狙え。心臓は撃つな。',icon:'⊕'},
  {id:'memory',title:'覚えろ',sub:'短時間だけ表示される写真を記憶し、続く質問に答えろ。',icon:'◷'},
  {id:'chase',title:'撒け',sub:'3列の人混みを左右によけ、追っ手を振り切れ。',icon:'⇄'},
  {id:'eat',title:'食べろ',sub:'黄色い和服の大男。10人前のチャーハンを食べ切れ。',icon:'◒'},
  {id:'files',title:'鳴らせ',sub:'音楽フォルダからBEPPAN.mp3を開け。',icon:'♫'},
];
export const MISSIONS_PER_LOOP=missions.length;

export abstract class Round {
  abstract id: GameId;
  elapsed=0;
  protected ended=false;
  duration=8;
  successDuration=1.05;
  abstract hint: string;
  protected speed: number;
  protected get loop(){return Math.floor((this.stage-1)/MISSIONS_PER_LOOP);}
  constructor(protected api: Api, public stage: number) { this.speed=Math.min(2.4,1+this.loop*.2); }
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
  action(s:string) { if(s==='primary'&&!this.thrown&&!this.ended){ this.thrown=true; this.api.sound?.('shoot'); } }
  pointer() { this.action('primary'); }
  draw(c: CanvasRenderingContext2D) {
    rect(c,0,0,W,H,'#202a25'); grid(c,60,'#2b3730');
    rect(c,42,56,636,530,'#17211c',2);
    line(c,[[70,293],[650,293]],'#354437');
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
    vignette(c);
  }
}

type Place={name:string;x:number;y:number;rx:number;ry:number};
const places:Place[]=[
  {name:'四国',x:213,y:442,rx:63,ry:38},
  {name:'滋賀県',x:300,y:394,rx:30,ry:32},
  {name:'佐渡島',x:379,y:303,rx:26,ry:30},
  {name:'沖縄',x:-3,y:708,rx:165,ry:80},
];
const mapFeatures=[...japan,...okinawa];
const mapLayout=(()=>{
  const points=mapFeatures.flatMap(feature=>feature.rings.flat());
  const minX=Math.min(...points.map(([x])=>x)),maxX=Math.max(...points.map(([x])=>x));
  const minY=Math.min(...points.map(([,y])=>y)),maxY=Math.max(...points.map(([,y])=>y));
  const scale=Math.min(640/(maxX-minX),490/(maxY-minY));
  return {scale,x:(W-(maxX-minX)*scale)/2-minX*scale,y:66-minY*scale};
})();
class Find extends Round {
  id='map' as const;
  hint='地図の間違っている場所をタップ';
  private target=rand(places.length);
  constructor(api:Api, stage:number){
    super(api,stage); this.duration=10/this.speed;
  }
  private answer(correct:boolean){
    const name=places[this.target].name;
    this.end(correct,correct?`${name}の異変を発見。`:'異変を見つけられなかった。');
  }
  pointer(x:number,y:number){
    const p=places[this.target];
    const px=mapLayout.x+p.x*mapLayout.scale,py=mapLayout.y+p.y*mapLayout.scale;
    const rx=Math.max(58,p.rx*mapLayout.scale+18),ry=Math.max(58,p.ry*mapLayout.scale+18);
    this.answer(((x-px)/rx)**2+((y-py)/ry)**2<=1);
  }
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#17292d'); grid(c,48,'#1f3539');
    c.save();
    c.translate(mapLayout.x,mapLayout.y);c.scale(mapLayout.scale,mapLayout.scale);
    mapFeatures.forEach(feature=>{
      if(this.target===0&&[36,37,38,39].includes(feature.id))return;
      if(this.target===1&&feature.id===25)return;
      if(this.target===2&&feature.sado)return;
      if(this.target===3&&feature.id===47)return;
      c.beginPath();
      feature.rings.forEach(r=>{r.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();});
      c.fillStyle='#a4ad88'; c.fill('evenodd'); c.strokeStyle='#6c7b68'; c.lineWidth=.8/mapLayout.scale; c.stroke();
    });
    c.restore();
    line(c,[[628,87],[628,132]],C.paper);text(c,'N',628,69,15,C.paper);text(c,'▲',628,86,13,C.paper);
  }
}

class Knock extends Round {
  id='knock' as const;
  successDuration=1.45;
  hint='紙の5桁の認証コードを覚えろ。消えたらノック。';
  private code=Array.from({length:5},()=>Math.min(6,2+this.loop)+rand(4));
  private turn=0; private taps=0; private delay=0; private lastAuto=0; private ripples:number[]=[];
  private feintTurn=-1;
  private doorOpening=0;
  private paper?:HTMLCanvasElement;
  private dust:{x:number;y:number;release:number;drift:number;size:number;color:string}[]=[];
  private get knocking(){return this.elapsed>=4/this.speed;}
  constructor(api:Api,stage:number){
    super(api,stage);this.duration=20/this.speed;
    if(this.loop>0&&Math.random()<.4)this.feintTurn=pick([1,3]);
  }
  controls(){return !this.knocking||this.turn===5?[]:[{label:this.turn%2?'応答を待て…':'ノック',action:'primary',key:'SPACE'}];}
  animateSuccess(dt:number){if(this.turn===5)this.doorOpening=Math.min(1,this.doorOpening+dt/.8);}
  protected update(dt:number){
    if(!this.knocking){
      this.hint=this.elapsed<3/this.speed?'紙の5桁の認証コードを覚えろ。消えたらノック。':'紙が消える。覚えたコードを、自分・相手の順で。';
      return;
    }
    this.hint='記憶した回数だけノック。相手の番に叩くと失敗。';
    this.ripples=this.ripples.map(r=>r+dt).filter(r=>r<.7);
    if(this.delay>0){this.delay-=dt;if(this.delay<=0){this.turn++;this.taps=0;this.lastAuto=this.elapsed;if(this.turn===5)this.end(true,'認証コード、照合完了。');}return;}
    const autoInterval=(this.turn===this.feintTurn&&this.taps===this.code[this.turn]-1?1.05:.32)/this.speed;
    if(this.turn%2&&this.elapsed-this.lastAuto>autoInterval){this.lastAuto=this.elapsed;this.knock();}
  }
  private knock(){this.taps++;this.api.sound?.('tap');this.ripples.push(0);if(this.taps===this.code[this.turn])this.delay=.55/this.speed;}
  action(s:string){
    if(s!=='primary'||!this.knocking||this.ended)return;
    if(this.turn%2){this.end(false,'相手の応答中にノックした。');return;}
    if(this.delay>0){this.end(false,'ノックが多い。認証コード不一致。');return;}
    this.knock();
  }
  pointer(){this.action('primary');}
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#19201d');
    const g=c.createRadialGradient(360,300,50,360,300,470);g.addColorStop(0,'#434433');g.addColorStop(1,'#141a17');c.fillStyle=g;c.fillRect(0,0,W,H);
    this.drawDoor(c);
    if(!this.knocking){
      rect(c,0,0,W,H,'#111915ae');
      this.drawPaper(c,Math.max(0,this.elapsed*this.speed-3));
    }else{
      for(let i=0;i<5;i++){
        const active=i===this.turn;
        rect(c,177+i*77,80,60,46,active?(this.turn%2?'#4e6d75':'#c7b180'):'#26302b',3);
        text(c,i%2?'相手':'自分',207+i*77,104,16,active?C.ink:i<this.turn?C.green:C.muted,'center',600);
      }
    }
    if(this.knocking&&this.turn<5){
      this.ripples.forEach(r=>{circle(c,347,451,18+r*100,`rgba(221,198,143,${.7-r})`,true,2);});
      rect(c,223,543,274,54,'#17201be8',3);
      text(c,this.turn%2?'相手の番':'あなたの番',360,569,23,this.turn%2?C.blue:C.gold,'center',600);
    }
    vignette(c);
  }
  private grainNoise(seed:number){const value=Math.sin(seed*127.1+311.7)*43758.5453;return value-Math.floor(value);}
  private preparePaper(){
    const paper=document.createElement('canvas');paper.width=480;paper.height=280;
    const c=paper.getContext('2d')!;
    rect(c,0,0,480,280,'#e9dfc2');
    const shade=c.createLinearGradient(0,0,480,280);
    shade.addColorStop(0,'#fff9e142');shade.addColorStop(.5,'#a78c5620');shade.addColorStop(1,'#fff9e130');
    c.fillStyle=shade;c.fillRect(0,0,480,280);
    for(let i=0;i<650;i++)rect(c,this.grainNoise(i)*480,this.grainNoise(i+700)*280,1,1,'#79694f23');
    line(c,[[238,0],[241,280]],'#a6936525');line(c,[[240,0],[243,280]],'#fff8df65');
    line(c,[[30,96],[450,96]],'#9f8c63',1);
    text(c,'認証コード',240,62,27,'#352f24','center',600);
    this.code.forEach((digit,i)=>text(c,String(digit),96+i*72,151,54,'#29291f','center',600));
    c.beginPath();c.moveTo(449,0);c.lineTo(480,31);c.lineTo(449,31);c.closePath();c.fillStyle='#c1b492';c.fill();
    const pixels=c.getImageData(0,0,480,280).data;
    // Fixed grain patterns keep the animation stable without consuming game randomness.
    this.dust=Array.from({length:1100},(_,i)=>{
      const x=Math.floor(this.grainNoise(i+1500)*480),y=Math.floor(this.grainNoise(i+3000)*280);
      const column=Math.floor(x/4),start=this.grainNoise(column+4500)*.14;
      const at=(y*480+x)*4;
      return{x,y,release:start+y/280*.65,drift:140+this.grainNoise(i+6000)*220,size:1.5+this.grainNoise(i+7500)*2,
        color:`rgb(${pixels[at]},${pixels[at+1]},${pixels[at+2]})`};
    });
    this.paper=paper;
  }
  private drawPaper(c:CanvasRenderingContext2D,progress:number){
    if(!this.paper)this.preparePaper();
    c.save();c.translate(360,313);c.rotate(-.035);c.translate(-240,-140);
    if(progress===0){
      c.shadowColor='#0009';c.shadowBlur=30;c.shadowOffsetY=12;c.drawImage(this.paper!,0,0);
      c.shadowBlur=0;c.shadowOffsetY=0;
    }else{
      // Erode narrow strips from the top, then let their grains drift downwind.
      c.save();c.beginPath();
      for(let column=0;column<120;column++){
        const start=this.grainNoise(column+4500)*.14;
        const edge=Math.max(0,Math.min(280,(progress-start)/.65*280));
        if(column===0)c.moveTo(0,edge);else c.lineTo(column*4,edge);
        c.lineTo((column+1)*4,edge);
      }
      c.lineTo(480,280);c.lineTo(0,280);c.closePath();c.clip();c.drawImage(this.paper!,0,0);c.restore();
      this.dust.forEach(grain=>{
        const age=progress-grain.release;
        if(age<0||age>.35)return;
        c.globalAlpha=(1-age/.35)*Math.min(1,(1-progress)*8);
        c.fillStyle=grain.color;
        c.fillRect(grain.x+age*grain.drift,grain.y+age*age*740,grain.size,grain.size);
      });
    }
    c.restore();
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
  hint='左右で移動、中央でジャンプ。← → / ↑・Space';
  private lanes=[150,290,430,570];
  private lane=1; private px=290; private wave=-1; private danger:number[]=[];
  private groundLaser=false;
  private period=1.65; private cycleDuration=1.65; private phase=0;
  private readonly warningExtra=.3;
  private jumping=false; private jumpTime=0; private jumpHeight=0; private jumpDuration=1.2;
  constructor(api:Api,stage:number){
    super(api,stage);
    const recovery=.6;
    this.cycleDuration=1.65/this.speed;this.period=this.cycleDuration+this.warningExtra+recovery;
    this.duration=7/this.speed+4*this.warningExtra+3*recovery;
    this.jumpDuration=1.2/this.speed+.45;
  }
  controls(){return[{label:'左へ',action:'left',key:'←'},{label:'ジャンプ',action:'jump',key:'↑ / SPACE'},{label:'右へ',action:'right',key:'→'}];}
  action(s:string){
    if(this.ended)return;
    if(s==='left')this.lane=Math.max(0,this.lane-1);
    if(s==='right')this.lane=Math.min(this.lanes.length-1,this.lane+1);
    if(['jump','up','primary'].includes(s)&&!this.jumping){this.jumping=true;this.jumpTime=0;this.api.sound?.('tap');}
  }
  pointer(x:number){this.action(x<240?'left':x>480?'right':'jump');}
  private get firing(){return this.wave>=0&&this.phase>(this.groundLaser ? .45 : .57)&&this.phase<(this.groundLaser ? .65 : .77);}
  protected update(dt:number){
    const previousX=this.px;
    this.px+=(this.lanes[this.lane]-this.px)*Math.min(1,dt*18);
    if(this.jumping){
      this.jumpTime+=dt;
      const progress=Math.min(1,this.jumpTime/this.jumpDuration);
      this.jumpHeight=112*4*progress*(1-progress);
      if(progress>=1){this.jumping=false;this.jumpHeight=0;}
    }
    const t=this.elapsed-.6/this.speed;if(t<0)return;
    const w=Math.floor(t/this.period); this.phase=Math.max(0,(t%this.period-this.warningExtra)/this.cycleDuration);
    if(w!==this.wave){
      this.wave=w;this.groundLaser=w%2===1;
      const combined=this.groundLaser&&this.loop>0&&(w%4===3||this.loop>1);
      this.danger=!this.groundLaser||combined?shuffle([0,1,2,3]).slice(0,this.loop>0?2:1):[];
      this.hint=combined?'縦線をよけながらジャンプ。左右移動＋中央タップ / ↑・Space':this.groundLaser?'下の横レーザーはジャンプ。中央タップ / ↑・Space':'縦レーザーは左右によける。左右タップ / ← →';
      this.api.sound?.('warning');
    }
    if(this.phase>=1){this.hint='次の予告を待て。';return;}
    if(this.firing){
      const verticalHit=this.danger.some(lane=>this.lanes[lane]>=Math.min(previousX,this.px)-28&&this.lanes[lane]<=Math.max(previousX,this.px)+28);
      if((this.groundLaser&&this.jumpHeight<36)||verticalHit)this.end(false,'レーザーに触れた。');
    }
  }
  protected timeout(){this.end(true,'セキュリティを突破した。');}
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#111b20');
    const vx=360,vy=130;
    for(let i=0;i<8;i++){const y=200+i*i*8;line(c,[[40,y],[680,y]],'#28373c');}
    for(let x=-500;x<1300;x+=200)line(c,[[vx,vy],[x,H]],'#28373c');
    rect(c,64,62,592,109,'#1c2a2e');line(c,[[64,171],[656,171]],'#587275',2);
    this.lanes.forEach((x,i)=>{
      rect(c,x-45,77,90,68,'#0e171a',4);circle(c,x,112,8,this.phase<1&&this.danger.includes(i)?C.red:'#54766f');
      text(c,`0${i+1}`,x,197,15,C.muted);
      if(this.danger.includes(i)){
        const on=this.firing;
        if(this.phase<(this.groundLaser ? .45 : .57)||on){
          c.save(); c.globalAlpha=on?1:.2+.2*Math.sin(this.elapsed*24);
          rect(c,x-46,226,92,360,'#e5534022');
          c.shadowColor=C.red;c.shadowBlur=on?25:0;line(c,[[x,168],[x,604]],on?'#ffcead':C.red,on?9:2);
          c.restore(); if(!on)text(c,'!',x,271,24,C.red,'center',700);
        }
      }
    });
    if(this.groundLaser&&this.phase<.65){
      const on=this.firing;
      rect(c,59,510,28,33,'#24373b',3);rect(c,633,510,28,33,'#24373b',3);
      circle(c,75,526,6,C.red);circle(c,645,526,6,C.red);
      c.save();c.globalAlpha=on?1:.4+.2*Math.sin(this.elapsed*24);
      rect(c,88,512,544,29,'#e5534022');
      if(!on)c.setLineDash([13,10]);
      c.shadowColor=C.red;c.shadowBlur=on?26:0;
      line(c,[[88,526],[632,526]],on?'#ffcead':C.red,on?9:3);c.restore();
    }
    c.beginPath();c.ellipse(this.px,557,32-this.jumpHeight*.1,9-this.jumpHeight*.025,0,0,Math.PI*2);c.fillStyle='#00000070';c.fill();
    person(c,this.px,521-this.jumpHeight,1.25,'#080c11','#161d22',this.jumping?-5:Math.sin(this.elapsed*9)*4);
    line(c,[[this.px-8,412-this.jumpHeight],[this.px+8,412-this.jumpHeight]],'#7b8888',3);
    vignette(c);
  }
}

class Aim extends Round {
  id='aim' as const;
  hint='弾は中央から真上へ。動きを読んでタップ / Space';
  private baseHx=340+rand(41); private baseHy=262+rand(25);
  private hx=this.baseHx; private hy=this.baseHy;
  private offsetX=0; private offsetY=0;
  private shot=false; private bulletY=559;
  private side=Math.random()<.5?-1:1;
  constructor(api:Api,stage:number){super(api,stage);this.duration=6/this.speed;}
  protected update(dt:number){
    const previousHx=this.hx,previousHy=this.hy;
    const time=this.elapsed*this.speed;
    this.offsetX=Math.sin(time*2)*92*this.side;
    this.offsetY=Math.sin(time*3.1)*14;
    this.hx=this.baseHx+this.offsetX;this.hy=this.baseHy+this.offsetY;
    if(!this.shot)return;
    const previousY=this.bulletY;this.bulletY-=1030*dt;
    // Sweep the bullet relative to the moving target so fast frames cannot skip a hit.
    const impact=(offset:number,radius:number)=>{
      const x0=360-previousHx-offset,y0=previousY-previousHy;
      const dx=previousHx-this.hx,dy=this.bulletY-previousY+previousHy-this.hy;
      const a=dx*dx+dy*dy,b=2*(x0*dx+y0*dy),c=x0*x0+y0*y0-radius*radius;
      if(c<=0)return 0;
      const discriminant=b*b-4*a*c;
      if(a===0||discriminant<0)return Infinity;
      const entry=(-b-Math.sqrt(discriminant))/(2*a);
      return entry>=0&&entry<=1?entry:Infinity;
    };
    const heart=impact(0,32),target=impact(this.side*65,23);
    const first=Math.min(heart,target);
    if(Number.isFinite(first)){
      this.bulletY=previousY+(this.bulletY-previousY)*first;
      this.end(target<heart,target<heart?'急所を外し、正確に制圧。':'心臓に命中。任務失敗。');
    }else if(this.bulletY<-24)this.end(false,'狙いが外れた。');
  }
  controls(){return[{label:'撃つ',action:'primary',key:'SPACE'}];}
  pointer(){this.action('primary');}
  action(s:string){
    if(s!=='primary'||this.ended||this.shot)return;
    this.shot=true;this.api.sound?.('shoot');
  }
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#172724');grid(c,40,'#223732');
    c.save();c.setLineDash([5,8]);line(c,[[360,70],[360,549]],'#a4b19a66',1.5);c.restore();
    c.save();c.translate(360+this.offsetX,338+this.offsetY);
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
    rect(c,343,585,34,30,'#101a19',4);rect(c,350,567,20,30,'#56665e',3);
    rect(c,354,559,12,29,'#c5ccb6',2);line(c,[[360,566],[360,585]],'#6e7a69',2);
    if(this.shot){
      line(c,[[360,this.bulletY+27],[360,this.bulletY+9]],'#d4b98066',2);
      rect(c,357,this.bulletY-9,6,18,C.gold,3);
    }
    vignette(c);
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
  action(s:string){if(this.elapsed<this.viewTime||!s.startsWith('choice-'))return;const yes=this.options[Number(s.slice(7))]===this.answer;this.end(yes,yes?'記憶は、正確だった。':'記憶が一致しなかった。');}
  draw(c:CanvasRenderingContext2D){
    const viewing=this.elapsed<this.viewTime;
    this.hint=viewing?`写真を${this.viewTime.toFixed(1)}秒で覚える。服、床、時計、人の数に注目。`:'正しい答えをひとつ選ぶ';
    rect(c,0,0,W,H,'#1c231e');
    if(!viewing){
      grid(c,48,'#253229');
      const questions=['階段・床の色は？','整備士の服の色は？','時計が示していた時刻は？','写真に写っていたのは何人？'];
      text(c,'?',360,292,116,'#485a47');
      text(c,questions[this.question],360,423,30,C.paper,'center',600);
      return;
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
      shuffle([0,1,2]).slice(0,this.loop>0?2:1).forEach(lane=>this.walkers.push({lane,z:0,color:pick(['#777260','#796075','#627b7c','#818574'])}));
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
    vignette(c);
  }
}

class Eat extends Round {
  id='eat' as const;
  hint='画面を連打して、チャーハンを食べ切る';
  private portions=0; private bite=0;
  private grains:{x:number;y:number;vx:number;vy:number;life:number}[]=[];
  private flyingServingAge:number|null=null;
  constructor(api:Api,stage:number){super(api,stage);this.duration=5.5/this.speed;}
  controls(){return[{label:'食べる',action:'primary',key:'SPACE'}];}
  action(s:string){
    if(s!=='primary'||this.ended)return;this.portions++;this.bite=.2;this.api.sound?.('tap');
    for(let i=0;i<7;i++)this.grains.push({x:360,y:375,vx:(Math.random()-.5)*220,vy:-80-Math.random()*150,life:.55});
    if(this.portions>=10){
      if(this.loop>0)this.flyingServingAge=0;
      this.end(true,'10人前、完食。ごっつぁんです。');
    }
  }
  pointer(){this.action('primary');}
  protected update(dt:number){
    this.bite=Math.max(0,this.bite-dt);
    this.grains=this.grains.filter(g=>g.life>0);this.grains.forEach(g=>{g.life-=dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.vy+=420*dt;});
    if(this.flyingServingAge!==null){
      this.flyingServingAge+=dt*this.speed;
      if(this.flyingServingAge>=1.1)this.flyingServingAge=null;
    }
  }
  animateSuccess(dt:number){this.update(dt);}
  private drawFlyingServing(c:CanvasRenderingContext2D){
    if(this.flyingServingAge===null)return;
    const progress=this.flyingServingAge/1.1;
    c.save();
    c.translate(W+85-(W+170)*progress,430-300*progress*(1-progress));
    c.rotate(-.2-progress*Math.PI*3);
    c.shadowColor='#0007';c.shadowBlur=12;c.shadowOffsetY=7;
    c.beginPath();c.ellipse(0,0,64,18,0,0,Math.PI*2);c.fillStyle='#dfd9bf';c.fill();
    c.shadowBlur=0;c.shadowOffsetY=0;
    c.beginPath();c.ellipse(0,-2,57,13,0,0,Math.PI*2);c.strokeStyle='#9caa9c';c.lineWidth=2;c.stroke();
    c.beginPath();c.ellipse(0,-7,43,25,0,Math.PI,0);c.fillStyle='#cead62';c.fill();
    for(let i=0;i<24;i++){
      const x=Math.sin(i*2.4)*36,y=-9-Math.abs(Math.cos(i*1.7))*20;
      rect(c,x,y,5,3,i%4===0?'#798550':i%5===0?'#ba7050':'#e6c579',1);
    }
    c.restore();
  }
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#292d23');
    for(let i=0;i<6;i++){rect(c,35+i*115,40,105,369,'#4b4d37');for(let j=0;j<4;j++)rect(c,40+i*115,45+j*90,95,80,'#9b987130');}
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
    this.grains.forEach(g=>rect(c,g.x,g.y,5,3,'#e6c579',1));
    this.drawFlyingServing(c);vignette(c);
  }
}

class Files extends Round {
  id='files' as const;
  hint='音楽フォルダからファイルを開く';
  constructor(api:Api,stage:number){super(api,stage);this.duration=10/this.speed;}
  action(value:string){
    if(this.ended||!/^file-\d+$/.test(value))return;
    const file=musicFiles[Number(value.slice(5))];
    if(!file)return;
    this.end(file.correct,'');
  }
  draw(c:CanvasRenderingContext2D){
    rect(c,0,0,W,H,'#101820');
    const glow=c.createRadialGradient(360,300,60,360,300,480);
    glow.addColorStop(0,'#284453');glow.addColorStop(1,'#101820');
    c.fillStyle=glow;c.fillRect(0,0,W,H);
    rect(c,24,20,672,573,'#070b0f',12);rect(c,35,31,650,542,'#17232f',5);
    rect(c,35,31,650,34,'#293b4a',5);
    ['#b96568','#b9a265','#6f9e83'].forEach((color,i)=>circle(c,53+i*19,48,5,color));
    text(c,'mission.ts — secure-workspace',139,48,13,'#c4d1d8','left');
    rect(c,35,65,38,508,'#14202b');
    const code=[
      'import { decrypt, verify } from "secure-channel";',
      'const session = await connect({ encrypted: true });',
      'type Payload<T> = { nonce: Uint8Array; data: T };',
      'async function authenticate<T>(packet: Payload<T>) {',
      '  const key = await crypto.subtle.importKey(',
      '    "raw", packet.nonce, { name: "AES-GCM" },',
      '    false, ["decrypt"]',
      '  );',
      '  const bytes = await decrypt(key, packet.data);',
      '  if (!verify(bytes.signature)) throw new Error();',
      '  return bytes.buffer.slice(0, 0x100);',
      '}',
      'const channel = new Map<string, Uint8Array>();',
      'for await (const message of session.stream()) {',
      '  channel.set(message.id, await authenticate(message));',
      '}',
      '$ tsc --strict --noEmit && node mission.js',
      '[secure] connection established :: 0x7F3A',
      '[secure] integrity check passed',
    ];
    code.forEach((value,i)=>{
      text(c,String(i+1).padStart(2,'0'),61,83+i*25,11,'#557386','right');
      text(c,value,83,83+i*25,12,i>15?'#80b78b':i%3===0?'#b09abd':i%3===1?'#80afc2':'#a3b692','left');
    });
    rect(c,35,552,650,21,'#253b4d');text(c,'TypeScript    UTF-8    main',51,563,10,'#afc4d2','left');
    circle(c,360,583,3,'#77af94');rect(c,323,593,74,28,'#26333d',3);
    c.beginPath();c.ellipse(360,625,114,9,0,0,Math.PI*2);c.fillStyle='#34414a';c.fill();
    vignette(c);
  }
}

export function createRound(id:GameId,api:Api,stage:number):Round {
  const classes={knife:Knife,map:Find,knock:Knock,laser:Laser,aim:Aim,memory:Memory,chase:Chase,eat:Eat,files:Files};
  return new classes[id](api,stage);
}
