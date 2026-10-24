import {test,expect,type Page} from '@playwright/test';
import {tapCanvas} from './helpers';

// Test the integration without relying on YouTube's network or autoplay availability.
const fakeApi=`
window.musicMock={plays:0,pauses:0,volumes:[],blockNext:!!window.blockTitleMusic};
window.YT={Player:class{
  constructor(element,options){
    this.options=options;window.musicMock.options=options;
    this.frame=document.createElement('iframe');this.frame.srcdoc='<p>YouTube player test double</p>';
    element.replaceWith(this.frame);setTimeout(()=>options.events.onReady({target:this}),0);
  }
  setVolume(volume){window.musicMock.volumes.push(volume);}
  playVideo(){
    window.musicMock.plays++;
    if(window.musicMock.blockNext){window.musicMock.blockNext=false;this.options.events.onAutoplayBlocked();}
    else this.options.events.onStateChange({target:this,data:1});
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
    return {plays:mock.plays,pauses:mock.pauses,volumes:mock.volumes,videoId:mock.options.videoId,vars:mock.options.playerVars};
  });
}

test.describe('title BGM and louder effects',()=>{
  test.use({viewport:{width:320,height:844},isMobile:true,hasTouch:true});
  test('loads on request, uses low BGM volume, stops during play and respects mute and tab visibility',async({page})=>{
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
    await expect(page.locator('#title-bgm-player iframe')).toHaveAttribute('title','タイトルBGM — YouTube');
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
    const beforeGame=await musicState(page);
    await page.getByRole('button',{name:'はじめる',exact:true}).tap();
    await expect(page.locator('#transition')).toBeHidden();
    expect((await musicState(page)).pauses).toBeGreaterThan(beforeGame.pauses);
    expect((await musicState(page)).plays).toBe(beforeGame.plays);
    await tapCanvas(page,512,135);
    await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
    const effects=await page.evaluate(()=>{const trace=(window as any).soundTrace;return {peak:Math.max(...trace.peaks),starts:trace.starts};});
    expect(effects.peak).toBeGreaterThan(.2);expect(effects.starts).toBeGreaterThan(0);
    await page.getByRole('button',{name:'タイトルへ戻る',exact:true}).tap();
    expect((await musicState(page)).plays).toBeGreaterThan(beforeGame.plays);
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

  test('a late player response cannot start BGM during a mission',async({page})=>{
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('https://www.youtube.com/iframe_api',async route=>{
      await gate;await route.fulfill({contentType:'application/javascript',body:fakeApi});
    });
    await page.goto('/');
    await page.getByRole('button',{name:'BGMを再生',exact:true}).tap();
    await page.getByRole('button',{name:'はじめる',exact:true}).tap();
    release();
    await expect.poll(async()=>page.evaluate(()=>(window as any).musicMock?.pauses??0)).toBeGreaterThan(0);
    expect((await musicState(page)).plays).toBe(0);
    await expect(page.locator('#play-screen')).toBeVisible();
  });
});
