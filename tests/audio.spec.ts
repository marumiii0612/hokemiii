import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {tapCanvas} from './helpers';

// Use the actual uploaded MP3 and browser decoder; mock only blocked/late play promises.
async function music(page:Page,options:{blockFirst?:boolean;deferFirst?:boolean}={}){
  await page.addInitScript(({blockFirst,deferFirst})=>{
    Math.random=()=>0;
    const trace={plays:0,pauses:0,gain:undefined as GainNode|undefined,peaks:[] as number[]};
    Object.assign(window,{musicTrace:trace});
    const play=HTMLMediaElement.prototype.play,pause=HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play=function(){
      if(this.id==='bgm-audio'){
        trace.plays++;
        if(blockFirst){blockFirst=false;return Promise.reject(new DOMException('Blocked','NotAllowedError'));}
        if(deferFirst){
          deferFirst=false;
          return new Promise<void>((resolve,reject)=>{
            Object.assign(window,{releaseMusic:()=>play.call(this).then(resolve,reject)});
          });
        }
      }
      return play.call(this);
    };
    HTMLMediaElement.prototype.pause=function(){if(this.id==='bgm-audio')trace.pauses++;return pause.call(this);};
    const source=AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource=function(media){
      const node=source.call(this,media),connect=node.connect.bind(node);
      node.connect=((destination:AudioNode)=>{trace.gain=destination as GainNode;return connect(destination);}) as typeof node.connect;
      return node;
    };
    const ramp=AudioParam.prototype.linearRampToValueAtTime;
    AudioParam.prototype.linearRampToValueAtTime=function(value,time){trace.peaks.push(value);return ramp.call(this,value,time);};
  },options);
  await page.goto('/');
}
async function state(page:Page){
  return page.evaluate(()=>{
    const media=document.querySelector<HTMLAudioElement>('#bgm-audio')!,trace=(window as any).musicTrace;
    return {paused:media.paused,time:media.currentTime,duration:media.duration,volume:media.volume,loop:media.loop,
      src:media.currentSrc||media.src,plays:trace.plays,pauses:trace.pauses,gain:trace.gain?.gain.value,peak:Math.max(...trace.peaks)};
  });
}
async function playing(page:Page){
  await expect(page.locator('#bgm-status')).toContainText('再生中');
  await expect.poll(async()=>(await state(page)).paused).toBe(false);
}
async function clock(page:Page){
  const time=new Date('2026-10-25T15:00:00Z');
  await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
}

test.describe('uploaded MP3 BGM',()=>{
  test.use({viewport:{width:320,height:844},isMobile:true,hasTouch:true});

  test('plays the real file through missions, stops on failure and resumes on retry, pause and mute',async({page})=>{
    const errors:string[]=[],requests:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await music(page);
    expect(requests.some(url=>url.includes('/audio/')||url.includes('youtube'))).toBe(false);
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();await playing(page);
    const title=await state(page);
    expect(title.src).toContain('/audio/main.mp3');expect(title.duration).toBeCloseTo(275.51,1);
    expect(title.loop).toBe(true);expect(title.gain).toBeCloseTo(.08,5);
    await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(title.time);
    await expect(page.locator('#bgm-audio')).toBeHidden();await expect(page.locator('iframe')).toHaveCount(0);
    await clock(page);await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
    expect((await state(page)).plays).toBe(title.plays);expect((await state(page)).paused).toBe(false);
    await tapCanvas(page,512,135);
    await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');expect((await state(page)).paused).toBe(true);
    const failed=await state(page);expect(failed.peak).toBeGreaterThan(.2);
    await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await playing(page);await page.clock.runFor(1300);
    expect((await state(page)).plays).toBe(failed.plays+1);
    await page.getByRole('button',{name:'音をオフにする',exact:true}).click();expect((await state(page)).paused).toBe(true);
    await page.getByRole('button',{name:'音をオンにする',exact:true}).click();await playing(page);
    await page.getByRole('button',{name:'一時停止',exact:true}).click();expect((await state(page)).paused).toBe(true);
    await page.getByRole('button',{name:'つづける',exact:false}).click();await playing(page);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    expect((await state(page)).paused).toBe(true);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    expect((await state(page)).paused).toBe(true);
    await page.getByRole('button',{name:'つづける',exact:false}).click();await playing(page);
    await tapCanvas(page,512,135);expect((await state(page)).paused).toBe(true);
    await page.getByRole('button',{name:'タイトルへ戻る',exact:true}).click();await playing(page);
    expect(requests.some(url=>/youtube|googlevideo/.test(url))).toBe(false);expect(errors).toEqual([]);
  });

  test('keeps the same quiet gain across starts, volume events and restart without replaying on screen changes',async({page})=>{
    await music(page);await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();await playing(page);
    const before=await state(page);
    await page.locator('#bgm-audio').evaluate((media:HTMLAudioElement)=>{media.volume=.5;});
    await expect.poll(async()=>(await state(page)).volume).toBe(1);
    await clock(page);await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
    expect((await state(page)).plays).toBe(before.plays);expect((await state(page)).gain).toBeCloseTo(.08,5);
    await tapCanvas(page,512,135);await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await playing(page);
    expect((await state(page)).gain).toBeCloseTo(.08,5);expect((await state(page)).plays).toBe(before.plays+1);
  });

  test('autoplay blocking offers a direct retry that plays the real file',async({page})=>{
    await music(page,{blockFirst:true});await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('もう一度タップ');
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();await playing(page);
    expect((await state(page)).plays).toBe(2);
  });

  test('an unavailable MP3 leaves the game playable and can be retried',async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/audio/main.mp3',r=>r.fulfill({contentType:'audio/mpeg',body:'invalid audio'}));
    await music(page);await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('再生できませんでした');
    await page.getByRole('button',{name:'はじめる',exact:true}).tap();await expect(page.locator('#stage-number')).toHaveText('01');
    await page.unroute('**/audio/main.mp3');await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();await playing(page);
    expect(errors).toEqual([]);
  });

  test('a late playback completion cannot restart BGM after failure',async({page})=>{
    await music(page,{deferFirst:true});await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await clock(page);await page.getByRole('button',{name:'はじめる',exact:true}).tap();await page.clock.runFor(1300);
    await tapCanvas(page,512,135);await expect(page.locator('#result-screen')).toBeVisible();
    await page.evaluate(()=>(window as any).releaseMusic());
    await expect.poll(async()=>(await state(page)).paused).toBe(true);
    await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await playing(page);
  });

  test('clears keep the song playing, and checkpoint retries resume it after failure',async({page})=>{
    await page.addInitScript(()=>localStorage.setItem('sennyu-best-v1','20'));await music(page);
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();await playing(page);await clock(page);
    await page.getByRole('button',{name:'11からはじめる',exact:true}).click();await page.clock.runFor(1300);
    const before=await state(page);await tapCanvas(page,330,336);await expect(page.locator('#transition-title')).toHaveText('任務完了');
    await page.clock.runFor(2400);await expect(page.locator('#stage-number')).toHaveText('12');
    expect((await state(page)).paused).toBe(false);expect((await state(page)).plays).toBe(before.plays);
    await page.clock.runFor(20000);await expect(page.locator('#result-screen')).toBeVisible();expect((await state(page)).paused).toBe(true);
    await page.getByRole('button',{name:'11からリスタート',exact:true}).click();await playing(page);
    await expect(page.locator('#stage-number')).toHaveText('11');
  });

  test('retries preserve an explicit BGM stop and master mute',async({page})=>{
    await music(page);await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();await playing(page);
    await page.getByRole('button',{name:'BGMを停止',exact:true}).tap();const stopped=await state(page);
    await clock(page);await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
    await tapCanvas(page,512,135);await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await page.clock.runFor(1300);
    expect((await state(page)).paused).toBe(true);expect((await state(page)).plays).toBe(stopped.plays);
    await page.getByRole('button',{name:'BGMを再生',exact:true}).click();await playing(page);
    await page.getByRole('button',{name:'音をオフにする',exact:true}).click();const muted=await state(page);
    await tapCanvas(page,512,135);await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();
    expect((await state(page)).paused).toBe(true);expect((await state(page)).plays).toBe(muted.plays);
    await page.getByRole('button',{name:'音をオンにする',exact:true}).click();await playing(page);
  });

  test('the Pages build plays its bundled MP3 under the repository subdirectory',async({page})=>{
    const html=await readFile('docs/index.html','utf8'),mp3=await readFile('docs/audio/main.mp3');
    await page.route('**/hokemiii/',r=>r.fulfill({contentType:'text/html',body:html}));
    await page.route('**/hokemiii/audio/main.mp3',r=>r.fulfill({contentType:'audio/mpeg',body:mp3}));
    await page.goto('/hokemiii/');await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('再生中');
    const info=await page.locator('#bgm-audio').evaluate((media:HTMLAudioElement)=>({src:media.currentSrc,duration:media.duration,paused:media.paused}));
    expect(info.src).toContain('/hokemiii/audio/main.mp3');expect(info.duration).toBeCloseTo(275.51,1);expect(info.paused).toBe(false);
  });
});
