type Tone = 'tap' | 'good' | 'bad' | 'warning' | 'shoot';
export class Audio {
  private ctx?: AudioContext;
  enabled = true;
  unlock() {
    if (!this.enabled) return;
    try { this.ctx ??= new AudioContext(); void this.ctx.resume().catch(()=>{}); } catch { /* Audio is optional. */ }
  }
  play(kind: Tone) {
    if (!this.enabled || !this.ctx) return;
    const ac=this.ctx, at=ac.currentTime;
    const notes=kind==='good'?[440,660,880]:kind==='bad'?[160,110]:kind==='shoot'?[85]:kind==='warning'?[440]:[150];
    notes.forEach((freq,i)=>{
      const o=ac.createOscillator(), g=ac.createGain(), t=at+i*.09;
      o.type=kind==='tap'?'triangle':kind==='shoot'?'sawtooth':'sine';
      o.frequency.setValueAtTime(freq,t);
      if (kind==='tap'||kind==='shoot') o.frequency.exponentialRampToValueAtTime(40,t+.09);
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.09,t+.006);
      g.gain.exponentialRampToValueAtTime(.0001,t+.15);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+.16);
    });
  }
}
