// Deterministic checks for rules that affect race fairness or progression.
// Run with Node.js: node tests/run.cjs. No packages are required.
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {Game,Track,BASE,ITEMS}=require('../dist/physics.js');
const {Renderer,M,geometry}=require('../dist/renderer.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function clean(options={}){const g=new Game({mode:'time',seed:17,...options});g.state='racing';g.obstacles=[];g.zones=[];g.hazards=[];g.pickups=[];g.player.lane=0;return g;}
function advance(g,seconds,input={throttle:true}){for(let i=0;i<Math.round(seconds*60);i++)g.step(1/60,input);}
test('same starting physics and acceleration for both pets and both riders',()=>{
  assert(Object.isFrozen(BASE));let reference;
  for(const species of ['dog','cat'])for(const rider of ['flea','tick']){
    const g=clean({species,rider});advance(g,7,{throttle:true,steer:.13});
    const state=[g.player.speed,g.player.s,g.player.lane,g.player.lateral];if(reference)assert.deepEqual(state,reference);reference=state;
  }
});
test('no input means no automatic acceleration; brakes reduce speed',()=>{const g=clean();advance(g,2,{});assert.equal(g.player.speed,0);advance(g,4);const speed=g.player.speed;advance(g,1,{brake:true});assert(g.player.speed<speed*.2);});
test('stable maximum speed independent of pet appearance',()=>{const g=clean();advance(g,12);assert.equal(g.player.speed,BASE.maxSpeed);});
test('every item has the same effect for cat and dog',()=>{
  for(const item of Object.keys(ITEMS)){
    const states=[];for(const species of ['dog','cat']){const g=clean({species});g.player.item=item;g.useItem(g.player);advance(g,.5);states.push([g.player.speed,g.player.s,g.player.boost,g.player.slip,g.player.shield]);}assert.deepEqual(states[0],states[1],item);
  }
});
test('pickups disappear and respawn only after their timer',()=>{const g=clean();g.pickups=[{s:0,lane:0,type:'bone',respawn:0}];g.step(1/60,{});assert.equal(g.player.item,'bone');assert(g.pickups[0].respawn>6);g.player.s=30;advance(g,3,{});assert(g.pickups[0].respawn>0);advance(g,5,{});assert.equal(g.pickups[0].respawn,0);});
test('jump clears obstacles, returns to ground, and is repeatable',()=>{const g=clean(),p=g.player;g.jump(p);advance(g,.3,{});assert(p.y>1);advance(g,1.2,{});assert.equal(p.y,0);assert(g.jump(p));});
test('collision cooldown prevents repeated hits at one obstacle',()=>{const g=clean(),p=g.player;p.speed=25;g.hit(p);const speed=p.speed;assert(!g.hit(p));assert.equal(speed,p.speed);});
test('milk clears control problems and restores running speed',()=>{const g=clean(),p=g.player;Object.assign(p,{stun:2,slip:3,distracted:2,lock:2,speed:3,item:'milk'});g.useItem(p);assert.equal(p.stun+p.slip+p.distracted+p.lock,0);assert(p.speed>=BASE.maxSpeed*.85);assert(p.shield>0);});
test('shield blocks impacts without providing speed',()=>{const g=clean({rider:'tick'}),p=g.player;p.speed=20;g.ability(p);assert(!g.hit(p));assert.equal(p.speed,20);assert.equal(p.boost,0);assert(p.abilityCooldown>0);});
test('flea jump is higher than a regular jump with no speed boost',()=>{const a=clean(),b=clean();a.jump(a.player);b.ability(b.player);advance(a,.3,{});advance(b,.3,{});assert(b.player.y>a.player.y);assert.equal(b.player.boost,0);});
test('mud affects both pets equally and an airborne pet avoids it',()=>{for(const species of ['dog','cat']){const g=clean({species});g.zones=[{s:0,lane:0,width:20,length:100,type:'mud'}];g.player.speed=27;advance(g,1);assert(g.player.speed<20);}const g=clean();g.player.y=2;g.player.vy=4;g.zones=[{s:0,lane:0,width:20,length:100,type:'mud'}];g.step(1/60,{throttle:true});assert.equal(g.player.zone,null);});
test('pause freezes all race timers and movement',()=>{const g=clean();advance(g,2);g.pause();const before=JSON.stringify(g.snapshot());advance(g,4);assert.equal(before,JSON.stringify(g.snapshot()));g.pause();assert.equal(g.state,'racing');});
test('finish cannot trigger before all required laps',()=>{const g=clean();g.player.s=g.track.length*2.1;g.step(1/60,{});assert.equal(g.state,'racing');g.player.s=g.laps*g.track.length-0.1;g.player.speed=27;g.step(1/60,{throttle:true});assert.equal(g.state,'done');assert.equal(g.result.place,1);});
test('AI uses legal controls and all four modes reach a result',()=>{
  for(const mode of ['race','time','chaos','survival']){
    const g=new Game({mode,seed:840});
    for(let i=0;i<60*200&&g.state!=='done';i++){
      const input=g.state==='racing'?g.ai(g.player,1/60):{};g.step(1/60,input);
      for(const r of g.racers){assert(Number.isFinite(r.s+r.lane+r.speed+r.y));assert(r.speed<=BASE.maxSpeed*1.91);assert(r.lane<=g.track.width/2+1.8&&r.lane>=-g.track.width/2-1.8);}
    }
    assert.equal(g.state,'done',mode);assert(g.result.place>=1&&g.result.place<=g.racers.length);console.log('  '+mode+': '+g.time.toFixed(2)+' s, place '+g.result.place);
  }
});
test('elimination removes exactly the last active racer at the interval',()=>{const g=clean({mode:'survival'});g.racers.forEach((r,i)=>r.s=100-i*10);g.time=27.99;g.step(1/60,{});assert.equal(g.racers.filter(r=>r.eliminated).length,1);assert(g.racers[5].eliminated);assert.equal(g.nextElimination,48);});
test('track wraps continuously and tangents are normalized',()=>{const t=new Track();for(const d of [0,20,t.length-1,-3,t.length*3+21]){const p=t.at(d);assert(Math.abs(Math.hypot(p.tx,p.tz)-1)<1e-8);assert.deepEqual(t.at(d),t.at(d+t.length));}const a=t.at(.0001),b=t.at(t.length-.0001);assert(Math.hypot(a.x-b.x,a.z-b.z)<.001);});
test('all primitives have finite vertices and matching normals',()=>{for(const name of ['box','sphere','cylinder','cone']){const g=geometry(name);assert.equal(g.positions.length,g.normals.length);assert.equal(g.positions.length%9,0);assert(g.positions.every(Number.isFinite)&&g.normals.every(Number.isFinite));}});
test('the entire scene assembles with finite instance transforms',()=>{
  const fake=Object.create(Renderer.prototype);fake.static=new Map();fake.dynamic=new Map();for(const name of ['box','sphere','cylinder','cone']){fake.static.set(name,[]);fake.dynamic.set(name,[]);}fake.addMesh=(name)=>{fake.static.set(name,[]);fake.dynamic.set(name,[]);};
  const context={window:{},PetGFX:{M},PetPhysics:require('../dist/physics.js'),Math};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/world.js'),'utf8'),context);
  const track=new Track(),world=new context.window.PetWorld(fake,track),g=new Game({track});
  world.draw(g,4,1/60,false);world.draw(g,5,1/60,true,{species:'cat',rider:'tick',color:2});
  let total=0;for(const map of [fake.static,fake.dynamic])for(const data of map.values()){assert.equal(data.length%19,0);assert(data.every(Number.isFinite));total+=data.length/19;}console.log('  '+total+' valid 3D instances');
});
console.log('\n'+passed+' checks passed. Browser rendering and WebMCP integration are not covered by these checks.');
