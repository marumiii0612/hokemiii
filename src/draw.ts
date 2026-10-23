export const W = 720;
export const H = 640;
export const C = {
  bg: '#151d1c', paper: '#eeeadd', muted: '#82918a', red: '#f05b47',
  gold: '#d4b980', green: '#b2c9a0', ink: '#0b1111', line: '#33403a', blue: '#7facb6',
};
export const rand = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(a: T[]): T => a[rand(a.length)];
export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 0) {
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
export function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 18, color = C.paper, align: CanvasTextAlign = 'center', weight = 400) {
  c.font = `${weight} ${size}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
  c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y);
}
export function line(c: CanvasRenderingContext2D, points: number[][], color: string, width = 1) {
  c.beginPath(); points.forEach(([x,y],i)=>i ? c.lineTo(x,y) : c.moveTo(x,y));
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
export function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, stroke = false, width = 1) {
  c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fillStyle=color; c.strokeStyle=color; c.lineWidth=width; stroke?c.stroke():c.fill();
}
export function grid(c: CanvasRenderingContext2D, step = 40, color = '#23302b') {
  for (let x=0;x<W;x+=step) line(c,[[x,0],[x,H]],color);
  for (let y=0;y<H;y+=step) line(c,[[0,y],[W,y]],color);
}
export function label(c: CanvasRenderingContext2D, s: string, x: number, y: number, color = C.muted) {
  text(c,s,x,y,12,color,'left',500);
}
export function cross(c: CanvasRenderingContext2D, x: number, y: number, r = 15, color = C.paper) {
  circle(c,x,y,r,color,true,1.4);
  line(c,[[x-r-7,y],[x-5,y]],color,1.4); line(c,[[x+5,y],[x+r+7,y]],color,1.4);
  line(c,[[x,y-r-7],[x,y-5]],color,1.4); line(c,[[x,y+5],[x,y+r+7]],color,1.4);
}
export function person(c: CanvasRenderingContext2D, x: number, y: number, scale = 1, suit = '#0c1012', skin = '#be9a7c', pose = 0) {
  c.save(); c.translate(x,y); c.scale(scale,scale);
  circle(c,0,-82,13,skin);
  rect(c,-15,-67,30,43,suit,6);
  c.lineCap='round';
  line(c,[[-11,-61],[-23,-38+pose],[-22,-24+pose]],suit,9);
  line(c,[[11,-61],[23,-39-pose],[22,-24-pose]],suit,9);
  line(c,[[-8,-25],[-10,-3],[-14+pose,15]],suit,11);
  line(c,[[8,-25],[10,-3],[14-pose,15]],suit,11);
  c.restore();
}
export function vignette(c: CanvasRenderingContext2D) {
  const g=c.createRadialGradient(360,300,100,360,300,480);
  g.addColorStop(0,'#00000000'); g.addColorStop(1,'#00000060'); rect(c,0,0,W,H,g as unknown as string);
}
