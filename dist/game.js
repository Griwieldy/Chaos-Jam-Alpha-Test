(function(){
  'use strict';
  const $=id=>document.getElementById(id),all=s=>[...document.querySelectorAll(s)],{Game,Track,ITEMS,BASE,clamp,wrap}=PetPhysics;
  const MODES={race:'3 круга · 6 питомцев · один очень довольный победитель',time:'3 круга · только вы и секундомер · побейте личный рекорд',chaos:'2 круга · больше предметов · бонусы возвращаются быстрее',survival:'Последний выбывает через 28 секунд, затем каждые 20 секунд'};
  const STORAGE='pet-chaos-racing-v1',selection={species:'dog',rider:'flea',mode:'race',color:0};
  let saved={races:0,best:{},sound:true};
  try{const data=JSON.parse(localStorage.getItem(STORAGE)||'null');if(data&&typeof data==='object'){saved.races=Number.isFinite(data.races)?Math.max(0,data.races):0;saved.sound=data.sound!==false;if(data.best&&typeof data.best==='object')for(const k of Object.keys(MODES))if(Number.isFinite(data.best[k])&&data.best[k]>0)saved.best[k]=data.best[k];}}catch{}
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(saved));}catch{}}
  function fmt(seconds){const ms=Math.floor(Math.max(0,seconds)*100);return `${String(Math.floor(ms/6000)).padStart(2,'0')}:${String(Math.floor(ms/100)%60).padStart(2,'0')}.${String(ms%100).padStart(2,'0')}`;}
  class Sound{
    constructor(){this.ctx=null;this.on=saved.sound;this.nextBeat=0;this.beat=0;}
    start(){
      try{if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=this.on?.22:0;this.master.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});this.nextBeat=this.ctx.currentTime;}
      catch{}
    }
    toggle(){this.on=!this.on;saved.sound=this.on;persist();if(!this.ctx&&this.on)this.start();if(this.master)this.master.gain.setTargetAtTime(this.on?.22:0,this.ctx.currentTime,.03);updateSound();}
    tone(freq,duration=.1,type='sine',volume=.3,slide=1,offset=0){
      if(!this.ctx||!this.on||this.ctx.state!=='running')return;
      const now=this.ctx.currentTime+offset,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq*slide),now+duration);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(this.master);o.start(now);o.stop(now+duration+.01);
    }
    event(type,species='dog'){
      if(type==='jump'){this.tone(280,.2,'sine',.34,2.6);}
      else if(type==='pickup'){this.tone(720,.1,'triangle',.32);this.tone(1080,.16,'triangle',.22,1,.08);}
      else if(type==='boost'){this.tone(110,.3,'sawtooth',.08,3.4);}
      else if(type==='bump'||type==='box'||type==='trap'||type==='panic'){
        this.tone(150,.12,'triangle',.45,.35);if(species==='dog'){this.tone(240,.12,'sawtooth',.10,.6,.08);this.tone(180,.1,'sawtooth',.09,.7,.22);}else{this.tone(690,.24,'triangle',.21,.48,.08);}
      }else if(type==='slip')this.tone(1000,.26,'sine',.15,.15);
      else if(type==='finish'){for(let i=0;i<4;i++)this.tone([523,659,784,1047][i],.28,'triangle',.3,1,i*.14);}
      else if(type==='lap'){this.tone(659,.13,'triangle',.28);this.tone(880,.18,'triangle',.26,1,.12);}
      else if(type==='tick')this.tone(550,.12,'square',.12);
      else if(type==='start')this.tone(1000,.35,'square',.15);
      else if(type==='shield')this.tone(900,.22,'sine',.17,.6);
    }
    music(active){
      if(!this.ctx||!this.on)return;
      const now=this.ctx.currentTime;if(!active){this.nextBeat=now+.1;return;}
      if(now>=this.nextBeat){
        const notes=[0,7,12,7,4,7,14,12,0,7,12,16,14,12,7,4],root=[130.81,130.81,174.61,196][Math.floor(this.beat/16)%4];
        this.tone(root*Math.pow(2,notes[this.beat%16]/12),.1,'triangle',.075,1);
        if(this.beat%4===0)this.tone(root/2,.18,'sine',.23);
        if(this.beat%4===2)this.tone(90,.06,'triangle',.19,.4);
        this.nextBeat=now+.2027;this.beat++;
      }
    }
  }
  const sound=new Sound(),track=new Track();let game=new Game({track,seed:19}),renderer,world;
  let inMenu=true,showingResult=false,helpPausedBefore=false,helpHadRace=false,returnFocus=null;
  let clock=0,lastTime=0,accumulator=0,toastUntil=0,lastCount='',finishHandled=false,hudTime=0;
  const held=new Set(),touch={left:false,right:false,throttle:false,brake:false,drift:false},actions={jump:false,use:false,ability:false};
  let camera=[7,6,84],look=[-3.2,1.5,73],fov=48;
  try{renderer=new PetGFX.Renderer($('game'));world=new PetWorld(renderer,track);}catch(e){$('error-message').textContent=e.message;$('error').classList.remove('hidden');$('menu').classList.add('hidden');return;}
  $('game').addEventListener('webglcontextlost',e=>{e.preventDefault();pauseForBlur();$('error-message').textContent='Браузер прервал работу графики. Перезагрузите игру, чтобы восстановить изображение.';$('error').classList.remove('hidden');});
  function clearInput(){held.clear();for(const k of Object.keys(touch))touch[k]=false;for(const k of Object.keys(actions))actions[k]=false;all('.held').forEach(e=>e.classList.remove('held'));}
  function updateSound(){$('sound').classList.toggle('muted',!sound.on);$('sound').setAttribute('aria-label',sound.on?'Выключить звук':'Включить звук');$('sound').title=sound.on?'Выключить звук (M)':'Включить звук (M)';}
  function updateSelection(){
    all('[data-pet]').forEach(b=>{const active=b.dataset.pet===selection.species;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
    all('[data-rider]').forEach(b=>{const active=b.dataset.rider===selection.rider;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
    all('[data-mode]').forEach(b=>{const active=b.dataset.mode===selection.mode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
    all('[data-color]').forEach(b=>{const n=Number(b.dataset.color),locked=saved.races<(n===1?1:n===2?3:0);b.classList.toggle('locked',locked);b.classList.toggle('selected',n===selection.color);b.setAttribute('aria-pressed',n===selection.color);const labels=['Песочный окрас','Серый окрас','Шоколадный окрас'];b.title=locked?`Завершите ${n===1?1:3} гонки для этого окраса`:labels[n];b.setAttribute('aria-label',b.title);b.textContent=locked?'·':'';});
    $('mode-description').textContent=MODES[selection.mode];$('hero-title').textContent=`${selection.species==='dog'?'ПЁСЕЛЬ':'КОТИК'} + ${selection.rider==='flea'?'БЛОХА':'КЛЕЩ'}`;
    $('record').textContent=saved.best[selection.mode]?`Личный рекорд · ${fmt(saved.best[selection.mode])}`:'Ваш первый кубок уже ждёт';$('race-count').textContent=`🏁 Заездов: ${saved.races}`;
  }
  function toast(text,duration=2){$('toast').textContent=text;$('toast').classList.remove('hidden');toastUntil=clock+duration;}
  function hideDialogs(){$('overlay').classList.add('hidden');all('.dialog').forEach(el=>el.classList.add('hidden'));}
  function showDialog(id){
    returnFocus=document.activeElement;$('overlay').classList.remove('hidden');all('.dialog').forEach(el=>el.classList.toggle('hidden',el.id!==id));
    const first=$(id).querySelector('button:not([disabled])');if(first)first.focus();
  }
  function startRace(){
    sound.start();clearInput();hideDialogs();inMenu=false;showingResult=false;finishHandled=false;
    game=new Game({...selection,track});world.particles=[];accumulator=0;lastCount='';
    $('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('vignette').classList.add('racing');$('pause-button').classList.remove('hidden');$('brand').style.opacity='.75';$('yard-pill').classList.add('hidden');$('toast').classList.add('hidden');
    $('ability-name').textContent=selection.rider==='flea'?'МЕГАПРЫЖОК':'КРЕПКАЯ ХВАТКА';$('ability-icon').textContent=selection.rider==='flea'?'↟':'◈';
    $('racers-total').textContent=`/ ${game.racers.length}`;$('position-label').textContent=game.mode==='time'?'ЛИЧНЫЙ ЗАЕЗД':'ПОЗИЦИЯ';$('race-tip').classList.remove('hidden');
    const p=track.at(game.player.s,game.player.lane),back=track.at(game.player.s-10,game.player.lane*.65),ahead=track.at(game.player.s+8,game.player.lane*.65);camera=[back.x,5.9,back.z];look=[ahead.x,1.2,ahead.z];fov=61;updateHud();
  }
  function goMenu(){
    clearInput();inMenu=true;showingResult=false;hideDialogs();$('menu').classList.remove('hidden');$('hud').classList.add('hidden');$('countdown').classList.add('hidden');$('toast').classList.add('hidden');$('pause-button').classList.add('hidden');$('vignette').classList.remove('racing');$('brand').style.opacity='1';$('yard-pill').classList.remove('hidden');world.particles=[];game=new Game({track,seed:19,...selection});updateSelection();$('start').focus();
  }
  function togglePause(){
    if(inMenu||game.state==='done')return;
    if(!$('help-dialog').classList.contains('hidden')){closeHelp();return;}
    game.pause();clearInput();if(game.state==='paused'){showDialog('pause-dialog');$('countdown').classList.add('hidden');}else{hideDialogs();accumulator=0;}
  }
  function pauseForBlur(){clearInput();if(!inMenu&&(game.state==='racing'||game.state==='countdown'))togglePause();}
  function openHelp(){
    if(!$('help-dialog').classList.contains('hidden'))return;
    helpPausedBefore=game.state==='paused';helpHadRace=!inMenu&&(game.state==='racing'||game.state==='countdown');
    if(helpHadRace){game.pause();$('countdown').classList.add('hidden');}clearInput();showDialog('help-dialog');
  }
  function closeHelp(){
    if(helpPausedBefore)showDialog('pause-dialog');else if(showingResult)showDialog('result-dialog');else{hideDialogs();if(helpHadRace&&game.state==='paused'){game.pause();accumulator=0;}if(returnFocus instanceof HTMLElement)returnFocus.focus();}
  }
  function finishRace(){
    if(finishHandled)return;finishHandled=true;showingResult=true;clearInput();$('countdown').classList.add('hidden');$('toast').classList.add('hidden');
    const result=game.result,isTime=game.mode==='time',oldBest=saved.best[game.mode],completed=game.mode!=='survival'||result.won;
    if(completed){saved.races++;if(game.mode!=='survival'&&(!oldBest||result.time<oldBest))saved.best[game.mode]=result.time;persist();}
    $('result-symbol').textContent=result.won?'🏆':result.place<=3?'🥉':'🐾';
    $('result-title').textContent=isTime?'Время в копилку!':result.won?'Вот это лапы!':result.place<=3?'Лапы на пьедестале!':'Ещё один круг славы.';
    $('result-description').textContent=isTime?(!oldBest||result.time<oldBest?'Новый личный рекорд. Поздравляем!':'Теперь есть время, которое стоит обогнать.'):game.mode==='survival'?(result.won?'Последний питомец на трассе — ваш!':'Вы выбыли. Следующая попытка уже ждёт.'):`${result.place===1?'Первым до финиша добрался ваш экипаж.':'Ваш экипаж добрался до финиша.'} Бонусы решают!`;
    $('result-place').textContent=isTime?'СОЛО':`${result.place} / ${game.racers.length}`;$('result-time').textContent=fmt(result.time);
    $('results-list').replaceChildren();
    game.ranking().forEach((r,i)=>{const row=document.createElement('div');row.className=`result-row${r.id===0?' player':''}`;const values=[`${i+1}`,`${r.species==='dog'?'🐶':'🐱'} ${r.name}`,r.eliminated?'Выбыл':r.finished?fmt(r.finishTime):game.mode==='survival'?'На трассе':'Ещё на трассе'];for(const text of values){const span=document.createElement('span');span.textContent=text;row.append(span);}$('results-list').append(row);});
    $('unlock-message').textContent=completed&&[1,3].includes(saved.races)?`✨ Новый окрас открыт: ${saved.races===1?'серый':'шоколадный'}!`:completed&&saved.races<3?`До следующего окраса: ${3-saved.races} заезд(а)`:'Все питомцы по-прежнему одинаково быстрые.';
    sound.event('finish');showDialog('result-dialog');
  }
  function updateHud(){
    const p=game.player,ranking=game.ranking();$('position').textContent=ranking.findIndex(r=>r.id===0)+1;$('timer').textContent=fmt(game.time);
    if(game.mode==='survival'){$('lap-label').textContent='ДО ВЫБЫВАНИЯ';$('lap').textContent=`${Math.ceil(Math.max(0,game.nextElimination-game.time))} С`;$('racers-total').textContent=`/ ${game.racers.filter(r=>!r.eliminated).length}`;}
    else{$('lap-label').textContent='КРУГ';$('lap').textContent=`${Math.min(game.laps,Math.max(1,Math.floor(p.s/track.length)+1))} / ${game.laps}`;}
    $('speed').textContent=Math.round(p.speed*3.6);$('speed-fill').style.width=`${clamp(p.speed/(BASE.maxSpeed*1.9),0,1)*100}%`;
    $('surface').textContent=p.stun>0?'ОЙ, ЛАПКИ!':p.boost>0?'ТУРБО-ЛАПЫ':p.slip>0?'СКОЛЬЗКО!':p.zone==='mud'?'ГРЯЗЕВЫЕ ЛАПЫ':p.drifting?'ЗАРЯЖАЕМ ДРИФТ':'ЛАПЫ В ДЕЛО';
    const item=ITEMS[p.item];$('item-icon').textContent=item?item.icon:'?';$('item-name').textContent=item?item.name:'Ловите бонусы';$('item-hint').textContent=item?item.hint:'Предметы парят над трассой';$('item-button').classList.toggle('has-item',!!item);$('item-button').disabled=!item||game.state!=='racing';
    $('ability-status').textContent=p.abilityCooldown>0?`${p.abilityCooldown.toFixed(1)} С`:'ГОТОВ';$('ability-button').disabled=p.abilityCooldown>0||game.state!=='racing';$('drift-fill').style.width=`${p.drift/2*100}%`;$('race-tip').classList.toggle('hidden',game.time>9);
    drawMap();
  }
  function drawMap(){
    const c=$('minimap').getContext('2d');c.clearRect(0,0,220,185);
    const convert=p=>[110+p.x*1.27,92+p.z*1.19];
    c.beginPath();for(let i=0;i<=150;i++){const [x,y]=convert(track.at(i/150*track.length));i?c.lineTo(x,y):c.moveTo(x,y);}c.lineWidth=13;c.strokeStyle='#b3d8c750';c.lineJoin='round';c.stroke();c.lineWidth=5;c.strokeStyle='#e6e9caa0';c.stroke();
    const start=convert(track.at(0));c.fillStyle='#ffde7c';c.fillRect(start[0]-6,start[1]-3,12,6);
    for(const r of [...game.racers].reverse()){
      if(r.eliminated)continue;const [x,y]=convert(track.at(r.s,r.lane*.3));c.beginPath();c.arc(x,y,r.id===0?6.5:4.4,0,Math.PI*2);c.fillStyle=r.id===0?'#ffdc78':r.species==='cat'?'#eaa18f':'#a5dce5';c.fill();c.lineWidth=2;c.strokeStyle='#174650';c.stroke();
    }
  }
  function events(){
    for(const e of game.takeEvents()){
      const racer=game.racers[e.id];if(racer&&['bump','boost','jump','pickup','panic','box','trap','land','slip','shield'].includes(e.type))world.burst(racer,e.type,e.type==='land'?6:12);
      if(e.id!==0){if(e.type==='eliminated')toast(`${racer.name} выбывает!`,2);continue;}
      sound.event(e.type,game.player.species);
      if(e.type==='pickup')toast(`${ITEMS[e.item].icon} ${ITEMS[e.item].name} · E`,1.7);
      else if(e.type==='lap'&&game.state!=='done')toast(e.lap===game.laps?'🏁 Последний круг!':`Круг ${e.lap} — погнали!`,1.6);
    }
  }
  function getInput(){return {throttle:held.has('KeyW')||held.has('ArrowUp')||touch.throttle,brake:held.has('KeyS')||held.has('ArrowDown')||touch.brake,
    steer:Number(held.has('KeyD')||held.has('ArrowRight')||touch.right)-Number(held.has('KeyA')||held.has('ArrowLeft')||touch.left),
    drift:held.has('ShiftLeft')||held.has('ShiftRight')||touch.drift,...actions};}
  function frame(timestamp){
    const dt=Math.min(.1,(timestamp-lastTime)/1000||.016);lastTime=timestamp;
    if(game.state!=='paused')clock+=dt;
    if(!inMenu&&!showingResult&&game.state!=='paused'){
      accumulator+=dt;
      while(accumulator>=1/60){game.step(1/60,getInput());for(const k of Object.keys(actions))actions[k]=false;accumulator-=1/60;}
      events();if(game.state==='done')finishRace();
      hudTime+=dt;if(hudTime>.07){updateHud();hudTime=0;}
    }
    if(!inMenu&&game.state==='countdown'){
      const value=Math.ceil(game.countdown).toString();$('countdown').classList.remove('hidden','go');$('countdown').textContent=value==='4'?'НА СТАРТ':value;
      if(value==='4')$('countdown').classList.add('go');if(value!==lastCount){sound.event('tick');lastCount=value;}
    }else if(!inMenu&&game.state==='racing'&&game.time<.65){$('countdown').classList.remove('hidden');$('countdown').classList.add('go');$('countdown').textContent='ПОГНАЛИ!';}
    else $('countdown').classList.add('hidden');
    if(clock>toastUntil)$('toast').classList.add('hidden');
    sound.music(!inMenu&&game.state==='racing');
    world.draw(game,clock,game.state==='paused'?0:dt,inMenu,selection);
    let desiredEye,desiredLook,desiredFov;
    if(inMenu){
      const narrow=innerWidth<650;
      desiredEye=narrow?[8,7.7,87]:[8,6.5,85];desiredLook=narrow?[-.8,2,72]:[-3.5,1.45,73];desiredFov=narrow?58:46;
    }else{
      const p=game.player,back=track.at(p.s-(p.boost>0?10.2:9.5),p.lane*.82),ahead=track.at(p.s+7.5,p.lane*.60);
      desiredEye=[back.x,5.1+p.y*.38,back.z];desiredLook=[ahead.x,1.15+p.y*.45,ahead.z];desiredFov=61+(p.boost>0?10:0)+p.speed/27*3;
    }
    const smoothing=1-Math.exp(-dt*(inMenu?2.3:7));camera=camera.map((v,i)=>v+(desiredEye[i]-v)*smoothing);look=look.map((v,i)=>v+(desiredLook[i]-v)*smoothing);fov+=(desiredFov-fov)*smoothing;
    renderer.render(camera,look,fov);requestAnimationFrame(frame);
  }
  all('[data-pet]').forEach(b=>b.addEventListener('click',()=>{selection.species=b.dataset.pet;updateSelection();}));
  all('[data-rider]').forEach(b=>b.addEventListener('click',()=>{selection.rider=b.dataset.rider;updateSelection();}));
  all('[data-mode]').forEach(b=>b.addEventListener('click',()=>{selection.mode=b.dataset.mode;updateSelection();}));
  all('[data-color]').forEach(b=>b.addEventListener('click',()=>{const n=Number(b.dataset.color);if(saved.races<(n===1?1:n===2?3:0)){toast(n===1?'Новый окрас — после первого финиша':'Шоколадный окрас — после трёх финишей');return;}selection.color=n;updateSelection();}));
  $('start').addEventListener('click',startRace);$('again').addEventListener('click',startRace);$('restart').addEventListener('click',startRace);
  $('resume').addEventListener('click',togglePause);$('pause-button').addEventListener('click',togglePause);$('back-menu').addEventListener('click',goMenu);$('result-menu').addEventListener('click',goMenu);
  $('brand').addEventListener('click',e=>{e.preventDefault();goMenu();});$('sound').addEventListener('click',()=>sound.toggle());$('help').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);$('help-ok').addEventListener('click',closeHelp);
  $('item-button').addEventListener('click',()=>{actions.use=true;});$('ability-button').addEventListener('click',()=>{actions.ability=true;});
  all('[data-hold]').forEach(b=>{
    const key=b.dataset.hold;
    b.addEventListener('pointerdown',e=>{e.preventDefault();touch[key]=true;b.classList.add('held');b.setPointerCapture(e.pointerId);});
    const release=()=>{touch[key]=false;b.classList.remove('held');};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  });
  all('[data-action]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();actions[b.dataset.action]=true;}));
  const gameKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE','KeyQ']);
  window.addEventListener('keydown',e=>{
    if(e.code==='Tab'&&!$('overlay').classList.contains('hidden')){
      const d=all('.dialog').find(x=>!x.classList.contains('hidden')),buttons=[...d.querySelectorAll('button:not([disabled])')],first=buttons[0],last=buttons[buttons.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;
    }
    if(e.code==='KeyM'&&!e.repeat){sound.toggle();return;}
    if(e.code==='Escape'&&!e.repeat){if(!$('help-dialog').classList.contains('hidden'))closeHelp();else togglePause();return;}
    if(e.code==='Enter'&&inMenu&&$('overlay').classList.contains('hidden')){e.preventDefault();startRace();return;}
    if(inMenu||!['countdown','racing'].includes(game.state))return;
    if(gameKeys.has(e.code)){e.preventDefault();held.add(e.code);}
    if(!e.repeat){if(e.code==='Space')actions.jump=true;if(e.code==='KeyE')actions.use=true;if(e.code==='KeyQ')actions.ability=true;}
  });
  window.addEventListener('keyup',e=>held.delete(e.code));window.addEventListener('blur',pauseForBlur);document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForBlur();});
  updateSelection();updateSound();requestAnimationFrame(frame);
  // Optional page-scoped tools use the same actions as the visible game UI.
  const context=document.modelContext;
  if(context?.registerTool){
    const lifecycle=new AbortController();
    const specs=[
      {name:'read_pet_race',description:'Read the current race state, selected team, and local records.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({menu:inMenu,selection:{...selection},race:game.snapshot(),records:{...saved.best}})},
      {name:'start_pet_race',description:'Configure a pet and rider, then start a new race. This restarts any current race.',inputSchema:{type:'object',properties:{species:{type:'string',enum:['dog','cat']},rider:{type:'string',enum:['flea','tick']},mode:{type:'string',enum:Object.keys(MODES)}},required:['species','rider','mode'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||!['dog','cat'].includes(input.species)||!['flea','tick'].includes(input.rider)||!Object.hasOwn(MODES,input.mode))throw Error('Unknown pet, rider, or race mode.');Object.assign(selection,{species:input.species,rider:input.rider,mode:input.mode});updateSelection();startRace();return game.snapshot();}},
      {name:'pause_pet_race',description:'Pause the current race. A race must already be running.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{if(inMenu||!['racing','countdown'].includes(game.state))throw Error('No running race to pause.');togglePause();return game.snapshot();}}
    ];
    for(const spec of specs)try{Promise.resolve(context.registerTool(spec,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
