import { test, expect, type Page } from '@playwright/test';
import { tapCanvas } from './helpers';

async function deterministic(page:Page){
  await page.addInitScript(()=>{Math.random=()=>0;});
  await page.goto('/');
}
async function start(page:Page){await page.getByRole('button',{name:'はじめる',exact:true}).click();await expect(page.locator('#transition')).toBeHidden();}

test.describe('mobile touch input',()=>{
test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
test('mobile title, manual, direct map tap, one-miss failure and immediate restart',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await deterministic(page);
  await expect(page.getByRole('button',{name:'はじめる',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'遊び方を見る'}).click();
  await expect(page.locator('.manual-mission')).toHaveCount(8);
  await expect(page.getByText('食べろ',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'遊び方を閉じる'}).click();
  await start(page);
  await expect(page.locator('#controls')).toBeHidden();
  await expect(page.locator('#controls button')).toHaveCount(0);
  await tapCanvas(page,512,135);
  await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
  await expect(page.locator('#final-score')).toHaveText('0');
  await expect(page.locator('#result-rank')).toHaveText('あなたはKEKKANです');
  await expect(page.locator('#result-message')).toBeEmpty();
  await expect(page.locator('#result-message')).toBeHidden();
  await expect(page.locator('#result-screen')).not.toContainText('四国');
  await page.getByRole('button',{name:'もう一度、潜入する'}).click();
  await expect(page.locator('#stage-number')).toHaveText('01');
  await expect(page.locator('#result-screen')).toBeHidden();
  expect(errors).toEqual([]);
});

test('memory failure does not reveal the correct answer and supports immediate restart',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    let sample=0;
    // Put memory first in the shuffle, then use the red-floor photo.
    Math.random=()=>{sample++;return sample>=4&&sample<=7?.999:0;};
  });
  await page.clock.install();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.clock.runFor(1300);
  await expect(page.locator('#mission-title')).toHaveText('覚えろ。');
  await page.clock.runFor(3100);
  await page.locator('#controls').getByRole('button',{name:'グレー',exact:true}).click();
  await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
  await expect(page.locator('#result-message')).toBeEmpty();
  await expect(page.locator('#result-message')).toBeHidden();
  await expect(page.locator('#result-screen')).not.toContainText('深い赤');
  await expect(page.locator('#result-screen')).not.toContainText('正解');
  await expect(page.locator('#final-score')).toHaveText('0');
  await expect(page.locator('#result-rank')).toHaveText('あなたはKEKKANです');
  await page.getByRole('button',{name:'もう一度、潜入する'}).click();
  await expect(page.locator('#stage-number')).toHaveText('01');
  await expect(page.locator('#result-screen')).toBeHidden();
});

for(const scenario of [
  {name:'missing Shikoku',sample:0,x:330,y:336},
  {name:'missing Shiga',sample:.3,x:392,y:301},
  {name:'missing Sado',sample:.6,x:448,y:236},
  {name:'missing Okinawa',sample:.999999,x:176,y:525},
]){
  test(`Japan anomaly accepts an immediate tap: ${scenario.name}`,async({page})=>{
    await page.goto('/');
    await page.evaluate(({sample:mapSample})=>{
      let sample=0;
      Math.random=()=>{
        sample++;
        if(sample<=7)return 0;
        if(sample===8)return mapSample;
        return 0;
      };
    },scenario);
    await page.clock.install();
    await page.getByRole('button',{name:'はじめる',exact:true}).click();
    await page.clock.runFor(1300);
    await expect(page.locator('#mission-title')).toHaveText('見つけろ。');
    await expect(page.locator('#transition')).toBeHidden();
    await expect(page.locator('#controls button')).toHaveCount(0);
    const okinawaPixel=await page.locator('#game-canvas').evaluate((canvas:HTMLCanvasElement)=>{
      const scale=canvas.width/720;
      return Array.from(canvas.getContext('2d')!.getImageData(Math.round(202*scale),Math.round(495*scale),1,1).data).slice(0,3);
    });
    // The smaller island has antialiased coastal pixels; distinguish land from sea.
    if(scenario.name==='missing Okinawa')expect(okinawaPixel[0]).toBeLessThan(50);
    else expect(okinawaPixel[0]).toBeGreaterThan(100);
    await tapCanvas(page,scenario.x,scenario.y);
    await expect(page.locator('#transition-title')).toHaveText('任務完了');
  });
}
});

test('timeout ends run and restart keeps the animation loop working',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await deterministic(page);await page.clock.install();await start(page);
  await page.clock.runFor(11_000);
  await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
  await page.getByRole('button',{name:'もう一度、潜入する'}).click();
  await page.clock.runFor(1500);
  await expect(page.locator('#transition')).toBeHidden();
  await tapCanvas(page,330,336);
  await expect(page.locator('#transition-title')).toHaveText('任務完了');
  expect(errors).toEqual([]);
});

test('pause preserves time and best record survives reload',async({page})=>{
  await deterministic(page);await start(page);
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  const left=await page.locator('#time-value').textContent();
  await page.waitForTimeout(500);
  await expect(page.locator('#time-value')).toHaveText(left!);
  await page.getByRole('button',{name:'つづける'}).click();
  await tapCanvas(page,330,336);
  await expect(page.locator('#transition-title')).toHaveText('任務完了');
  await page.reload();await expect(page.locator('#title-best')).toHaveText('01');
});

for(const cleared of [40,41]){
  test(`mission result at ${cleared} clears, with play continuing until a mistake`,async({page})=>{
    await deterministic(page);
    // Stub only round outcomes so this checks the controller across 41 stages;
    // the real mission rules are exercised separately below.
    await page.evaluate(async()=>{
      const modulePath='/src/games.ts';
      const {Round}=await import(/* @vite-ignore */ modulePath);
      Round.prototype.tick=function(){
        Object.assign(window,{completeTestRound:(ok:boolean)=>this.end(ok,'テストの任務結果。')});
      };
    });
    const finish=(ok:boolean)=>page.evaluate(ok=>{
      (window as unknown as {completeTestRound:(ok:boolean)=>void}).completeTestRound(ok);
    },ok);
    await page.clock.install();
    await page.getByRole('button',{name:'はじめる',exact:true}).click();
    for(let stage=1;stage<=cleared;stage++){
      await expect(page.locator('#stage-number')).toHaveText(String(stage).padStart(2,'0'));
      await page.clock.runFor(1300);
      await expect(page.locator('#transition')).toBeHidden();
      await finish(true);
      await expect(page.locator('#result-screen')).toBeHidden();
      await page.clock.runFor(1500);
    }
    await expect(page.locator('#stage-number')).toHaveText(String(cleared+1));
    await expect(page.locator('#result-screen')).toBeHidden();
    await page.clock.runFor(1300);
    await finish(false);
    await expect(page.locator('#final-score')).toHaveText(String(cleared));
    await expect(page.locator('#result-screen h1')).toHaveText(cleared>=41?'殉職。':'任務失敗。');
    await expect(page.locator('#result-screen .eyebrow')).toHaveText(cleared>=41?'KILLED IN ACTION':'OPERATION FAILED');
    await expect(page.locator('#result-rank')).toHaveText('あなたはBEPPANです');
    await expect(page.locator('#result-rank')).toBeVisible();
    await expect(page.locator('#result-message')).toBeEmpty();
    await expect(page.locator('#result-message')).toBeHidden();
    await page.getByRole('button',{name:'もう一度、潜入する'}).click();
    await expect(page.locator('#stage-number')).toHaveText('01');
    await expect(page.locator('#result-screen')).toBeHidden();
    await page.clock.runFor(1300);
    await page.getByRole('button',{name:'一時停止',exact:true}).click();
    await page.getByRole('button',{name:'任務を終了する',exact:true}).click();
    await expect(page.locator('#result-screen h1')).toHaveText('任務終了。');
    await expect(page.locator('#result-rank')).toBeHidden();
    await expect(page.locator('#result-message')).toHaveText('任務から帰還した。');
  });
}

test('complete eight real missions, then accelerate the second loop',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await deterministic(page);await page.clock.install();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.clock.runFor(1300);
  await tapCanvas(page,330,336);
  await page.clock.runFor(2400);
  await expect(page.locator('#mission-title')).toHaveText('伝えろ。');
  for(let turn=0;turn<3;turn++){
    for(let tap=0;tap<2;tap++)await page.locator('#controls').getByRole('button',{name:/^ノック/}).click();
    if(turn<2){await page.clock.runFor(2000);continue;}
    await page.clock.runFor(650);
    await expect(page.locator('#transition')).toHaveClass(/door-clear/);
    const aperturePixel=()=>page.locator('#game-canvas').evaluate((canvas:HTMLCanvasElement)=>{
      const scale=canvas.width/720;
      return Array.from(canvas.getContext('2d')!.getImageData(Math.round(350*scale),Math.round(350*scale),1,1).data);
    });
    const opening=await aperturePixel();
    await page.clock.runFor(850);
    const open=await aperturePixel();
    expect(open.slice(0,3).reduce((sum,value,i)=>sum+Math.abs(value-opening[i]),0)).toBeGreaterThan(30);
    await expect(page.locator('#transition')).toBeVisible();
    await expect(page.locator('#game-hint')).toHaveText('認証成功。扉が開きます。');
    await page.clock.runFor(2000);
  }
  await expect(page.locator('#mission-title')).toHaveText('よけろ。');
  await expect(page.locator('#transition')).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  const advanceLaserTo=async(seconds:number)=>{
    const left=Number((await page.locator('#time-value').textContent())!.replace('s',''));
    await page.clock.runFor(Math.max(0,(left-(7-seconds))*1000));
  };
  await advanceLaserTo(2.35);await page.keyboard.press('Space');
  await advanceLaserTo(5.65);await page.keyboard.press('ArrowUp');
  await page.clock.runFor(1500);
  await page.clock.runFor(2400);
  await expect(page.locator('#mission-title')).toHaveText('狙え。');
  await tapCanvas(page,275,262);
  await page.clock.runFor(5600);
  await expect(page.locator('#mission-title')).toHaveText('覚えろ。');
  await page.locator('#controls').getByRole('button',{name:'深い赤'}).click();
  await page.clock.runFor(2400);
  await expect(page.locator('#mission-title')).toHaveText('撒け。');
  await page.keyboard.press('ArrowLeft');await page.clock.runFor(8700);await page.clock.runFor(2400);
  await expect(page.locator('#mission-title')).toHaveText('食べろ。');
  for(let i=0;i<10;i++)await page.keyboard.press('Space');
  await page.clock.runFor(2400);
  await expect(page.locator('#mission-title')).toHaveText('刺せ。');
  // The faster banana crosses the knife's flight path after about 1.69 s.
  // Subtract elapsed time already spent in this round and release ~0.34 s early.
  const remaining=Number((await page.locator('#time-value').textContent())!.replace('s',''));
  await page.clock.runFor(Math.max(0,(remaining-4.65)*1000));
  await page.keyboard.press('Space');await page.clock.runFor(600);
  await expect(page.locator('#transition-title')).toHaveText('任務完了');
  await page.clock.runFor(2000);
  await expect(page.locator('#stage-number')).toHaveText('09');
  await expect(page.locator('#loop-label')).toHaveText('LOOP 02');
  await expect(page.locator('#speed-label')).toHaveText('SPEED ×1.20');
  expect(errors).toEqual([]);
});

test('each mission has functional success, failure and escalating speed',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const modulePath='/src/games.ts';
    const {createRound}=await import(/* @vite-ignore */ modulePath);
    const original=Math.random;Math.random=()=>0;
    const results:Record<string,unknown>={};
    try{
      const run=(id:string,stage=1)=>{
        const verdict:{ok:boolean;message:string}[]=[];
        const game=createRound(id,{finish:(ok:boolean,message:string)=>verdict.push({ok,message}),sound:()=>{}},stage);
        return{game,verdict};
      };
      results.knife=[{stage:1,tap:1.35},{stage:9,tap:1.08},{stage:17,tap:.87},{stage:25,tap:.73},{stage:57,tap:.37}].map(({stage,tap})=>{
        const knife=run('knife',stage);
        for(let i=0;i<Math.round(tap*100);i++)knife.game.tick(.01);
        knife.game.action('primary');for(let i=0;i<60;i++)knife.game.tick(.01);
        return knife.verdict[0]?.ok;
      });
      const lateKnife=run('knife');for(let i=0;i<200;i++)lateKnife.game.tick(.01);lateKnife.game.action('primary');for(let i=0;i<80;i++)lateKnife.game.tick(.01);results.lateKnifeRejected=lateKnife.verdict[0]?.ok===false;
      const aim=run('aim');aim.game.pointer(275,262);results.aim=aim.verdict[0]?.ok;
      const heart=run('aim');heart.game.pointer(340,262);results.heartRejected=heart.verdict[0]?.ok===false;
      const laser=run('laser');for(let i=0;i<200;i++)laser.game.tick(.01);results.laserCollision=laser.verdict[0]?.ok===false;
      const chase=run('chase');for(let i=0;i<800;i++)chase.game.tick(.01);results.chaseCollision=chase.verdict[0]?.ok===false;
      const lateDodge=run('chase');for(let i=0;i<240;i++)lateDodge.game.tick(.01);
      lateDodge.game.action('left');for(let i=0;i<620;i++)lateDodge.game.tick(.01);results.lateChaseDodge=lateDodge.verdict[0]?.ok;
      const eat=run('eat');for(let i=0;i<9;i++)eat.game.action('primary');results.eatNeedsTen=eat.verdict.length===0;eat.game.action('primary');results.eat=eat.verdict[0]?.ok;
      results.noEatCounter=eat.game.controls()[0].label==='食べる';
      const overknock=run('knock');for(let i=0;i<3;i++)overknock.game.action('primary');results.overknock=overknock.verdict[0]?.ok===false;
      results.noKnockCounter=overknock.game.controls()[0].label==='ノック';
      Math.random=()=>.999;
      const maxKnock=run('knock',65);for(let i=0;i<9;i++)maxKnock.game.action('primary');
      results.knockAllowsNine=maxKnock.verdict.length===0;maxKnock.game.action('primary');results.knockRejectsTen=maxKnock.verdict[0]?.ok===false;
      Math.random=()=>0;
      const memory=run('memory');memory.game.action('choice-0');results.memoryHidden=memory.verdict.length===0;for(let i=0;i<310;i++)memory.game.tick(.01);memory.game.action('choice-0');results.memory=memory.verdict[0]?.ok===false; // shuffled first choice is gray, not red
      results.speeds=[1,9,17,25].map(stage=>Number(run('eat',stage).game.duration.toFixed(3)));
      // Every Japanese geographic anomaly can be recognized and selected.
      results.maps=[];
      for(let mode=0;mode<4;mode++){
        let first=true;Math.random=()=>{if(first){first=false;return(mode+.01)/4;}return 0;};
        const map=run('map');
        const point=[[330,336],[392,301],[448,236],[176,525]][mode];
        if(map.game.controls().length)throw new Error('Maps must not display answer choices');
        map.game.action(`choice-${mode<3?mode:0}`);
        if(map.verdict.length)throw new Error('Maps must require a direct tap');
        map.game.pointer(...point);
        (results.maps as unknown[]).push(map.verdict[0]?.ok);
      }
    }finally{Math.random=original;}
    return results;
  });
  expect(result).toEqual({knife:[true,true,true,true,true],lateKnifeRejected:true,aim:true,heartRejected:true,laserCollision:true,chaseCollision:true,lateChaseDodge:true,eatNeedsTen:true,eat:true,noEatCounter:true,overknock:true,noKnockCounter:true,knockAllowsNine:true,knockRejectsTen:true,memoryHidden:true,memory:true,speeds:[5.5,4.583,3.929,3.438],maps:[true,true,true,true]});
});
