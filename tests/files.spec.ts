import {test,expect,type Page} from '@playwright/test';

const names=['ayaman.mp3','beppan.mp3','karaoketeppan.mp3','pazyama.mp3','pazyama仮.mp3','pazyama最終.mp3','peppan.mp3','poipoi.mp3','tokyo.mp3','yestokyo.mp3'];

async function startFiles(page:Page,bgm=true){
  await page.addInitScript(()=>{
    Math.random=()=>0;localStorage.setItem('sennyu-best-v1','10');
    const play=HTMLMediaElement.prototype.play;
    Object.assign(window,{filePlayCalls:[] as string[]});
    HTMLMediaElement.prototype.play=function(){(window as any).filePlayCalls.push(this.id);return play.call(this);};
  });
  await page.goto('/');
  await page.evaluate(async()=>{
    const modulePath='/src/games.ts', {Round}=await import(/* @vite-ignore */ modulePath),tick=Round.prototype.tick;
    // Only skip earlier outcomes; stage 15 uses its real rules, UI, timer and audio.
    Round.prototype.tick=function(dt:number){
      if(this.stage<15)Object.assign(window,{finishFilesLeadIn:()=>this.end(true,'')});
      else tick.call(this,dt);
    };
  });
  if(bgm){await page.getByRole('button',{name:'BGMを再生',exact:true}).click();await expect(page.locator('#bgm-status')).toContainText('再生中');}
  const time=new Date('2026-10-25T15:00:00Z');await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'11からはじめる',exact:true}).click();
  for(let stage=11;stage<15;stage++){
    await expect(page.locator('#stage-number')).toHaveText(String(stage));await page.clock.runFor(1300);
    await page.evaluate(()=>(window as any).finishFilesLeadIn());await page.clock.runFor(1500);
  }
  await expect(page.locator('#stage-number')).toHaveText('15');await expect(page.locator('#transition-title')).toHaveText('鳴らせ。');
  await page.clock.runFor(1300);await expect(page.locator('#transition')).toBeHidden();await expect(page.locator('#file-picker')).toBeVisible();
}
async function audioState(page:Page){
  return page.evaluate(()=>({
    main:document.querySelector<HTMLAudioElement>('#bgm-audio')!.paused,
    tracks:Object.fromEntries(['party','yes','poi'].map(name=>{
      const track=document.querySelector<HTMLAudioElement>(`#file-${name}-audio`)!;
      return[name,{paused:track.paused,src:track.currentSrc,duration:track.duration,loop:track.loop,time:track.currentTime}];
    })),
    plays:(window as any).filePlayCalls as string[],
  }));
}

test.describe('鳴らせ file picker and uploaded music',()=>{
  test.use({viewport:{width:320,height:568},isMobile:true,hasTouch:true});

  test('the alphabetical list has usable touch rows, and beppan keeps the same main BGM through success',async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await startFiles(page);
    await expect(page.locator('.music-file > span:last-child')).toHaveText(names);
    const rows=await page.locator('.music-file').all();
    for(const row of rows)expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const before=await audioState(page),canvas=await page.locator('#game-canvas').boundingBox();
    await page.screenshot({path:'/tmp/hokemi-files-mobile.png'});
    await page.getByRole('button',{name:'beppan.mp3',exact:true}).tap();
    await expect(page.locator('#transition-title')).toHaveText('任務完了');await expect(page.locator('#result-screen')).toBeHidden();
    const after=await audioState(page);expect(after.main).toBe(false);expect(after.plays).toEqual(before.plays);
    expect(Object.values(after.tracks).every(track=>track.paused)).toBe(true);
    expect(await page.locator('#game-canvas').boundingBox()).toEqual(canvas);
    await page.clock.runFor(1500);await expect(page.locator('#stage-number')).toHaveText('16');
    await expect(page.locator('#file-picker')).toBeHidden();expect((await audioState(page)).main).toBe(false);expect(errors).toEqual([]);
  });

  for(const scenario of [
    {name:'pazyama.mp3',track:'party',bgm:true,home:false},
    {name:'yestokyo.mp3',track:'yes',bgm:true,home:true},
    {name:'poipoi.mp3',track:'poi',bgm:false,home:false},
    {name:'peppan.mp3',track:'poi',bgm:true,home:false},
  ]){
    test(`${scenario.name} fails, plays ${scenario.track} through the result, and stops on navigation`,async({page})=>{
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await startFiles(page,scenario.bgm);
      await page.getByRole('button',{name:scenario.name,exact:true}).tap();await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
      await expect(page.locator('#final-score')).toHaveText('14');await expect(page.locator('#result-message')).toBeEmpty();
      const track=page.locator(`#file-${scenario.track}-audio`);
      await expect.poll(()=>track.evaluate((audio:HTMLAudioElement)=>audio.readyState>=2&&!audio.paused)).toBe(true);
      const failed=await audioState(page);expect(failed.main).toBe(true);expect(failed.tracks[scenario.track].loop).toBe(true);
      expect(failed.tracks[scenario.track].src).toContain(`/audio/${scenario.track}.mp3`);
      for(const [name,audio] of Object.entries(failed.tracks))if(name!==scenario.track)expect(audio.paused).toBe(true);
      await page.clock.runFor(3000);expect((await audioState(page)).tracks[scenario.track].paused).toBe(false);
      if(scenario.name==='peppan.mp3'){
        await page.getByRole('button',{name:'音をオフにする',exact:true}).tap();expect((await audioState(page)).tracks.poi.paused).toBe(true);
        await page.getByRole('button',{name:'音をオンにする',exact:true}).tap();await expect.poll(async()=>(await audioState(page)).tracks.poi.paused).toBe(false);
      }
      await page.getByRole('button',{name:scenario.home?'タイトルへ戻る':'11からリスタート',exact:true}).tap();
      expect(Object.values((await audioState(page)).tracks).every(audio=>audio.paused)).toBe(true);
      if(scenario.bgm)await expect.poll(async()=>(await audioState(page)).main).toBe(false);
      else expect((await audioState(page)).main).toBe(true);
      expect(await page.evaluate(()=>scrollY)).toBe(0);expect(errors).toEqual([]);
    });
  }
});

test('every filename has exactly its requested outcome and music, with no repeated selection after ending',async({page})=>{
  await page.goto('/');
  const outcomes=await page.evaluate(async()=>{
    const gamesPath='/src/games.ts',filesPath='/src/music-files.ts';
    const {createRound}=await import(/* @vite-ignore */ gamesPath),{musicFiles}=await import(/* @vite-ignore */ filesPath);
    return musicFiles.map((file:{name:string},index:number)=>{
      const finish:boolean[]=[],music:string[]=[];
      const game=createRound('files',{finish:(ok:boolean)=>finish.push(ok),sound:()=>{},music:(track:string)=>music.push(track)},15);
      game.action('primary');game.action('file-999');
      if(finish.length||music.length)throw new Error('Invalid selections must be ignored');
      game.action(`file-${index}`);game.action(`file-${(index+1)%musicFiles.length}`);
      return{name:file.name,finish,music};
    });
  });
  expect(outcomes).toEqual(names.map(name=>({name,finish:[name==='beppan.mp3'],music:name==='beppan.mp3'?[]:[
    name.startsWith('pazyama')?'party':['tokyo.mp3','yestokyo.mp3','karaoketeppan.mp3'].includes(name)?'yes':'poi',
  ]})));
});

test('only multiples of 15 get the special mission while normal bags continue without dropping games',async({page})=>{
  test.setTimeout(90_000);
  await page.addInitScript(()=>{Math.random=()=>0;});await page.goto('/');
  await page.evaluate(async()=>{
    const modulePath='/src/games.ts';const {Round}=await import(/* @vite-ignore */ modulePath);
    Round.prototype.tick=function(){Object.assign(window,{finishScheduleRound:()=>this.end(true,'')});};
  });
  const time=new Date('2026-10-25T15:00:00Z');await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'はじめる',exact:true}).click();const normal:string[]=[];
  for(let stage=1;stage<=60;stage++){
    await expect(page.locator('#stage-number')).toHaveText(String(stage).padStart(2,'0'));
    const title=await page.locator('#mission-title').textContent();
    if(stage%15===0)expect(title).toBe('鳴らせ。');else{expect(title).not.toBe('鳴らせ。');normal.push(title!);}
    await page.clock.runFor(1300);await page.evaluate(()=>(window as any).finishScheduleRound());await page.clock.runFor(1500);
  }
  for(let i=0;i+8<=normal.length;i+=8)expect(new Set(normal.slice(i,i+8)).size).toBe(8);
  await expect(page.locator('#stage-number')).toHaveText('61');
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
