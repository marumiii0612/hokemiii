type Tone = 'tap' | 'good' | 'bad' | 'warning' | 'shoot';
export class Audio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private soundEnabled=true;
  get enabled(){return this.soundEnabled;}
  set enabled(value:boolean){
    this.soundEnabled=value;
    if(this.ctx&&this.master)this.master.gain.setValueAtTime(value?1:0,this.ctx.currentTime);
  }
  unlock() {
    if (!this.enabled) return;
    try {
      if(!this.ctx){
        this.ctx=new AudioContext();this.master=this.ctx.createGain();
        const compressor=this.ctx.createDynamicsCompressor();
        compressor.threshold.value=-10;compressor.knee.value=12;compressor.ratio.value=6;
        compressor.attack.value=.003;compressor.release.value=.15;
        this.master.connect(compressor);compressor.connect(this.ctx.destination);
      }
      void this.ctx.resume().catch(()=>{});
    } catch { /* Audio is optional. */ }
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
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.24,t+.006);
      g.gain.exponentialRampToValueAtTime(.0001,t+.15);
      o.connect(g); g.connect(this.master??ac.destination); o.start(t); o.stop(t+.16);
    });
  }
}
