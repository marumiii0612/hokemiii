import {test,expect,type Page} from '@playwright/test';
import {tapCanvas,watchAimTarget,readAimTarget} from './helpers';

async function movingAimFirst(page:Page){
  await watchAimTarget(page);
  await page.goto('/');
  await page.evaluate(()=>{
    let sample=0;
    Math.random=()=>{sample++;return sample>=5&&sample<=7 ? .999 : 0;};
  });
  const time=new Date('2026-10-24T12:00:00Z');
  await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.clock.runFor(1300);
  await expect(page.locator('#mission-title')).toHaveText('狙え。');
  await expect(page.locator('#transition')).toBeHidden();
}

test.describe('moving aim target',()=>{
  test.use({viewport:{width:320,height:844},hasTouch:true,isMobile:true});
  for(const input of ['touch','keyboard']){
    test(`${input} can hit the current position of the moving target`,async({page})=>{
      const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
      await movingAimFirst(page);
      const before=await readAimTarget(page);
      await page.clock.runFor(700);
      const after=await readAimTarget(page);
      expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeGreaterThan(40);
      if(input==='touch')await tapCanvas(page,after.x,after.y);
      else{
        const dx=Math.round((after.x-360)/8),dy=Math.round((after.y-440)/8);
        for(let i=0;i<Math.abs(dx);i++)await page.keyboard.press(dx<0?'ArrowLeft':'ArrowRight');
        for(let i=0;i<Math.abs(dy);i++)await page.keyboard.press(dy<0?'ArrowUp':'ArrowDown');
        await page.keyboard.press('Space');
      }
      await expect(page.locator('#transition-title')).toHaveText('任務完了');
      await expect(page.locator('#result-screen')).toBeHidden();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
  test('shooting the old target position fails without revealing the answer',async({page})=>{
    await movingAimFirst(page);
    const before=await readAimTarget(page);
    await page.clock.runFor(700);
    await tapCanvas(page,before.x,before.y);
    await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
    await expect(page.locator('#final-score')).toHaveText('0');
    await expect(page.locator('#result-message')).toBeHidden();
    await expect(page.locator('#result-message')).toBeEmpty();
  });
});

test('the body, heart and hit area move together at all speeds and both sides remain hittable',async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const modulePath='/src/games.ts';
    const {createRound}=await import(/* @vite-ignore */ modulePath);
    const original=Math.random;
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=640;
    const c=canvas.getContext('2d')!;
    const translations:{x:number;y:number}[]=[];
    const targets:{x:number;y:number}[]=[];
    const translate=c.translate.bind(c),arc=c.arc.bind(c);
    c.translate=(x,y)=>{translations.push({x,y});translate(x,y);};
    c.arc=(x,y,r,start,end,anticlockwise)=>{if(r===21)targets.push({x,y});arc(x,y,r,start,end,anticlockwise);};
    const draw=(game:any)=>{
      translations.length=0;targets.length=0;game.draw(c);
      return {body:translations[0],heart:translations[1],target:targets[0]};
    };
    const advance=(game:any,seconds:number)=>{
      for(let left=seconds;left>1e-8;left-=.01)game.tick(Math.min(.01,left));
    };
    try{
      return [1,9,57].flatMap(stage=>[0,.999].map(random=>{
        Math.random=()=>random;
        const run=()=>{
          const verdict:boolean[]=[];
          const game=createRound('aim',{finish:(ok:boolean)=>verdict.push(ok),sound:()=>{}},stage);
          return {game,verdict};
        };
        const speed=Math.min(2.4,1+Math.floor((stage-1)/8)*.2);
        const aim=run(),before=draw(aim.game);
        advance(aim.game,.7/speed);const after=draw(aim.game);
        const bodyDx=after.body.x-before.body.x,bodyDy=after.body.y-before.body.y;
        const aligned=[after.heart.x-before.heart.x,after.target.x-before.target.x].every(dx=>Math.abs(dx-bodyDx)<1e-6)
          &&[after.heart.y-before.heart.y,after.target.y-before.target.y].every(dy=>Math.abs(dy-bodyDy)<1e-6);
        aim.game.pointer(after.target.x,after.target.y);
        const heart=run();advance(heart.game,.7/speed);const heartPosition=draw(heart.game).heart;
        heart.game.pointer(heartPosition.x,heartPosition.y);
        const old=run();advance(old.game,.7/speed);old.game.pointer(before.target.x,before.target.y);
        const bounds=run();let inside=true;
        for(let i=0;i<59;i++){
          advance(bounds.game,.1/speed);const pose=draw(bounds.game);
          inside&&=pose.body.x-168>20&&pose.body.x+168<700&&pose.body.y+198<560&&pose.target.x>21&&pose.target.x<699;
        }
        return {moved:Math.hypot(bodyDx,bodyDy)>40,aligned,hit:aim.verdict[0],heartRejected:heart.verdict[0]===false,oldPositionRejected:old.verdict[0]===false,inside};
      }));
    }finally{Math.random=original;}
  });
  expect(results).toEqual(Array.from({length:6},()=>({moved:true,aligned:true,hit:true,heartRejected:true,oldPositionRejected:true,inside:true})));
});
