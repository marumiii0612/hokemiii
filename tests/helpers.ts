import type { Page } from '@playwright/test';

export async function watchAimTarget(page:Page){
  await page.addInitScript(()=>{
    const arc=CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc=function(x,y,radius,start,end,anticlockwise){
      if(radius===21)Object.assign(window,{drawnAimTarget:{x,y}});
      arc.call(this,x,y,radius,start,end,anticlockwise);
    };
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
