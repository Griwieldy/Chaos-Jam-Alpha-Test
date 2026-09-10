(function(root){
  'use strict';
  const TAU=Math.PI*2, clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), wrap=(n,m)=>(n%m+m)%m;
  const BASE=Object.freeze({maxSpeed:27,acceleration:12,braking:24,steering:9.4,grip:7.5,collisionResistance:1});
  const ITEMS={
    bone:{name:'Косточка',icon:'🦴',color:'#ffdf7c',hint:'Стабильное ускорение на 3 секунды'},
    sausage:{name:'Колбасный рывок',icon:'🍖',color:'#ff8870',hint:'Мощный рывок. Руль временно не слушается!'},
    milk:{name:'Молоко',icon:'🥛',color:'#b8f6ff',hint:'Вернёт контроль и защитит на 2 секунды'},
    fish:{name:'Рыбный турбо',icon:'🐟',color:'#7cdfff',hint:'Одинаково ускоряет котиков и пёселей'},
    yarn:{name:'Клубок',icon:'🧶',color:'#c7a0ff',hint:'Оставит препятствие позади'},
    broom:{name:'Веник',icon:'🧹',color:'#f6c96f',hint:'Сметёт соперников в конусе перед вами'},
    fly:{name:'Назойливая муха',icon:'🪰',color:'#abf29b',hint:'Отвлечёт ближайшего соперника впереди'},
    trap:{name:'Мышеловка',icon:'🪤',color:'#ffa86d',hint:'Оставит ловушку позади'},
    shampoo:{name:'Шампунь',icon:'🧴',color:'#99edff',hint:'Оставит скользкие пузыри'},
    frenzy:{name:'Мята / игрушка',icon:'⚡',color:'#e0fc6a',hint:'Безумное ускорение с защитой'},
    laser:{name:'Лазер / мячик',icon:'🔴',color:'#ff738c',hint:'Отвлечёт соперника. Оба питомца теряют одинаковое время'}
  };
  class Track{
    constructor(){
      this.points=[]; this.length=0; this.width=15.5;
      const n=900;
      for(let i=0;i<=n;i++){
        const t=i/n*TAU;
        const p={x:63*Math.sin(t)+9*Math.sin(2*t),z:52*Math.cos(t)+7*Math.cos(3*t)};
        if(i) this.length+=Math.hypot(p.x-this.points[i-1].x,p.z-this.points[i-1].z);
        p.s=this.length;this.points.push(p);
      }
    }
    at(distance,lane=0){
      const s=wrap(distance,this.length),ps=this.points;
      let lo=0,hi=ps.length-1;
      while(hi-lo>1){const m=(lo+hi)>>1;if(ps[m].s<=s)lo=m;else hi=m;}
      const a=ps[lo],b=ps[hi],f=(s-a.s)/(b.s-a.s||1),dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),tx=dx/len,tz=dz/len;
      return {x:a.x+(b.x-a.x)*f+tz*lane,z:a.z+(b.z-a.z)*f-tx*lane,tx,tz,yaw:Math.atan2(tx,tz)};
    }
    delta(a,b){let d=wrap(a-b,this.length);if(d>this.length/2)d-=this.length;return d;}
  }
  class RNG{constructor(seed=124){this.v=seed>>>0;}next(){this.v=(Math.imul(1664525,this.v)+1013904223)>>>0;return this.v/4294967296;}pick(a){return a[Math.floor(this.next()*a.length)];}}
  class Game{
    constructor(opts={}){
      this.track=opts.track||new Track();this.mode=opts.mode||'race';this.rng=new RNG(opts.seed??Math.floor(Math.random()*1e8));
      this.time=0;this.countdown=3.4;this.state='countdown';this.laps=this.mode==='chaos'?2:3;this.nextElimination=28;this.events=[];this.traps=[];
      const species=opts.species||'dog',rider=opts.rider||'flea';
      const names=['Вы','Бублик','Пиксель','Кекс','Плюша','Батон'];
      this.racers=Array.from({length:this.mode==='time'?1:6},(_,i)=>({
        id:i,name:names[i],species:i?i%2?'cat':'dog':species,rider:i?i%2?'tick':'flea':rider,
        s:-Math.floor(i/2)*3.5,lane:(i%2?1:-1)*2.4,speed:0,lateral:0,steer:0,
        y:0,vy:0,boost:0,boostPower:1,stun:0,slip:0,lock:0,distracted:0,shield:0,invuln:0,
        jumpCooldown:0,abilityCooldown:0,item:null,finished:false,eliminated:false,finishTime:null,
        aiLane:((i%3)-1)*3.8,aiThink:0,aiUse:2+this.rng.next()*3,disturb:0,drift:0,drifting:false,zone:null,
        color:i?i%3:opts.color||0,anim:0,blink:this.rng.next()*3
      }));
      const L=this.track.length;
      this.zones=[{s:L*.17,lane:-3.5,width:7,length:19,type:'mud'},{s:L*.42,lane:3.4,width:7,length:21,type:'water'},
        {s:L*.64,lane:0,width:5,length:15,type:'boost'},{s:L*.80,lane:-3.8,width:6.6,length:20,type:'mud'},
        {s:L*.91,lane:3.5,width:4,length:14,type:'boost'}];
      this.obstacles=[{s:L*.10,lane:3,type:'slipper',radius:1.6},{s:L*.27,lane:-3,type:'box',radius:1.55},
        {s:L*.35,lane:1,type:'ball',radius:1.2},{s:L*.55,lane:3.5,type:'box',radius:1.5},
        {s:L*.73,lane:-1.6,type:'slipper',radius:1.55},{s:L*.875,lane:-2.3,type:'ball',radius:1.25}];
      this.hazards=[{s:L*.32,lane:0,type:'pigeon',radius:1.3},{s:L*.76,lane:4,type:'vacuum',radius:2.4}];
      this.pickups=[];
      const pool=['bone','bone','sausage','milk','fish','yarn','broom','trap','shampoo','fly','laser','frenzy'];
      const count=this.mode==='chaos'?40:25;
      for(let i=0;i<count;i++) this.pickups.push({s:(i+.8)/count*L,lane:this.rng.pick([-4.3,0,4.3]),type:this.rng.pick(pool),respawn:0,phase:this.rng.next()*TAU});
      // Three tempting bonuses sit inside a hazard or behind an obstacle.
      this.pickups.push({s:L*.17,lane:-3.5,type:'frenzy',respawn:0,phase:0},{s:L*.42,lane:3.4,type:'sausage',respawn:0,phase:1},{s:L*.552,lane:3.5,type:'bone',respawn:0,phase:2});
    }
    emit(type,racer,data={}){this.events.push({type,id:typeof racer==='number'?racer:racer.id,...data});}
    takeEvents(){return this.events.splice(0);}
    ranking(){return [...this.racers].sort((a,b)=>Number(a.eliminated)-Number(b.eliminated)||Number(b.finished)-Number(a.finished)||(a.finished?a.finishTime-b.finishTime:b.s-a.s));}
    get player(){return this.racers[0];}
    boost(r,power,seconds){r.boostPower=Math.max(r.boost>0?r.boostPower:1,power);r.boost=Math.max(r.boost,seconds);this.emit('boost',r);}
    hit(r,type='bump',power=1){
      if(r.finished||r.eliminated||r.invuln>0)return false;
      if(r.shield>0){r.invuln=.45;this.emit('shield',r);return false;}
      r.speed*=Math.max(.2,1-.58*power);r.stun=Math.max(r.stun,1.2*power);r.invuln=1.7;r.disturb=(this.rng.next()>.5?1:-1)*power;r.drift=0;
      if(type==='panic'){r.s-=3.5;r.vy=8;}
      this.emit(type,r);return true;
    }
    jump(r,big=false){
      if(r.y>.06||r.jumpCooldown>0||r.stun>.5)return false;
      r.vy=big?13.5:9.5;r.jumpCooldown=big?1.6:.7;this.emit('jump',r,{big});return true;
    }
    ability(r){
      if(r.abilityCooldown>0||r.finished||r.eliminated)return false;
      if(r.rider==='flea'){
        if(!this.jump(r,true))return false;
        r.shield=Math.max(r.shield,.9);
      }else{
        r.shield=3;
        const target=this.target(r,13);
        if(target){target.distracted=2.2;this.emit('attach',target);}
        this.emit('shield',r);
      }
      r.abilityCooldown=10;return true;
    }
    target(r,range=27){return this.racers.filter(x=>x!==r&&!x.finished&&!x.eliminated&&this.track.delta(x.s,r.s)>-1&&this.track.delta(x.s,r.s)<range).sort((a,b)=>this.track.delta(a.s,r.s)-this.track.delta(b.s,r.s))[0];}
    useItem(r){
      if(!r.item||r.finished||r.eliminated)return false;
      const item=r.item;r.item=null;this.emit('item',r,{item});
      if(item==='bone')this.boost(r,1.37,3);
      else if(item==='fish')this.boost(r,1.48,2.5);
      else if(item==='sausage'){this.boost(r,1.85,1.55);r.lock=1.1;}
      else if(item==='milk'){r.stun=0;r.slip=0;r.distracted=0;r.lock=0;r.speed=Math.max(r.speed,BASE.maxSpeed*.86);r.shield=2;this.emit('recover',r);}
      else if(item==='frenzy'){this.boost(r,1.9,2.5);r.shield=2.5;}
      else if(['yarn','trap','shampoo'].includes(item)){
        this.traps.push({s:wrap(r.s-3.7,this.track.length),lane:r.lane,type:item,life:24,owner:r.id,arm:.45});
      }else if(item==='broom'){
        for(const t of this.racers){const d=this.track.delta(t.s,r.s);if(t!==r&&d>-2&&d<10&&Math.abs(t.lane-r.lane)<3.3+d*.25&&t.y<1.6)this.hit(t,'broom',.9);}
      }else if(item==='fly'||item==='laser'){
        const target=this.target(r,34);
        if(target&&target.shield<=0){target.distracted=2.3;this.emit(item,target);}
      }
      return true;
    }
    ai(r,dt){
      r.aiThink-=dt;r.aiUse-=dt;
      if(r.aiThink<=0){
        r.aiThink=.35+this.rng.next()*.5;
        let best=r.aiLane,score=-1e9;
        for(const lane of [-5.2,-2.7,0,2.7,5.2]){
          let q=-Math.abs(lane-r.lane)*.5+this.rng.next()*2.2;
          for(const o of [...this.obstacles,...this.hazards,...this.traps]){const d=this.track.delta(o.s,r.s);if(d>0&&d<27&&Math.abs(lane-o.lane)<2.5)q-=10*(1-d/30);}
          for(const z of this.zones){const d=this.track.delta(z.s,r.s);if(d>-z.length/2&&d<30&&Math.abs(lane-z.lane)<z.width/2)q+=z.type==='boost'?5:-5;}
          if(!r.item)for(const p of this.pickups){const d=this.track.delta(p.s,r.s);if(p.respawn<=0&&d>0&&d<28&&Math.abs(lane-p.lane)<1.5)q+=6;}
          if(q>score){score=q;best=lane;}
        }
        r.aiLane=best;
      }
      const obstacle=this.obstacles.find(o=>{const d=this.track.delta(o.s,r.s);return d>1&&d<8&&Math.abs(o.lane-r.lane)<2.2;});
      if(obstacle&&this.rng.next()<dt*5)this.jump(r);
      if(r.item&&r.aiUse<=0){this.useItem(r);r.aiUse=1.5+this.rng.next()*2.3;}
      if(r.abilityCooldown<=0&&(r.stun>0||obstacle)&&this.rng.next()<dt*2)this.ability(r);
      return {throttle:true,brake:false,steer:clamp((r.aiLane-r.lane)*1.0,-1,1),drift:false};
    }
    step(delta,input={}){
      const dt=clamp(delta,0,.05);
      if(this.state==='done'||this.state==='paused')return;
      if(this.state==='countdown'){
        this.countdown-=dt;if(this.countdown<=0){this.state='racing';this.emit('start',0);}return;
      }
      this.time+=dt;
      for(const h of this.hazards){h.lane=h.type==='pigeon'?Math.sin(this.time*.75)*6.5:4.5+Math.sin(this.time*.85)*2;h.active=h.type==='pigeon'||Math.sin(this.time*.85)>-.25;}
      for(const p of this.pickups)p.respawn=Math.max(0,p.respawn-dt);
      for(const t of this.traps){t.life-=dt;t.arm-=dt;}this.traps=this.traps.filter(t=>t.life>0);
      for(const r of this.racers){
        if(r.finished||r.eliminated){r.speed=Math.max(0,r.speed-15*dt);continue;}
        const c=r.id===0?input:this.ai(r,dt);
        for(const k of ['boost','stun','slip','lock','shield','invuln','distracted','jumpCooldown','abilityCooldown'])r[k]=Math.max(0,r[k]-dt);
        if(c.jump)this.jump(r);if(c.ability)this.ability(r);if(c.use)this.useItem(r);
        let steer=clamp(c.steer||0,-1,1);
        if(r.lock>0)steer=0;
        if(r.stun>0)steer=steer*.3+r.disturb*.5;
        if(r.distracted>0)steer=Math.sin(this.time*8+r.id)*1.1;
        const grip=r.slip>0?1.4:BASE.grip;
        const wanted=steer*BASE.steering*(r.speed>2?1:.3)*(c.drift?1.2:1);
        r.lateral+=(wanted-r.lateral)*Math.min(1,grip*dt);r.steer+=(steer-r.steer)*Math.min(1,dt*9);
        r.lane+=r.lateral*dt;
        if(Math.abs(r.lane)>this.track.width/2+1.6){r.lane=clamp(r.lane,-this.track.width/2-1.6,this.track.width/2+1.6);r.lateral*=-.5;this.hit(r,'bump',.7);}
        r.zone=null;
        for(const z of this.zones)if(Math.abs(this.track.delta(r.s,z.s))<z.length/2&&Math.abs(r.lane-z.lane)<z.width/2&&r.y<.7){r.zone=z.type;if(z.type==='boost'&&r.boost<.5)this.boost(r,1.32,.65);}
        let max=BASE.maxSpeed*(r.boost>0?r.boostPower:1);
        if(r.zone==='mud')max*=.49;
        if(r.zone==='water'){max*=.68;r.slip=Math.max(r.slip,.65);}
        if(Math.abs(r.lane)>this.track.width/2)max*=.60;
        if(r.stun>0)max*=.40;
        if(r.distracted>0)max*=.63;
        r.drifting=!!c.drift&&r.speed>10&&Math.abs(steer)>.12&&r.y<.1;
        if(r.drifting){r.drift=Math.min(2,r.drift+dt);max*=.92;}
        else if(r.drift>0){if(r.drift>1.05&&r.stun<=0)this.boost(r,1.3,.9+r.drift*.28);r.drift=0;}
        if(c.brake)r.speed=Math.max(0,r.speed-BASE.braking*dt);
        else if(c.throttle||r.boost>0){r.speed=r.speed<max?Math.min(max,r.speed+BASE.acceleration*(r.boost>0?2.7:1)*dt):Math.max(max,r.speed-25*dt);}
        else r.speed=Math.max(0,r.speed-7*dt);
        const prevY=r.y;
        r.vy-=24*dt;r.y=Math.max(0,r.y+r.vy*dt);
        if(r.y===0){
          if(prevY>.06){
            this.emit('land',r);
            if(r.rider==='flea'&&r.abilityCooldown>8.3)for(const opponent of this.racers)if(opponent!==r&&Math.abs(this.track.delta(opponent.s,r.s))<2.7&&Math.abs(opponent.lane-r.lane)<2&&opponent.y<1)this.hit(opponent,'bump',.45);
          }
          r.vy=0;
        }
        const oldLap=Math.max(0,Math.floor(r.s/this.track.length));
        r.s+=r.speed*dt;r.anim+=dt*(4+r.speed*.48);
        const newLap=Math.max(0,Math.floor(r.s/this.track.length));
        if(newLap>oldLap)this.emit('lap',r,{lap:newLap+1});
        for(const p of this.pickups)if(!r.item&&p.respawn<=0&&Math.abs(this.track.delta(r.s,p.s))<1.65&&Math.abs(r.lane-p.lane)<1.8&&r.y<3.5){r.item=p.type;p.respawn=this.mode==='chaos'?3.5:7;this.emit('pickup',r,{item:p.type});break;}
        for(const o of [...this.obstacles,...this.hazards]){
          if(o.active===false)continue;
          if(Math.abs(this.track.delta(r.s,o.s))<o.radius+1&&Math.abs(r.lane-o.lane)<o.radius+1&&r.y<(o.type==='vacuum'?2.5:1.1))this.hit(r,o.type==='vacuum'?'panic':o.type==='box'?'box':'bump',o.type==='vacuum'?1.15:1);
        }
        for(const t of this.traps)if(t.arm<=0&&t.owner!==r.id&&Math.abs(this.track.delta(r.s,t.s))<2&&Math.abs(r.lane-t.lane)<2&&r.y<.8){
          if(r.shield<=0){if(t.type==='shampoo'){r.slip=3;r.disturb=1;this.emit('slip',r);}else this.hit(r,t.type==='trap'?'trap':'bump',t.type==='trap'?1.3:.8);}t.life=0;
        }
        if(this.mode!=='survival'&&r.s>=this.laps*this.track.length){r.finished=true;r.finishTime=this.time;this.emit('finish',r);if(r.id===0){this.state='done';this.result={place:this.ranking().findIndex(x=>x.id===0)+1,time:this.time,won:this.ranking()[0].id===0};}}
      }
      for(let i=0;i<this.racers.length;i++)for(let j=i+1;j<this.racers.length;j++){
        const a=this.racers[i],b=this.racers[j];
        if(a.finished||b.finished||a.eliminated||b.eliminated)continue;
        if(Math.abs(this.track.delta(a.s,b.s))<2.3&&Math.abs(a.lane-b.lane)<1.45&&Math.abs(a.y-b.y)<1){
          const side=a.lane>=b.lane?1:-1;a.lane+=side*dt*3;b.lane-=side*dt*3;
          if(Math.abs(a.speed-b.speed)>8){this.hit(a,'bump',.45);this.hit(b,'bump',.45);}
        }
      }
      if(this.mode==='survival'&&this.time>=this.nextElimination){
        const active=this.ranking().filter(r=>!r.eliminated),last=active[active.length-1];
        if(last){last.eliminated=true;this.emit('eliminated',last);}
        this.nextElimination+=20;
        if(last?.id===0||active.length<=2){const winner=active.find(r=>!r.eliminated);this.state='done';this.result={place:last?.id===0?active.length:1,time:this.time,won:winner?.id===0};}
      }
    }
    pause(){if(this.state==='racing'||this.state==='countdown'){this.previousState=this.state;this.state='paused';}else if(this.state==='paused')this.state=this.previousState;}
    snapshot(){return {state:this.state,mode:this.mode,time:+this.time.toFixed(2),lap:Math.min(this.laps,Math.max(1,Math.floor(this.player.s/this.track.length)+1)),speed:+this.player.speed.toFixed(2),item:this.player.item,place:this.ranking().findIndex(r=>r.id===0)+1,racers:this.racers.map(r=>({id:r.id,name:r.name,species:r.species,progress:+r.s.toFixed(1),eliminated:r.eliminated,finished:r.finished}))};}
  }
  const api={Game,Track,BASE,ITEMS,clamp,wrap,RNG};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PetPhysics=api;
})(typeof window!=='undefined'?window:globalThis);
