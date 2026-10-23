import { test, expect, type Page } from '@playwright/test';

async function deterministic(page:Page){
  await page.addInitScript(()=>{Math.random=()=>0;});
  await page.goto('/');
}
async function start(page:Page){await page.getByRole('button',{name:'はじめる',exact:true}).click();await expect(page.locator('#transition')).toBeHidden();}

test('mobile title, manual, one-miss failure and immediate restart',async({page})=>{
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
  await page.locator('#controls').getByRole('button',{name:'滋賀県'}).click();
  await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
  await expect(page.locator('#final-score')).toHaveText('0');
  await page.getByRole('button',{name:'もう一度、潜入する'}).click();
  await expect(page.locator('#stage-number')).toHaveText('01');
  await expect(page.locator('#result-screen')).toBeHidden();
  expect(errors).toEqual([]);
});

test('timeout ends run and restart keeps the animation loop working',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await deterministic(page);await page.clock.install();await start(page);
  await page.clock.runFor(11_000);
  await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
  await page.getByRole('button',{name:'もう一度、潜入する'}).click();
  await page.clock.runFor(1500);
  await expect(page.locator('#transition')).toBeHidden();
  await page.locator('#controls').getByRole('button',{name:'四国'}).click();
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
  await page.locator('#controls').getByRole('button',{name:'四国'}).click();
  await expect(page.locator('#transition-title')).toHaveText('任務完了');
  await page.reload();await expect(page.locator('#title-best')).toHaveText('01');
});

test('complete eight real missions, then accelerate the second loop',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await deterministic(page);await page.clock.install();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.clock.runFor(1300);
  await page.locator('#controls').getByRole('button',{name:'四国'}).click();
  await page.clock.runFor(2400);
  await expect(page.locator('#mission-title')).toHaveText('伝えろ。');
  for(let turn=0;turn<3;turn++){
    await page.locator('#controls').getByRole('button',{name:/^ノック/}).click();
    if(turn<2){await page.clock.runFor(1700);continue;}
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
  await page.keyboard.press('ArrowLeft');await page.clock.runFor(7100);
  await page.clock.runFor(2400);
  await expect(page.locator('#mission-title')).toHaveText('狙え。');
  const bounds=await page.locator('#game-canvas').boundingBox();
  await page.mouse.click(bounds!.x+275/720*bounds!.width,bounds!.y+262/640*bounds!.height);
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
  // The banana crosses the knife's flight path after about 2.38 s.
  // Subtract elapsed time already spent in this round and release ~0.36 s early.
  const remaining=Number((await page.locator('#time-value').textContent())!.replace('s',''));
  await page.clock.runFor(Math.max(0,(remaining-4.0)*1000));
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
      const knife=run('knife');for(let i=0;i<200;i++)knife.game.tick(.01);knife.game.action('primary');for(let i=0;i<60;i++)knife.game.tick(.01);results.knife=knife.verdict[0]?.ok;
      const aim=run('aim');aim.game.pointer(275,262);results.aim=aim.verdict[0]?.ok;
      const heart=run('aim');heart.game.pointer(340,262);results.heartRejected=heart.verdict[0]?.ok===false;
      const laser=run('laser');for(let i=0;i<200;i++)laser.game.tick(.01);results.laserCollision=laser.verdict[0]?.ok===false;
      const chase=run('chase');for(let i=0;i<800;i++)chase.game.tick(.01);results.chaseCollision=chase.verdict[0]?.ok===false;
      const eat=run('eat');for(let i=0;i<9;i++)eat.game.action('primary');results.eatNeedsTen=eat.verdict.length===0;eat.game.action('primary');results.eat=eat.verdict[0]?.ok;
      const overknock=run('knock');overknock.game.action('primary');overknock.game.action('primary');results.overknock=overknock.verdict[0]?.ok===false;
      const memory=run('memory');memory.game.action('choice-0');results.memoryHidden=memory.verdict.length===0;for(let i=0;i<310;i++)memory.game.tick(.01);memory.game.action('choice-0');results.memory=memory.verdict[0]?.ok===false; // shuffled first choice is gray, not red
      results.speeds=[1,9,17,25].map(stage=>Number(run('eat',stage).game.duration.toFixed(3)));
      // Every geographic and campus anomaly can be recognized and selected.
      results.maps=[];
      for(let mode=0;mode<6;mode++){
        let first=true;Math.random=()=>{if(first){first=false;return(mode+.01)/6;}return 0;};
        const map=run('map');for(let i=0;i<240;i++)map.game.tick(.01);map.game.action(`choice-${mode<3?mode:0}`);(results.maps as unknown[]).push(map.verdict[0]?.ok);
      }
    }finally{Math.random=original;}
    return results;
  });
  expect(result).toEqual({knife:true,aim:true,heartRejected:true,laserCollision:true,chaseCollision:true,eatNeedsTen:true,eat:true,overknock:true,memoryHidden:true,memory:true,speeds:[5.5,4.583,3.929,3.438],maps:[true,true,true,true,true,true]});
});
