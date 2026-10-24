type Player={setVolume:(volume:number)=>void;playVideo:()=>void;pauseVideo:()=>void;destroy:()=>void;getIframe:()=>HTMLIFrameElement};
type PlayerEvent={target:Player;data?:number};
type PlayerOptions={
  videoId:string;width:string;height:number;host:string;playerVars:Record<string,string|number>;
  events:{onReady:(event:PlayerEvent)=>void;onStateChange:(event:PlayerEvent)=>void;onError:()=>void;onAutoplayBlocked:()=>void};
};
declare global {
  interface Window {
    YT?:{Player:new(element:HTMLElement,options:PlayerOptions)=>Player};
    onYouTubeIframeAPIReady?:()=>void;
  }
}

const VIDEO_ID='MuGFcUggtDs';
const MUSIC_VOLUME=8;

export class TitleMusic {
  private player?:Player;
  private ready=false;
  private loading=false;
  private requested=false;
  private active=true;
  private enabled=true;
  private blocked=false;
  private timer?:number;
  private script?:HTMLScriptElement;
  private generation=0;
  constructor(private panel:HTMLElement,private host:HTMLElement,private button:HTMLButtonElement,private status:HTMLElement){}

  toggle(){
    this.requested=this.blocked||!this.requested;this.blocked=false;
    if(this.requested){
      this.panel.hidden=false;
      if(!this.ready&&!this.loading)this.load();
    }
    this.sync();
    if(!this.requested){this.panel.hidden=true;this.render();}
    return this.requested;
  }
  setContext(active:boolean,enabled:boolean){this.active=active;this.enabled=enabled;this.sync();}
  private render(){
    this.button.textContent=this.requested&&!this.blocked?'BGMを停止':'BGMを再生';
    this.button.setAttribute('aria-pressed',String(this.requested));
    this.button.setAttribute('aria-expanded',String(!this.panel.hidden));
  }
  private sync(){
    this.render();
    if(!this.ready||!this.player)return;
    this.player.setVolume(MUSIC_VOLUME);
    if(this.requested&&this.active&&this.enabled)this.player.playVideo();
    else{
      this.player.pauseVideo();
      this.status.textContent=this.requested?'BGMは一時停止中です。':'BGMを停止しました。';
    }
  }
  private load(){
    const generation=++this.generation;
    this.loading=true;this.status.textContent='BGMを読み込んでいます…';
    this.timer=window.setTimeout(()=>{if(generation===this.generation)this.fail();},15000);
    if(window.YT?.Player){this.createPlayer();return;}
    window.onYouTubeIframeAPIReady=()=>this.createPlayer();
    this.script?.remove();
    this.script=document.createElement('script');this.script.src='https://www.youtube.com/iframe_api';
    this.script.onerror=()=>{if(generation===this.generation)this.fail();};document.head.append(this.script);
  }
  private createPlayer(){
    if(!this.loading||this.player||!window.YT?.Player)return;
    const mount=document.createElement('div');this.host.replaceChildren(mount);
    const generation=this.generation;
    try{
      this.player=new window.YT.Player(mount,{
        videoId:VIDEO_ID,width:'100%',height:203,host:'https://www.youtube-nocookie.com',
        playerVars:{autoplay:0,controls:1,playsinline:1,loop:1,playlist:VIDEO_ID,rel:0,fs:0,disablekb:1,
          ...(/^https?:$/.test(location.protocol)?{origin:location.origin}:{})},
        events:{
          onReady:({target})=>{
            if(generation!==this.generation)return;
            this.player=target;this.ready=true;this.loading=false;window.clearTimeout(this.timer);
            const frame=target.getIframe();frame.title='タイトルBGM — YouTube';
            frame.allow='autoplay; encrypted-media; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';
            this.status.textContent='小さめの音量で再生します。';this.sync();
          },
          onStateChange:({data})=>{
            if(generation!==this.generation)return;
            if(data===2&&this.active&&this.enabled&&this.requested){
              this.blocked=true;this.status.textContent='BGMは一時停止中です。';this.render();return;
            }
            if(data!==1)return;
            if(!this.active||!this.enabled||!this.requested){this.player?.pauseVideo();return;}
            this.blocked=false;this.status.textContent='タイトル画面で小さく再生中';this.render();
          },
          onAutoplayBlocked:()=>{
            if(generation!==this.generation)return;
            this.blocked=true;this.status.textContent='BGMの再生ボタンをもう一度タップしてください。';this.render();
          },
          onError:()=>{if(generation===this.generation)this.fail();},
        },
      });
    }catch{this.fail();}
  }
  private fail(){
    this.generation++;
    window.clearTimeout(this.timer);this.loading=false;this.ready=false;this.requested=false;this.blocked=false;
    try{this.player?.destroy();}catch{/* The game remains usable if YouTube is unavailable. */}
    this.player=undefined;this.host.replaceChildren();
    this.status.textContent='BGMを再生できませんでした。下のリンクからYouTubeで開けます。';this.render();
  }
}
