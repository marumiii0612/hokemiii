import type {Audio} from './audio';
import type {FileMusic} from './music-files';

export class FileMusicPlayer {
  private current?:HTMLAudioElement;
  private enabled=true;
  private visible=true;
  private generation=0;
  private gains=new WeakMap<HTMLAudioElement,GainNode>();
  constructor(private tracks:Record<FileMusic,HTMLAudioElement>,private sound:Audio){
    Object.values(tracks).forEach(track=>{
      track.addEventListener('playing',()=>{if(track!==this.current||!this.enabled||!this.visible)track.pause();});
      track.addEventListener('volumechange',()=>this.volume(track));
    });
  }
  play(name:FileMusic){
    this.stop();this.current=this.tracks[name];this.current.currentTime=0;this.sync();
  }
  stop(){this.generation++;this.current?.pause();this.current=undefined;}
  setContext(enabled:boolean,visible:boolean){this.enabled=enabled;this.visible=visible;this.sync();}
  private volume(track:HTMLAudioElement){
    const gain=this.gains.get(track);
    if(gain)gain.gain.value=.2;
    const volume=gain?1:.2;
    if(track.volume!==volume)track.volume=volume;
  }
  private sync(){
    const track=this.current;if(!track)return;
    if(!this.enabled||!this.visible){this.generation++;track.pause();return;}
    this.sound.unlock();
    if(!this.gains.has(track)){
      const gain=this.sound.connectMusic(track);if(gain)this.gains.set(track,gain);
    }
    this.volume(track);if(!track.paused)return;
    const generation=++this.generation;
    void track.play().then(()=>{
      if(generation!==this.generation)return;
      if(track!==this.current||!this.enabled||!this.visible)track.pause();
    }).catch(()=>{/* A missing optional track must not block the result or retry. */});
  }
}
