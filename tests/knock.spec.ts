import {test,expect,type Page} from '@playwright/test';
import {tapCanvas} from './helpers';

async function startKnock(page:Page){
  await page.addInitScript(()=>{
    let sample=0;
    // Put Knock first; the five digits are 2, 3, 4, 5, 2.
    Math.random=()=>{sample++;return sample===7?.999:sample>=8&&sample<=12?[0,.25,.5,.75,0][sample-8]:0;};
    const fillText=CanvasRenderingContext2D.prototype.fillText;
    Object.assign(window,{drawnKnockText:[] as string[]});
    CanvasRenderingContext2D.prototype.fillText=function(value,x,y,maxWidth){
      if(this.canvas.id==='game-canvas')(window as any).drawnKnockText.push(value);
      fillText.call(this,value,x,y,...(maxWidth===undefined?[]:[maxWidth]));
    };
  });
  await page.goto('/');
  const time=new Date('2026-10-24T12:00:00Z');
  await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.clock.runFor(1300);
  await expect(page.locator('#mission-title')).toHaveText('伝えろ。');
}

async function paperPixel(page:Page,y:number){
  return page.locator('#game-canvas').evaluate((canvas:HTMLCanvasElement,y)=>{
    const scale=canvas.width/720;
    return canvas.getContext('2d')!.getImageData(Math.round(360*scale),Math.round(y*scale),1,1).data[0];
  },y);
}

test.describe('memorize the paper authentication code',()=>{
  test.use({viewport:{width:320,height:844},isMobile:true,hasTouch:true});

  test('paper dissolves before touch input, code stays hidden and the remembered code opens the door',async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await startKnock(page);
    await expect(page.locator('#controls')).toBeHidden();
    expect(await paperPixel(page,210)).toBeGreaterThan(150);
    await page.keyboard.press('Space');await tapCanvas(page,360,450);
    await page.clock.runFor(2800);
    await expect(page.locator('#controls')).toBeHidden();
    expect(await paperPixel(page,210)).toBeGreaterThan(150);
    await page.clock.runFor(650);
    await expect(page.locator('#game-hint')).toContainText('紙が消える');
    expect(await paperPixel(page,210)).toBeLessThan(90);
    expect(await paperPixel(page,410)).toBeGreaterThan(150);
    await tapCanvas(page,360,450);await page.keyboard.press('Space');
    await expect(page.locator('#result-screen')).toBeHidden();
    await page.clock.runFor(650);
    await expect(page.locator('#controls')).toBeVisible();
    await expect(page.locator('#controls button')).toHaveText('ノックSPACE');
    await page.evaluate(()=>{(window as any).drawnKnockText=[];});await page.clock.runFor(50);
    const drawn=await page.evaluate(()=>(window as any).drawnKnockText as string[]);
    expect(drawn).toContain('あなたの番');
    expect(drawn.some(value=>/[0-9０-９]/.test(value))).toBe(false);
    expect(drawn).not.toContain('認証コード');
    expect(await paperPixel(page,210)).toBeLessThan(90);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(let turn=0;turn<3;turn++){
      const taps=[2,4,2][turn];
      for(let i=0;i<taps;i++)await page.locator('#controls button').click();
      if(turn<2){
        await page.clock.runFor(650);
        await expect(page.locator('#controls button')).toContainText('応答を待て');
        await page.clock.runFor(turn===0?1700:2400);
        await expect(page.locator('#controls button')).toContainText('ノック');
      }
    }
    await page.clock.runFor(650);
    await expect(page.locator('#transition')).toHaveClass(/door-clear/);
    await expect(page.locator('#game-hint')).toHaveText('認証成功。扉が開きます。');
    expect(errors).toEqual([]);
  });

  for(const opponentTurn of [1,2]){
    for(const input of ['canvas','button','keyboard']){
      test(`knocking during opponent turn ${opponentTurn} via ${input} immediately fails`,async({page})=>{
        await startKnock(page);await page.clock.runFor(4000);
        for(let turn=0;turn<opponentTurn;turn++){
          for(let i=0;i<[2,4][turn];i++)await page.locator('#controls button').click();
          await page.clock.runFor(650);
          await expect(page.locator('#controls button')).toContainText('応答を待て');
          if(turn<opponentTurn-1){
            await page.clock.runFor(1700);
            await expect(page.locator('#controls button')).toContainText('ノック');
          }
        }
        // Cover the start, active reply and the pause after the final automatic knock.
        if(input==='canvas')await page.clock.runFor(500);
        if(input==='keyboard')await page.clock.runFor(([3,5][opponentTurn-1]*.32+.1)*1000);
        await expect(page.locator('#controls button')).toContainText('応答を待て');
        if(input==='canvas')await tapCanvas(page,360,450);
        else if(input==='button')await page.locator('#controls button').click();
        else await page.keyboard.press('Space');
        await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
        await expect(page.locator('#final-score')).toHaveText('0');
        await expect(page.locator('#result-message')).toBeEmpty();
        await expect(page.locator('#result-message')).toBeHidden();
        await expect(page.getByRole('button',{name:'もう一度、潜入する',exact:true})).toBeVisible();
      });
    }
  }

  test('extra knocks still fail without revealing the code and retry returns to a fresh paper',async({page})=>{
    await startKnock(page);await page.clock.runFor(4000);
    for(let i=0;i<3;i++)await page.keyboard.press('Space');
    await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
    await expect(page.locator('#result-message')).toBeEmpty();
    await expect(page.locator('#result-message')).toBeHidden();
    await page.evaluate(()=>{
      let sample=0;Math.random=()=>++sample===7?.999:0;
    });
    await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await page.clock.runFor(1300);
    await expect(page.locator('#mission-title')).toHaveText('伝えろ。');
    await expect(page.locator('#controls')).toBeHidden();
    expect(await paperPixel(page,210)).toBeGreaterThan(150);
  });
});

test('paper phases block early input, preserve the 16-second knock budget and stay solvable at every speed',async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const modulePath='/src/games.ts';
    const {createRound}=await import(/* @vite-ignore */ modulePath);
    const random=Math.random;
    try{
      return [1,9,17,25,57,65].map(stage=>{
        Math.random=()=>.999;
        const speed=Math.min(2.4,1+Math.floor((stage-1)/8)*.2);
        const verdict:{ok:boolean;message:string}[]=[],sounds:string[]=[];
        const game=createRound('knock',{finish:(ok:boolean,message:string)=>verdict.push({ok,message}),sound:(kind:string)=>sounds.push(kind)},stage);
        const advance=(duration:number)=>{for(let left=duration;left>1e-8;left-=.005)game.tick(Math.min(left,.005));};
        const budget=Number((game.duration-4/speed).toFixed(6));
        game.action('primary');game.pointer(360,450);
        advance(3.5/speed);game.action('primary');game.pointer(360,450);
        const earlyBlocked=game.controls().length===0&&sounds.length===0&&verdict.length===0;
        advance(.51/speed);
        const canvas=document.createElement('canvas');canvas.width=720;canvas.height=640;
        const c=canvas.getContext('2d')!,drawn:string[]=[];
        let imageCalls=0;
        const drawImage=c.drawImage.bind(c),fillText=c.fillText.bind(c);
        c.drawImage=((...args:Parameters<typeof c.drawImage>)=>{imageCalls++;(drawImage as Function)(...args);}) as typeof c.drawImage;
        c.fillText=(value,x,y)=>{drawn.push(value);fillText(value,x,y);};
        game.draw(c);
        const hidden=imageCalls===0&&!drawn.some(value=>/[0-9０-９]/.test(value));
        const digit=Math.min(6,2+Math.floor((stage-1)/8))+3;
        for(let turn=0;turn<3;turn++){
          for(let tap=0;tap<digit;tap++)game.action('primary');
          if(turn<2){
            advance(.6/speed);
            for(let step=0;step<2000&&game.controls()[0]?.label!=='ノック'&&!verdict.length;step++)game.tick(.005);
          }
        }
        advance(.6/speed);
        return{stage,earlyBlocked,hidden,budget,expectedBudget:Number((16/speed).toFixed(6)),digit,success:verdict[0]?.ok===true,verdict};
      });
    }finally{Math.random=random;}
  });
  for(const result of results){
    expect(result.earlyBlocked).toBe(true);expect(result.hidden).toBe(true);
    expect(result.budget).toBe(result.expectedBudget);
    expect(result.digit).toBeLessThanOrEqual(9);expect(result.success,JSON.stringify(result)).toBe(true);
  }
});
