import {test,expect,type Page} from '@playwright/test';
import {tapCanvas} from './helpers';

// Test the integration without relying on YouTube's network or autoplay availability.
const fakeApi=`
window.musicMock={plays:0,pauses:0,volume:80,volumeReads:0,volumes:[],blockNext:!!window.blockTitleMusic};
window.YT={Player:class{
  constructor(element,options){
    this.options=options;window.musicMock.options=options;
    this.frame=document.createElement('iframe');this.frame.srcdoc='<p>YouTube player test double</p>';
    element.replaceWith(this.frame);setTimeout(()=>options.events.onReady({target:this}),0);
  }
  getVolume(){window.musicMock.volumeReads++;return window.musicMock.volume;}
  setVolume(volume){window.musicMock.volume=volume;window.musicMock.volumes.push(volume);}
  playVideo(){
    window.musicMock.plays++;
    if(window.musicMock.blockNext){window.musicMock.blockNext=false;this.options.events.onAutoplayBlocked();}
    else{
      if(window.resetMusicVolumeOnPlay)window.musicMock.volume=100;
      this.options.events.onStateChange({target:this,data:1});
    }
  }
  pauseVideo(){window.musicMock.pauses++;}
  destroy(){this.frame.remove();}
  getIframe(){return this.frame;}
}};
window.onYouTubeIframeAPIReady();
`;

async function mockMusic(page:Page){
  await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:fakeApi}));
  await page.addInitScript(()=>{Math.random=()=>0;});
  await page.goto('/');
}
async function musicState(page:Page){
  return page.evaluate(()=>{
    const mock=(window as any).musicMock;
    return {plays:mock.plays,pauses:mock.pauses,volume:mock.volume,volumeReads:mock.volumeReads,volumes:mock.volumes,videoId:mock.options.videoId,vars:mock.options.playerVars};
  });
}

test.describe('BGM through a mission and louder effects',()=>{
  test.use({viewport:{width:320,height:844},isMobile:true,hasTouch:true});
  test('continues during play, stops on failure, resumes on retry and respects mute and pause',async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const trace={peaks:[] as number[],starts:0,master:undefined as GainNode|undefined};
      Object.assign(window,{soundTrace:trace});
      const ramp=AudioParam.prototype.linearRampToValueAtTime;
      AudioParam.prototype.linearRampToValueAtTime=function(value,time){trace.peaks.push(value);return ramp.call(this,value,time);};
      const start=OscillatorNode.prototype.start;
      OscillatorNode.prototype.start=function(when){trace.starts++;start.call(this,when);};
      const createGain=AudioContext.prototype.createGain;
      AudioContext.prototype.createGain=function(){const gain=createGain.call(this);trace.master??=gain;return gain;};
    });
    let apiRequests=0;page.on('request',request=>{if(request.url()==='https://www.youtube.com/iframe_api')apiRequests++;});
    await mockMusic(page);
    expect(apiRequests).toBe(0);await expect(page.locator('#title-bgm-panel')).toBeHidden();
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('再生中');
    const playing=await musicState(page);
    expect(apiRequests).toBe(1);expect(playing.videoId).toBe('MuGFcUggtDs');
    expect(playing.vars.loop).toBe(1);expect(playing.vars.playsinline).toBe(1);
    expect(playing.volumes.every((volume:number)=>volume===8)).toBe(true);
    await expect(page.locator('#title-bgm-player iframe')).toHaveAttribute('title','BGM — YouTube');
    await expect(page.locator('#title-bgm-player iframe')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'音をオフにする',exact:true}).tap();
    expect((await musicState(page)).pauses).toBeGreaterThan(playing.pauses);
    await expect(page.locator('#bgm-status')).toContainText('一時停止中');
    expect(await page.evaluate(()=>(window as any).soundTrace.master.gain.value)).toBe(0);
    await page.getByRole('button',{name:'音をオンにする',exact:true}).tap();
    expect((await musicState(page)).plays).toBeGreaterThan(playing.plays);
    const beforeTab=await musicState(page);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    expect((await musicState(page)).pauses).toBeGreaterThan(beforeTab.pauses);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    await page.getByRole('button',{name:'音をオフにする',exact:true}).tap();
    await page.getByRole('button',{name:'BGMを停止',exact:true}).tap();
    await expect(page.locator('#title-bgm-panel')).toBeHidden();
    await expect(page.getByRole('button',{name:'音をオンにする',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.getByRole('button',{name:'音をオフにする',exact:true})).toBeVisible();
    const time=new Date('2026-10-24T12:00:00Z');
    await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
    await page.evaluate(()=>{Object.assign(window,{savedMusicFrame:document.querySelector('#title-bgm-player iframe')});});
    const beforeGame=await musicState(page);
    await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
    await expect(page.locator('#transition')).toBeHidden();
    const inGame=await musicState(page);
    expect(inGame.pauses).toBe(beforeGame.pauses);
    await expect(page.locator('#title-bgm-player iframe')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await tapCanvas(page,512,135);
    await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
    const failed=await musicState(page);
    expect(failed.pauses).toBeGreaterThan(inGame.pauses);expect(failed.plays).toBe(inGame.plays);
    await expect(page.locator('#bgm-section')).toBeHidden();
    const effects=await page.evaluate(()=>{const trace=(window as any).soundTrace;return {peak:Math.max(...trace.peaks),starts:trace.starts};});
    expect(effects.peak).toBeGreaterThan(.2);expect(effects.starts).toBeGreaterThan(0);
    await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await page.clock.runFor(1300);
    const retried=await musicState(page);
    expect(retried.plays).toBeGreaterThan(failed.plays);expect(retried.pauses).toBe(failed.pauses);
    await expect(page.locator('#title-bgm-player iframe')).toBeHidden();
    expect(await page.evaluate(()=>document.querySelector('#title-bgm-player iframe')===(window as any).savedMusicFrame)).toBe(true);
    await page.getByRole('button',{name:'音をオフにする',exact:true}).click();
    expect((await musicState(page)).pauses).toBeGreaterThan(retried.pauses);
    await page.getByRole('button',{name:'音をオンにする',exact:true}).click();
    const unmuted=await musicState(page);
    expect(unmuted.plays).toBeGreaterThan(retried.plays);
    await page.getByRole('button',{name:'一時停止',exact:true}).click();
    expect((await musicState(page)).pauses).toBeGreaterThan(unmuted.pauses);
    await page.getByRole('button',{name:'つづける',exact:false}).click();
    const resumed=await musicState(page);
    expect(resumed.plays).toBeGreaterThan(unmuted.plays);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    expect((await musicState(page)).pauses).toBeGreaterThan(resumed.pauses);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    expect((await musicState(page)).plays).toBe(resumed.plays);
    await page.getByRole('button',{name:'つづける',exact:false}).click();
    await tapCanvas(page,512,135);
    const failedAgain=await musicState(page);
    await page.getByRole('button',{name:'タイトルへ戻る',exact:true}).click();
    expect((await musicState(page)).plays).toBeGreaterThan(failedAgain.plays);
    expect(errors).toEqual([]);
  });

  test('autoplay blocking offers a direct retry',async({page})=>{
    await page.addInitScript(()=>{Object.assign(window,{blockTitleMusic:true});});
    await mockMusic(page);
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('もう一度タップ');
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('再生中');
    expect((await musicState(page)).plays).toBe(2);
  });

  test('keeps BGM at the same volume across player resets, game start and restart',async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{Object.assign(window,{resetMusicVolumeOnPlay:true});});
    await mockMusic(page);
    const time=new Date('2026-10-24T12:00:00Z');
    await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect.poll(()=>page.evaluate(()=>!!(window as any).musicMock?.options)).toBe(true);
    await page.clock.runFor(50);
    await expect(page.locator('#bgm-status')).toContainText('再生中');
    expect((await musicState(page)).volume).toBe(8);
    await page.evaluate(()=>{(window as any).musicMock.volume=42;});
    await page.clock.runFor(600);
    const corrected=await musicState(page);expect(corrected.volume).toBe(8);
    await page.clock.runFor(2000);
    const steady=await musicState(page);
    expect(steady.volumes).toEqual(corrected.volumes);
    expect(steady.volumeReads).toBeGreaterThan(corrected.volumeReads);
    await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
    expect((await musicState(page)).plays).toBe(steady.plays);
    await page.evaluate(()=>{(window as any).musicMock.volume=0;});
    await page.clock.runFor(600);
    expect((await musicState(page)).volume).toBe(8);
    await tapCanvas(page,512,135);
    await expect(page.locator('#result-screen')).toBeVisible();
    const failed=await musicState(page);
    await page.evaluate(()=>{(window as any).musicMock.volume=60;});await page.clock.runFor(2000);
    const stopped=await musicState(page);
    expect(stopped.volume).toBe(60);expect(stopped.volumeReads).toBe(failed.volumeReads);
    expect(stopped.volumes).toEqual(failed.volumes);
    await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();
    const restarted=await musicState(page);
    expect(restarted.volume).toBe(8);expect(restarted.plays).toBe(stopped.plays+1);
    expect(restarted.volumes.every((volume:number)=>volume===8)).toBe(true);
    await page.evaluate(()=>{(window as any).musicMock.options.events.onError();});
    const unavailable=await musicState(page);await page.clock.runFor(1000);
    expect((await musicState(page)).volumeReads).toBe(unavailable.volumeReads);
    expect(errors).toEqual([]);
  });

  test('a YouTube network failure leaves the game playable',async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://www.youtube.com/iframe_api',route=>route.abort());
    await page.goto('/');
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('再生できませんでした');
    await expect(page.getByRole('link',{name:'この曲をYouTubeで開く'})).toHaveAttribute('href','https://youtu.be/MuGFcUggtDs');
    await page.getByRole('button',{name:'はじめる',exact:true}).tap();
    await expect(page.locator('#stage-number')).toHaveText('01');
    expect(errors).toEqual([]);
  });

  test('a late player response starts during a mission but cannot restart music after failure',async({page})=>{
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('https://www.youtube.com/iframe_api',async route=>{
      await gate;await route.fulfill({contentType:'application/javascript',body:fakeApi});
    });
    await page.addInitScript(()=>{Math.random=()=>0;});
    await page.goto('/');
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await page.getByRole('button',{name:'はじめる',exact:true}).tap();
    release();
    await expect.poll(async()=>page.evaluate(()=>(window as any).musicMock?.plays??0)).toBeGreaterThan(0);
    expect((await musicState(page)).pauses).toBe(0);
    await expect(page.locator('#play-screen')).toBeVisible();
    await expect(page.locator('#title-bgm-player iframe')).toBeHidden();
    await expect(page.locator('#transition')).toBeHidden();
    await tapCanvas(page,512,135);
    await expect(page.locator('#result-screen')).toBeVisible();
    const failed=await musicState(page);
    expect(failed.pauses).toBeGreaterThan(0);
    await page.evaluate(()=>{(window as any).musicMock.options.events.onStateChange({data:1});});
    const late=await musicState(page);
    expect(late.pauses).toBeGreaterThan(failed.pauses);expect(late.plays).toBe(failed.plays);
  });

  test('clearing a stage keeps BGM playing and checkpoint retries resume it',async({page})=>{
    await page.addInitScript(()=>localStorage.setItem('sennyu-best-v1','20'));
    await mockMusic(page);
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('再生中');
    const time=new Date('2026-10-24T12:00:00Z');
    await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
    await page.getByRole('button',{name:'21からはじめる',exact:true}).click();await page.clock.runFor(1300);
    const beforeClear=await musicState(page);
    await tapCanvas(page,330,336);
    await expect(page.locator('#transition-title')).toHaveText('任務完了');
    expect((await musicState(page)).pauses).toBe(beforeClear.pauses);
    await page.clock.runFor(2400);
    await expect(page.locator('#stage-number')).toHaveText('22');
    expect((await musicState(page)).pauses).toBe(beforeClear.pauses);
    await page.clock.runFor(20000);
    await expect(page.locator('#result-screen')).toBeVisible();
    const failed=await musicState(page);
    expect(failed.pauses).toBeGreaterThan(beforeClear.pauses);
    await page.getByRole('button',{name:'21からリスタート',exact:true}).click();
    expect((await musicState(page)).plays).toBeGreaterThan(failed.plays);
    await expect(page.locator('#stage-number')).toHaveText('21');
  });

  test('restarts preserve explicit BGM stop and master mute choices',async({page})=>{
    await mockMusic(page);
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await expect(page.locator('#bgm-status')).toContainText('再生中');
    await page.getByRole('button',{name:'BGMを停止',exact:true}).tap();
    const stopped=await musicState(page);
    const time=new Date('2026-10-24T12:00:00Z');
    await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
    await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
    await tapCanvas(page,512,135);
    await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await page.clock.runFor(1300);
    expect((await musicState(page)).plays).toBe(stopped.plays);
    await page.getByRole('button',{name:'BGMを再生',exact:true}).click();
    await page.getByRole('button',{name:'音をオフにする',exact:true}).click();
    const muted=await musicState(page);
    await tapCanvas(page,512,135);
    await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();
    expect((await musicState(page)).plays).toBe(muted.plays);
    await page.getByRole('button',{name:'音をオンにする',exact:true}).click();
    expect((await musicState(page)).plays).toBeGreaterThan(muted.plays);
  });
});
