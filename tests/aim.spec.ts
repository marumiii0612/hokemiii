import {test,expect,type Page} from '@playwright/test';
import {tapCanvas,watchAimTarget,readAimTarget,readAimBullet} from './helpers';

async function movingAimFirst(page:Page){
  await watchAimTarget(page);
  await page.goto('/');
  await page.evaluate(()=>{
    let sample=0;
    Math.random=()=>{sample++;return sample>=6&&sample<=8 ? .999 : 0;};
  });
  const time=new Date('2026-10-24T12:00:00Z');
  await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.clock.runFor(1300);
  await expect(page.locator('#mission-title')).toHaveText('狙え。');
  await expect(page.locator('#transition')).toBeHidden();
}

test.describe('fixed vertical shot at a moving target',()=>{
  test.use({viewport:{width:320,height:844},hasTouch:true,isMobile:true});
  for(const input of ['touch','keyboard']){
    test(`${input} fires straight upward and hits with correct timing`,async({page})=>{
      const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
      await movingAimFirst(page);
      const before=await readAimTarget(page);
      await page.clock.runFor(700);
      const after=await readAimTarget(page);
      expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeGreaterThan(40);
      await page.clock.runFor(1000);
      if(input==='touch')await tapCanvas(page,48,500);
      else{
        await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Space');
      }
      await expect(page.locator('#transition')).toBeHidden();
      await page.clock.runFor(80);const first=await readAimBullet(page);
      await page.clock.runFor(80);const second=await readAimBullet(page);
      expect(first.x).toBe(360);expect(second.x).toBe(360);
      expect(second.y).toBeLessThan(first.y);
      await expect(page.locator('#transition')).toBeHidden();
      await page.clock.runFor(400);
      await expect(page.locator('#transition-title')).toHaveText('任務完了');
      await expect(page.locator('#result-screen')).toBeHidden();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
  test('tapping the off-axis target cannot redirect the bullet or reveal the answer',async({page})=>{
    await movingAimFirst(page);
    await page.clock.runFor(700);
    const target=await readAimTarget(page);await tapCanvas(page,target.x,target.y);
    await expect(page.locator('#result-screen')).toBeHidden();
    await page.clock.runFor(700);
    await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
    await expect(page.locator('#final-score')).toHaveText('0');
    await expect(page.locator('#result-message')).toBeHidden();
    await expect(page.locator('#result-message')).toBeEmpty();
  });
});

test('vertical bullets use moving collisions at all speeds, reject heart shots, and allow only one round',async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const modulePath='/src/games.ts';
    const {createRound}=await import(/* @vite-ignore */ modulePath);
    const original=Math.random;
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=640;
    const c=canvas.getContext('2d')!;
    const translations:{x:number;y:number}[]=[];
    const targets:{x:number;y:number}[]=[];
    const bullets:{x:number;y:number}[]=[];
    const translate=c.translate.bind(c),arc=c.arc.bind(c),roundRect=c.roundRect.bind(c);
    c.translate=(x,y)=>{translations.push({x,y});translate(x,y);};
    c.arc=(x,y,r,start,end,anticlockwise)=>{if(r===21)targets.push({x,y});arc(x,y,r,start,end,anticlockwise);};
    c.roundRect=(x,y,width,height,radii)=>{if(width===6&&height===18)bullets.push({x:x+3,y:y+9});roundRect(x,y,width,height,radii);};
    const draw=(game:any)=>{
      translations.length=0;targets.length=0;bullets.length=0;game.draw(c);
      return {body:translations[0],heart:translations[1],target:targets[0],bullet:bullets[0]};
    };
    const advance=(game:any,seconds:number,step=.01)=>{
      for(let left=seconds;left>1e-8;left-=step)game.tick(Math.min(step,left));
    };
    try{
      return [1,10,64].flatMap(stage=>[0,.25,.49,.51,.75,.999].map(random=>{
        Math.random=()=>random;
        const run=()=>{
          const verdict:{ok:boolean;message:string}[]=[];const shots:string[]=[];
          const game=createRound('aim',{finish:(ok:boolean,message:string)=>verdict.push({ok,message}),sound:(kind:string)=>shots.push(kind)},stage);
          return {game,verdict,shots};
        };
        const speed=Math.min(2.4,1+Math.floor((stage-1)/9)*.2);
        const aim=run(),before=draw(aim.game);
        advance(aim.game,.7/speed);const after=draw(aim.game);
        const bodyDx=after.body.x-before.body.x,bodyDy=after.body.y-before.body.y;
        const aligned=[after.heart.x-before.heart.x,after.target.x-before.target.x].every(dx=>Math.abs(dx-bodyDx)<1e-6)
          &&[after.heart.y-before.heart.y,after.target.y-before.target.y].every(dy=>Math.abs(dy-bodyDy)<1e-6);
        const crossing=(Math.PI+Math.asin(Math.abs(before.target.x-360)/92))/2;
        const launch=crossing/speed-.28;
        const hit=run();advance(hit.game,launch);hit.game.move(50,60);
        hit.game.action('left');hit.game.action('up');hit.game.pointer(40,500);hit.game.pointer(650,50);
        const first=draw(hit.game).bullet!;advance(hit.game,.08);const second=draw(hit.game).bullet!;
        advance(hit.game,.57);
        const side=Math.sign(before.target.x-before.heart.x);
        const heartCrossing=(Math.PI-Math.asin((360-before.heart.x)/(side*92)))/2;
        const heart=run();advance(heart.game,heartCrossing/speed-.28);heart.game.action('primary');advance(heart.game,.65);
        const miss=run();miss.game.pointer(before.target.x,before.target.y);advance(miss.game,.7);
        const coarse=run();advance(coarse.game,launch,.05);coarse.game.action('primary');advance(coarse.game,.65,.05);
        const bounds=run();let inside=true;
        for(let i=0;i<59;i++){
          advance(bounds.game,.1/speed);const pose=draw(bounds.game);
          inside&&=pose.body.x-168>20&&pose.body.x+168<700&&pose.body.y+198<560&&pose.target.x>21&&pose.target.x<699;
        }
        return {moved:Math.hypot(bodyDx,bodyDy)>40,aligned,hit:hit.verdict[0]?.ok,heartRejected:heart.verdict[0]?.ok===false&&heart.verdict[0].message.includes('心臓'),missRejected:miss.verdict[0]?.ok===false,straight:first.x===360&&second.x===360&&second.y<first.y,oneShot:hit.shots.length===1,coarseHit:coarse.verdict[0]?.ok,inside};
      }));
    }finally{Math.random=original;}
  });
  expect(results).toEqual(Array.from({length:18},()=>({moved:true,aligned:true,hit:true,heartRejected:true,missRejected:true,straight:true,oneShot:true,coarseHit:true,inside:true})));
});
