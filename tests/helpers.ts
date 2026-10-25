import type { Page } from '@playwright/test';

export async function watchAudioActivity(page:Page){
  await page.addInitScript(()=>{
    const activity={contexts:0,elements:0,plays:0};
    Object.assign(window,{audioActivity:activity});
    for(const name of ['AudioContext','webkitAudioContext','Audio']){
      const original=(window as any)[name];if(!original)continue;
      (window as any)[name]=new Proxy(original,{construct(target,args,newTarget){
        if(name==='Audio')activity.elements++;else activity.contexts++;
        return Reflect.construct(target,args,newTarget);
      }});
    }
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){activity.plays++;return play.call(this);};
  });
}

export async function audioActivity(page:Page){
  return page.evaluate(()=>(window as any).audioActivity as {contexts:number;elements:number;plays:number});
}

export async function watchAimTarget(page:Page){
  await page.addInitScript(()=>{
    const arc=CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc=function(x,y,radius,start,end,anticlockwise){
      if(radius===21)Object.assign(window,{drawnAimTarget:{x,y}});
      arc.call(this,x,y,radius,start,end,anticlockwise);
    };
    const roundRect=CanvasRenderingContext2D.prototype.roundRect;
    CanvasRenderingContext2D.prototype.roundRect=function(x,y,width,height,radii){
      if(width===6&&height===18)Object.assign(window,{drawnAimBullet:{x:x+3,y:y+9}});
      roundRect.call(this,x,y,width,height,radii);
    };
  });
}

export async function readAimBullet(page:Page){
  return page.evaluate(()=>{
    const bullet=(window as unknown as {drawnAimBullet?:{x:number;y:number}}).drawnAimBullet;
    if(!bullet)throw new Error('The bullet has not been drawn.');
    return bullet;
  });
}

export async function readAimTarget(page:Page){
  return page.evaluate(()=>{
    const target=(window as unknown as {drawnAimTarget?:{x:number;y:number}}).drawnAimTarget;
    if(!target)throw new Error('The aim target has not been drawn.');
    return target;
  });
}

export async function tapCanvas(page: Page, x: number, y: number) {
  const bounds = await page.locator('#game-canvas').boundingBox();
  if (!bounds) throw new Error('The game canvas is not visible');
  const px = bounds.x + x / 720 * bounds.width;
  const py = bounds.y + y / 640 * bounds.height;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    await page.touchscreen.tap(px, py);
  } else {
    await page.mouse.click(px, py);
  }
}
