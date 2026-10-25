import {test,expect,type Page} from '@playwright/test';
import {watchAudioActivity,audioActivity} from './helpers';

const names=['ayaman.mp3','beppan.mp3','karaoketeppan.mp3','pazyama.mp3','pazyama仮.mp3','pazyama最終.mp3','peppan.mp3','poipoi.mp3','tokyo.mp3','yestokyo.mp3'];

async function startFiles(page:Page){
  await watchAudioActivity(page);
  await page.addInitScript(()=>{
    let sample=0;
    // Put Files first in the nine-mission shuffle.
    Math.random=()=>{sample++;return sample>=2&&sample<=8?.999:0;};
    localStorage.setItem('sennyu-best-v1','10');
  });
  await page.goto('/');
  const time=new Date('2026-10-25T15:00:00Z');await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await expect(page.locator('#stage-number')).toHaveText('01');await expect(page.locator('#transition-title')).toHaveText('鳴らせ。');
  await page.clock.runFor(1300);await expect(page.locator('#transition')).toBeHidden();await expect(page.locator('#file-picker')).toBeVisible();
}
test.describe('silent 鳴らせ file picker',()=>{
  test.use({viewport:{width:320,height:568},isMobile:true,hasTouch:true});

  test('the alphabetical list has usable touch rows, and beppan succeeds without audio',async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await startFiles(page);
    await expect(page.locator('.music-file > span:last-child')).toHaveText(names);
    const rows=await page.locator('.music-file').all();
    for(const row of rows)expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const canvas=await page.locator('#game-canvas').boundingBox();
    await page.screenshot({path:'/tmp/hokemi-files-mobile.png'});
    await page.getByRole('button',{name:'beppan.mp3',exact:true}).tap();
    await expect(page.locator('#transition-title')).toHaveText('任務完了');await expect(page.locator('#result-screen')).toBeHidden();
    expect(await audioActivity(page)).toEqual({contexts:0,elements:0,plays:0});
    expect(await page.locator('#game-canvas').boundingBox()).toEqual(canvas);
    await page.clock.runFor(1500);await expect(page.locator('#stage-number')).toHaveText('02');
    await expect(page.locator('#file-picker')).toBeHidden();expect(errors).toEqual([]);
  });

  for(const scenario of [
    {name:'pazyama.mp3',home:false},
    {name:'yestokyo.mp3',home:true},
  ]){
    test(`${scenario.name} fails silently and supports immediate navigation`,async({page})=>{
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await startFiles(page);
      await page.getByRole('button',{name:scenario.name,exact:true}).tap();await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
      await expect(page.locator('#final-score')).toHaveText('0');await expect(page.locator('#result-message')).toBeEmpty();
      await page.clock.runFor(3000);await expect(page.locator('audio,video')).toHaveCount(0);
      await page.getByRole('button',{name:scenario.home?'タイトルへ戻る':'11からリスタート',exact:true}).tap();
      expect(await audioActivity(page)).toEqual({contexts:0,elements:0,plays:0});
      expect(await page.evaluate(()=>scrollY)).toBe(0);expect(errors).toEqual([]);
    });
  }
});

test('every filename keeps its requested outcome without a repeated selection after ending',async({page})=>{
  await page.goto('/');
  const outcomes=await page.evaluate(async()=>{
    const gamesPath='/src/games.ts',filesPath='/src/music-files.ts';
    const {createRound}=await import(/* @vite-ignore */ gamesPath),{musicFiles}=await import(/* @vite-ignore */ filesPath);
    return musicFiles.map((file:{name:string},index:number)=>{
      const finish:boolean[]=[];
      const game=createRound('files',{finish:(ok:boolean)=>finish.push(ok)},15);
      game.action('primary');game.action('file-999');
      if(finish.length)throw new Error('Invalid selections must be ignored');
      game.action(`file-${index}`);game.action(`file-${(index+1)%musicFiles.length}`);
      return{name:file.name,finish};
    });
  });
  expect(outcomes).toEqual(names.map(name=>({name,finish:[name==='beppan.mp3']})));
});

test('all nine missions appear once per shuffled loop, with speed changing after nine clears',async({page})=>{
  test.setTimeout(90_000);
  await page.addInitScript(()=>{
    let seed=12345;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  });
  await page.goto('/');
  await page.evaluate(async()=>{
    const modulePath='/src/games.ts';const {Round}=await import(/* @vite-ignore */ modulePath);
    Round.prototype.tick=function(){Object.assign(window,{finishScheduleRound:()=>this.end(true,'')});};
  });
  const time=new Date('2026-10-25T15:00:00Z');await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'はじめる',exact:true}).click();const titles:string[]=[],fileStages:number[]=[];
  for(let stage=1;stage<=27;stage++){
    await expect(page.locator('#stage-number')).toHaveText(String(stage).padStart(2,'0'));
    const title=(await page.locator('#mission-title').textContent())!;titles.push(title);
    if(title==='鳴らせ。')fileStages.push(stage);
    if(stage>1)expect(title).not.toBe(titles[stage-2]);
    await expect(page.locator('#loop-label')).toHaveText(`LOOP 0${Math.floor((stage-1)/9)+1}`);
    await expect(page.locator('#speed-label')).toHaveText(`SPEED ×${(1+Math.floor((stage-1)/9)*.2).toFixed(2)}`);
    await page.clock.runFor(1300);await page.evaluate(()=>(window as any).finishScheduleRound());await page.clock.runFor(1500);
  }
  for(let i=0;i<titles.length;i+=9){
    const loop=titles.slice(i,i+9);expect(new Set(loop).size).toBe(9);expect(loop.filter(title=>title==='鳴らせ。')).toHaveLength(1);
  }
  expect(fileStages.some(stage=>stage%15!==0)).toBe(true);
  await expect(page.locator('#stage-number')).toHaveText('28');
  await expect(page.locator('#speed-label')).toHaveText('SPEED ×1.60');
});

test('Japan anomalies accept near-coast taps outside the previous radius and still reject distant taps',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const modulePath='/src/games.ts';const {createRound}=await import(/* @vite-ignore */ modulePath),original=Math.random;
    try{return [[385,336],[442,301],[498,236],[176,590]].map(([x,y],index)=>{
      Math.random=()=>(index+.01)/4;
      const verdict:boolean[]=[];
      const game=createRound('map',{finish:(ok:boolean)=>verdict.push(ok),sound:()=>{}},1);game.pointer(x,y);
      const far=createRound('map',{finish:(ok:boolean)=>verdict.push(ok),sound:()=>{}},1);far.pointer(700,600);
      return verdict;
    });}finally{Math.random=original;}
  });
  expect(result).toEqual([[true,false],[true,false],[true,false],[true,false]]);
});
