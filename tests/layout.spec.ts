import {test,expect,type Page} from '@playwright/test';

async function layout(page:Page){
  return page.evaluate(()=>{
    const box=(selector:string)=>{
      const bounds=document.querySelector(selector)!.getBoundingClientRect();
      return{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,bottom:bounds.bottom,right:bounds.right};
    };
    return{canvas:box('#game-canvas'),controls:box('.controls-slot'),
      width:innerWidth,height:innerHeight,scrollY,documentHeight:document.documentElement.scrollHeight,
      documentWidth:document.documentElement.scrollWidth};
  });
}

async function visibleControls(page:Page){
  const bounds=await layout(page);
  for(const box of [bounds.canvas,bounds.controls]){
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(bounds.width+.5);expect(box.bottom).toBeLessThanOrEqual(bounds.height+.5);
  }
  expect(bounds.canvas.width).toBeGreaterThan(100);expect(bounds.canvas.height).toBeGreaterThan(80);
  expect(bounds.scrollY).toBe(0);expect(bounds.documentHeight).toBeLessThanOrEqual(bounds.height);
  expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.width);
  for(const button of await page.locator('#controls button:visible').all()){
    const box=(await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y+box.height).toBeLessThanOrEqual(bounds.height);
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(bounds.width);
    expect(await button.evaluate(button=>button.scrollWidth<=button.clientWidth)).toBe(true);
  }
  return bounds;
}

const sizes=[
  {width:320,height:568,music:false},
  {width:320,height:568,music:true},
  {width:375,height:667,music:false},
  {width:390,height:844,music:false},
  {width:844,height:390,music:true},
  {width:1280,height:720,music:false},
];

for(const size of sizes){
  test.describe(`${size.width}×${size.height}${size.music?' with BGM':''}`,()=>{
    test.use({viewport:{width:size.width,height:size.height},hasTouch:true,isMobile:size.width<1000});
    test('all eight missions keep canvas and controls stationary in one viewport',async({page})=>{
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        Math.random=()=>0;
        // Keep a visible player without depending on YouTube's network availability.
        (window as any).YT={Player:class{
          frame:HTMLIFrameElement;
          constructor(element:HTMLElement,private options:any){
            this.frame=document.createElement('iframe');this.frame.srcdoc='BGM test player';element.replaceWith(this.frame);
            setTimeout(()=>options.events.onReady({target:this}),0);
          }
          setVolume(){}
          playVideo(){this.options.events.onStateChange({data:1});}
          pauseVideo(){}
          destroy(){this.frame.remove();}
          getIframe(){return this.frame;}
        }};
      });
      await page.goto('/');
      await page.evaluate(async()=>{
        const modulePath='/src/games.ts';
        const {Round}=await import(/* @vite-ignore */ modulePath);
        const tick=Round.prototype.tick;
        // Only force outcomes; retain real drawings, phase changes and controls.
        Round.prototype.tick=function(dt:number){
          Object.assign(window,{finishLayoutRound:()=>this.end(true,'テスト完了。')});tick.call(this,dt);
        };
      });
      if(size.music){
        await page.getByRole('button',{name:'BGMを再生',exact:true}).click();
        await expect(page.locator('#bgm-status')).toContainText('再生中');
      }
      const time=new Date('2026-10-24T12:00:00Z');
      await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
      await page.evaluate(()=>window.scrollTo(0,1000));
      await page.getByRole('button',{name:'はじめる',exact:true}).click();
      const initial=await visibleControls(page);
      for(let stage=1;stage<=8;stage++){
        await expect(page.locator('#stage-number')).toHaveText(String(stage).padStart(2,'0'));
        await page.clock.runFor(1300);
        await expect(page.locator('#transition')).toBeHidden();
        const mission=await page.locator('#mission-title').textContent();
        if(mission==='伝えろ。')await page.clock.runFor(4100);
        if(mission==='覚えろ。'){
          await page.clock.runFor(3100);
          await expect(page.locator('#controls button')).toHaveCount(4);
        }
        const current=await visibleControls(page);
        expect(current.canvas).toEqual(initial.canvas);expect(current.controls).toEqual(initial.controls);
        if(size.music){
          const frame=(await page.locator('#title-bgm-player iframe').boundingBox())!;
          expect(frame.width).toBeGreaterThanOrEqual(200);expect(frame.height).toBeGreaterThanOrEqual(200);
          expect(frame.x).toBeGreaterThanOrEqual(0);expect(frame.y).toBeGreaterThanOrEqual(0);
          expect(frame.x+frame.width).toBeLessThanOrEqual(size.width);expect(frame.y+frame.height).toBeLessThanOrEqual(size.height);
        }
        if(stage===1){
          await page.mouse.wheel(0,500);await page.clock.runFor(100);
          const afterScroll=await visibleControls(page);
          expect(afterScroll.canvas).toEqual(initial.canvas);expect(afterScroll.controls).toEqual(initial.controls);
        }
        await page.evaluate(()=>(window as any).finishLayoutRound());
        const feedback=await visibleControls(page);
        expect(feedback.canvas).toEqual(initial.canvas);expect(feedback.controls).toEqual(initial.controls);
        await page.clock.runFor(1500);
      }
      await expect(page.locator('#stage-number')).toHaveText('09');
      // Rotation/resizing must also retain an operable, scroll-free play area.
      await page.setViewportSize({width:size.height,height:size.width});
      await visibleControls(page);
      expect(errors).toEqual([]);
    });
  });
}
