import {test,expect,type Page} from '@playwright/test';
import {tapCanvas} from './helpers';

async function laserFirst(page:Page){
  await page.goto('/');
  await page.evaluate(()=>{
    let sample=0;
    Math.random=()=>{sample++;return sample===6||sample===7 ? .999 : 0;};
  });
  await page.clock.install();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.clock.runFor(1300);
  await expect(page.locator('#mission-title')).toHaveText('よけろ。');
  await expect(page.locator('#transition')).toBeHidden();
}

test.describe('four laser columns and jumping',()=>{
  test.use({viewport:{width:320,height:844},hasTouch:true,isMobile:true});
  for(const input of ['touch','keyboard']){
    test(`${input}: evade columns and jump over both low lasers`,async({page})=>{
      const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
      await laserFirst(page);
      const controls=page.locator('#controls');
      await expect(controls).toHaveClass(/three/);
      await expect(controls.locator('button')).toHaveCount(3);
      const emitters=await page.locator('#game-canvas').evaluate((canvas:HTMLCanvasElement)=>{
        const scale=canvas.width/720;
        return [150,290,430,570].map(x=>canvas.getContext('2d')!.getImageData(Math.round(x*scale),Math.round(112*scale),1,1).data[1]);
      });
      expect(emitters.every(green=>green>60)).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const buttons=await controls.locator('button').all();
      const boxes=await Promise.all(buttons.map(button=>button.boundingBox()));
      expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
      expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
      if(input==='touch')await controls.getByRole('button',{name:'左へ'}).tap();
      else await page.keyboard.press('ArrowLeft');
      await page.clock.runFor(2300);
      if(input==='touch')await controls.getByRole('button',{name:'ジャンプ'}).tap();
      else await page.keyboard.press('Space');
      await page.clock.runFor(3300);
      await expect(page.locator('#result-screen')).toBeHidden();
      if(input==='touch')await tapCanvas(page,360,350);
      else await page.keyboard.press('ArrowUp');
      await page.clock.runFor(1500);
      await expect(page.locator('#transition-title')).toHaveText('任務完了');
      await expect(page.locator('#result-screen')).toBeHidden();
      expect(errors).toEqual([]);
    });
  }
});

test('low lasers require jumps, vertical lasers remain dangerous in the air, and all speeds are playable',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const modulePath='/src/games.ts';
    const {createRound}=await import(/* @vite-ignore */ modulePath);
    const original=Math.random;Math.random=()=>0;
    const run=(stage:number)=>{
      const verdict:boolean[]=[];
      const game=createRound('laser',{finish:(ok:boolean)=>verdict.push(ok),sound:()=>{}},stage);
      return {game,verdict};
    };
    const advance=(game:any,seconds:number)=>{
      for(let remaining=seconds;remaining>1e-8;remaining-=.005)game.tick(Math.min(.005,remaining));
    };
    try{
      const speeds=[1,9,57].map(stage=>{
        const speed=Math.min(2.4,1+Math.floor((stage-1)/8)*.2);
        const survive=run(stage);survive.game.action('left');
        advance(survive.game,2.35/speed);survive.game.action('jump');
        advance(survive.game,.55/speed);survive.game.action('jump'); // A tap in midair must not restart the jump.
        advance(survive.game,2.75/speed);survive.game.action('up');
        advance(survive.game,1.5/speed);
        const left=run(stage);left.game.action('left');advance(left.game,3.35/speed);
        const right=run(stage);right.game.action('right');right.game.action('right');advance(right.game,3.35/speed);
        const vertical=run(stage);advance(vertical.game,.8/speed);vertical.game.action('primary');advance(vertical.game,1/speed);
        return {survived:survive.verdict[0],lowHitsLeft:left.verdict[0]===false,lowHitsRight:right.verdict[0]===false,verticalHitsInAir:vertical.verdict[0]===false};
      });
      let sample=0;Math.random=()=>sample++%3===0?0:.999;
      const fourth=run(1);for(let i=0;i<10;i++)fourth.game.action('right');advance(fourth.game,2);
      Math.random=()=>.999;
      const first=run(1);for(let i=0;i<10;i++)first.game.action('left');advance(first.game,2);
      return {speeds,fourthColumnHits:fourth.verdict[0]===false,firstColumnHits:first.verdict[0]===false};
    }finally{Math.random=original;}
  });
  expect(result).toEqual({speeds:Array.from({length:3},()=>({survived:true,lowHitsLeft:true,lowHitsRight:true,verticalHitsInAir:true})),fourthColumnHits:true,firstColumnHits:true});
});

test('combined beams unlock gradually and require both moving and jumping at the same time',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const modulePath='/src/games.ts';
    const {createRound}=await import(/* @vite-ignore */ modulePath);
    const original=Math.random;
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=640;
    const c=canvas.getContext('2d')!;
    const advance=(game:any,seconds:number)=>{
      for(let remaining=seconds;remaining>1e-8;remaining-=.005)game.tick(Math.min(.005,remaining));
    };
    const beams=(game:any,x:number)=>{
      game.draw(c);
      return {vertical:c.getImageData(x,300,1,1).data[0]>180,horizontal:c.getImageData(360,526,1,1).data[0]>180};
    };
    const run=(stage:number,move:boolean,jump:boolean)=>{
      Math.random=()=>0;
      const verdict:boolean[]=[];
      const speed=Math.min(2.4,1+Math.floor((stage-1)/8)*.2);
      const game=createRound('laser',{finish:(ok:boolean)=>verdict.push(ok),sound:()=>{}},stage);
      game.action('left');
      advance(game,2.35/speed);game.action('jump');
      advance(game,.85/speed);const early=beams(game,290);
      advance(game,2.3/speed);
      // Put the last vertical beams in the player's current column, requiring a move.
      Math.random=()=>.999;
      advance(game,.2/speed);
      if(move){game.action('right');game.action('right');}
      if(jump)game.action('jump');
      advance(game,.7/speed);const late=beams(game,150);
      advance(game,.8/speed);
      return {early,late,ok:verdict[0]};
    };
    try{
      return {
        progression:[1,9,17,57].map(stage=>run(stage,true,true)),
        jumpOnly:[9,17,57].map(stage=>run(stage,false,true).ok),
        moveOnly:[9,17,57].map(stage=>run(stage,true,false).ok),
        firstLoopJumpOnly:run(1,false,true).ok,
      };
    }finally{Math.random=original;}
  });
  expect(result).toEqual({
    progression:[
      {early:{vertical:false,horizontal:true},late:{vertical:false,horizontal:true},ok:true},
      {early:{vertical:false,horizontal:true},late:{vertical:true,horizontal:true},ok:true},
      {early:{vertical:true,horizontal:true},late:{vertical:true,horizontal:true},ok:true},
      {early:{vertical:true,horizontal:true},late:{vertical:true,horizontal:true},ok:true},
    ],
    jumpOnly:[false,false,false],moveOnly:[false,false,false],firstLoopJumpOnly:true,
  });
});
