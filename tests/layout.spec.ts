import {test,expect,type Page} from '@playwright/test';

async function layout(page:Page){
  return page.evaluate(()=>{
    const box=(selector:string)=>{
      const bounds=document.querySelector(selector)!.getBoundingClientRect();
      return{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,bottom:bounds.bottom,right:bounds.right};
    };
    return{header:box('.site-header'),canvas:box('#game-canvas'),controls:box('.controls-slot'),
      width:innerWidth,height:innerHeight,scrollY,documentHeight:document.documentElement.scrollHeight,
      documentWidth:document.documentElement.scrollWidth};
  });
}

async function visibleControls(page:Page){
  const bounds=await layout(page);
  for(const box of [bounds.header,bounds.canvas,bounds.controls]){
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(bounds.width+.5);expect(box.bottom).toBeLessThanOrEqual(bounds.height+.5);
  }
  expect(bounds.header.y).toBeGreaterThanOrEqual(8);
  expect(bounds.controls.bottom).toBeLessThanOrEqual(bounds.height-8);
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
  {width:320,height:568},
  {width:375,height:667},
  {width:390,height:844},
  {width:844,height:390},
  {width:1280,height:720},
];

for(const size of sizes){
  test.describe(`${size.width}×${size.height}`,()=>{
    test.use({viewport:{width:size.width,height:size.height},hasTouch:true,isMobile:size.width<1000});
    test('all nine missions keep canvas and controls stationary in one viewport',async({page})=>{
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        Math.random=()=>0;
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
      const time=new Date('2026-10-24T12:00:00Z');
      await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
      await page.evaluate(()=>window.scrollTo(0,1000));
      await page.getByRole('button',{name:'はじめる',exact:true}).click();
      const initial=await visibleControls(page);
      if(size.width<size.height){
        const screenWidth=await page.locator('#play-screen').evaluate(screen=>screen.clientWidth);
        expect(initial.canvas.width).toBeGreaterThanOrEqual(screenWidth*.95-3);
      }
      for(let stage=1;stage<=9;stage++){
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
      await expect(page.locator('#stage-number')).toHaveText('10');
      // Rotation/resizing must also retain an operable, scroll-free play area.
      await page.setViewportSize({width:size.height,height:size.width});
      await visibleControls(page);
      expect(errors).toEqual([]);
    });
  });
}
