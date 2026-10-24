import {test,expect,type Page} from '@playwright/test';
import {tapCanvas} from './helpers';

async function savedBest(page:Page,best:number){
  await page.addInitScript(best=>{
    Math.random=()=>0;
    if(localStorage.getItem('sennyu-best-v1')===null)localStorage.setItem('sennyu-best-v1',String(best));
  },best);
  await page.goto('/');
  const time=new Date('2026-10-24T12:00:00Z');
  await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
}

test.describe('stage 21 checkpoint',()=>{
  test.use({viewport:{width:320,height:844},isMobile:true,hasTouch:true});

  test('19 clears keeps the checkpoint locked and hidden clicks cannot bypass it',async({page})=>{
    await savedBest(page,19);
    await expect(page.locator('#checkpoint-start-button')).toBeHidden();
    await page.locator('#checkpoint-start-button').evaluate((button:HTMLButtonElement)=>button.click());
    await expect(page.locator('#title-screen')).toBeVisible();
    await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
    await expect(page.locator('#stage-number')).toHaveText('01');
    await tapCanvas(page,512,135);
    await expect(page.locator('#alternate-retry-button')).toBeHidden();
  });

  test('an existing 20-clear record unlocks stage 21, quick retry and returning to stage 1',async({page})=>{
    await savedBest(page,20);
    await expect(page.getByRole('button',{name:'21からはじめる',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'21からはじめる',exact:true}).click();
    await expect(page.locator('#stage-number')).toHaveText('21');
    await expect(page.locator('#loop-label')).toHaveText('LOOP 03');
    await expect(page.locator('#speed-label')).toHaveText('SPEED ×1.40');
    await expect(page.locator('#cleared-label')).toHaveText('20 STAGES CLEARED');
    expect(await page.evaluate(()=>localStorage.getItem('sennyu-best-v1'))).toBe('20');
    await page.clock.runFor(1300);await tapCanvas(page,512,135);
    await expect(page.locator('#final-score')).toHaveText('20');
    await expect(page.locator('#result-rank')).toHaveText('あなたはSENPANです');
    await expect(page.locator('#new-record')).toBeHidden();
    await expect(page.locator('#result-message')).toBeHidden();
    await page.getByRole('button',{name:'21からリスタート',exact:true}).click();
    await expect(page.locator('#stage-number')).toHaveText('21');
    await page.clock.runFor(1300);await tapCanvas(page,512,135);
    await page.getByRole('button',{name:'1からはじめる',exact:true}).click();
    await expect(page.locator('#stage-number')).toHaveText('01');
    await expect(page.locator('#loop-label')).toHaveText('LOOP 01');
    await expect(page.locator('#speed-label')).toHaveText('SPEED ×1.00');
  });

  test('earning clear 20 unlocks immediately and further progress persists after reload',async({page})=>{
    await savedBest(page,19);
    await page.evaluate(async()=>{
      const modulePath='/src/games.ts';
      const {Round}=await import(/* @vite-ignore */ modulePath);
      Round.prototype.tick=function(){Object.assign(window,{finishCheckpointRound:(ok:boolean)=>this.end(ok,'テストの任務結果。')});};
    });
    const finish=(ok:boolean)=>page.evaluate(ok=>{
      (window as unknown as {finishCheckpointRound:(ok:boolean)=>void}).finishCheckpointRound(ok);
    },ok);
    await page.getByRole('button',{name:'はじめる',exact:true}).click();
    for(let stage=1;stage<=20;stage++){
      await expect(page.locator('#stage-number')).toHaveText(String(stage).padStart(2,'0'));
      await page.clock.runFor(1300);await finish(true);await page.clock.runFor(1500);
    }
    await expect(page.locator('#stage-number')).toHaveText('21');
    expect(await page.evaluate(()=>localStorage.getItem('sennyu-best-v1'))).toBe('20');
    await page.clock.runFor(1300);await finish(false);
    await expect(page.locator('#alternate-retry-button')).toHaveText('21からリスタート');
    await expect(page.locator('#alternate-retry-button')).toBeVisible();
    await page.locator('#alternate-retry-button').click();
    await expect(page.locator('#stage-number')).toHaveText('21');
    await page.clock.runFor(1300);await finish(true);
    expect(await page.evaluate(()=>localStorage.getItem('sennyu-best-v1'))).toBe('21');
    await page.reload();
    await expect(page.locator('#title-best')).toHaveText('21');
    await expect(page.getByRole('button',{name:'21からはじめる',exact:true})).toBeVisible();
  });
});
