import type {Audio} from './audio';

const MUSIC_VOLUME=.08;

export class TitleMusic {
  private requested=false;
  private active=true;
  private enabled=true;
  private blocked=false;
  private starting=false;
  private generation=0;
  private gain?:GainNode;

  constructor(private panel:HTMLElement,private track:HTMLAudioElement,private button:HTMLButtonElement,
    private status:HTMLElement,private sound:Audio){
    this.track.addEventListener('playing',()=>{
      if(!this.canPlay()){this.track.pause();return;}
      this.blocked=false;this.status.textContent='BGMを小さく再生中';this.render();
    });
    this.track.addEventListener('volumechange',()=>this.keepVolume());
    this.track.addEventListener('error',()=>this.fail());
  }

  toggle(){
    this.requested=this.blocked||!this.requested;this.blocked=false;
    this.panel.hidden=!this.requested;
    if(this.requested&&this.track.error)this.track.load();
    this.sync();
    return this.requested;
  }
  setContext(active:boolean,enabled:boolean){this.active=active;this.enabled=enabled;this.sync();}
  private canPlay(){return this.requested&&this.active&&this.enabled;}
  private render(){
    const action=this.requested&&!this.blocked?'BGMを停止':'BGMを再生';
    this.button.setAttribute('aria-label',action);this.button.title=action;
    this.button.setAttribute('aria-pressed',String(this.requested));
  }
  private keepVolume(){
    // A Web Audio gain also controls volume on mobile Safari, which ignores media.volume.
    const volume=this.gain?1:MUSIC_VOLUME;
    if(this.gain)this.gain.gain.value=MUSIC_VOLUME;
    if(this.track.volume!==volume)this.track.volume=volume;
  }
  private sync(){
    this.render();
    if(!this.canPlay()){
      this.generation++;this.starting=false;this.track.pause();
      this.status.textContent=this.requested?'BGMは一時停止中です。':'BGMを停止しました。';
      return;
    }
    this.sound.unlock();
    this.gain??=this.sound.connectMusic(this.track);
    this.keepVolume();
    if(this.starting||!this.track.paused)return;
    const generation=++this.generation;
    this.starting=true;this.status.textContent='BGMを読み込んでいます…';
    void this.track.play().then(()=>{
      if(generation!==this.generation)return;
      this.starting=false;
      if(!this.canPlay()){this.track.pause();return;}
      this.blocked=false;this.status.textContent='BGMを小さく再生中';this.render();
    }).catch(error=>{
      if(generation!==this.generation)return;
      this.starting=false;
      if(!this.canPlay())return;
      if(error?.name==='NotAllowedError'||error?.name==='AbortError'){
        this.blocked=true;this.status.textContent='BGMの再生ボタンをもう一度タップしてください。';this.render();
      }else this.fail();
    });
  }
  private fail(){
    this.generation++;this.starting=false;this.requested=false;this.blocked=false;
    this.track.pause();this.status.textContent='BGMを再生できませんでした。♪をタップして再試行できます。';this.render();
  }
}
