import {test,expect} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {watchAudioActivity,audioActivity,tapCanvas} from './helpers';

test('play, failure, retry and menus never initialize or play audio, even with a saved sound-on preference',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await watchAudioActivity(page);
  await page.addInitScript(()=>{Math.random=()=>0;localStorage.setItem('sennyu-sound','on');});
  await page.goto('/');await expect(page.locator('#bgm-button,#sound-button,audio,video')).toHaveCount(0);
  await page.getByRole('button',{name:'遊び方を見る'}).click();await expect(page.locator('#help-dialog')).toBeVisible();
  await page.getByRole('button',{name:'遊び方を閉じる'}).click();
  const time=new Date('2026-10-25T15:00:00Z');await page.clock.install({time});await page.clock.pauseAt(new Date(time.getTime()+1000));
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(1300);
  await tapCanvas(page,512,135);await expect(page.locator('#result-screen h1')).toHaveText('任務失敗。');
  await page.getByRole('button',{name:'もう一度、潜入する',exact:true}).click();await page.clock.runFor(1300);
  await tapCanvas(page,330,336);await expect(page.locator('#transition-title')).toHaveText('任務完了');
  expect(await audioActivity(page)).toEqual({contexts:0,elements:0,plays:0});
  expect(requests.filter(url=>/\.(mp3|wav|ogg|m4a)(?:[?#]|$)|youtube|googlevideo/.test(url))).toEqual([]);
});

test('published and downloadable builds contain no audio files, embedded tracks or playback code',async()=>{
  const files=async(directory:string):Promise<string[]>=>{
    const entries=await readdir(directory,{withFileTypes:true});
    const nested=await Promise.all(entries.map(entry=>entry.isDirectory()?files(join(directory,entry.name)):[join(directory,entry.name)]));
    return nested.flat();
  };
  for(const directory of ['public','docs','dist']){
    expect((await files(directory)).filter(path=>/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path))).toEqual([]);
  }
  for(const path of ['docs/index.html','dist/play.html']){
    expect(await readFile(path,'utf8')).not.toMatch(/data:audio\/|<audio\b|AudioContext|createOscillator|createMediaElementSource/);
  }
});
