export type FileMusic='party'|'yes'|'poi';

const files:{name:string;music:FileMusic|null}[]=[
  {name:'pazyama.mp3',music:'party'},
  {name:'pazyama仮.mp3',music:'party'},
  {name:'pazyama最終.mp3',music:'party'},
  {name:'tokyo.mp3',music:'yes'},
  {name:'yestokyo.mp3',music:'yes'},
  {name:'karaoketeppan.mp3',music:'yes'},
  {name:'ayaman.mp3',music:'poi'},
  {name:'poipoi.mp3',music:'poi'},
  {name:'peppan.mp3',music:'poi'},
  {name:'beppan.mp3',music:null},
];
export const musicFiles=files.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
