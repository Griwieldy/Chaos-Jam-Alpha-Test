(function(root){
  'use strict';
  const {M}=PetGFX, {RNG}=PetPhysics, PI=Math.PI;
  const C={grass:'#71b95b',road:'#edbc82',edge:'#e67b53',white:'#fff5d9',dark:'#213d47',leaf:'#399964'};
  class World{
    constructor(renderer,track){this.r=renderer;this.track=track;this.rng=new RNG(628);this.particles=[];this.clock=0;this.build();}
    shape(...args){this.r.shape(...args);}
    fixed(type,col,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,parent=null){this.r.shape(type,col,x,y,z,sx,sy,sz,rx,ry,rz,parent,true);}
    build(){
      const t=this.track,r=this.r;r.clearStatic();
      this.fixed('box',C.grass,0,-.8,0,220,.8,220);
      const pos=[],norm=[];
      for(let i=0;i<540;i++){
        const a=t.at(i/540*t.length,-t.width/2),b=t.at(i/540*t.length,t.width/2),c=t.at((i+1)/540*t.length,t.width/2),d=t.at((i+1)/540*t.length,-t.width/2);
        for(const q of [a,b,c,a,c,d]){pos.push(q.x,.035,q.z);norm.push(0,1,0);}
      }
      r.addMesh('track',{positions:pos,normals:norm});this.fixed('track',C.road,0,0,0);
      for(let i=0;i<250;i++)for(const edge of [-1,1]){
        const p=t.at(i/250*t.length,edge*(t.width/2+.35));this.fixed('box',i%2?C.white:C.edge,p.x,.14,p.z,.4,.16,t.length/250/2+.015,0,p.yaw);
      }
      for(let i=0;i<60;i++){
        const p=t.at(i/60*t.length,0);this.fixed('box','#f7d5a1',p.x,.05,p.z,.09,.012,.72,0,p.yaw);
      }
      // A toy-sized race in a giant back garden.
      for(let x=-113;x<=113;x+=5){this.fence(x,0,-99,0);this.fence(x,0,103,0);}
      for(let z=-96;z<=100;z+=5){this.fence(-115,0,z,PI/2);this.fence(115,0,z,PI/2);}
      this.fixed('box','#eec795',0,5,-99,118,.33,.5);this.fixed('box','#eec795',0,10,-99,118,.33,.5);
      for(const [x,z,s] of [[-37,-24,1.1],[26,-12,1.3],[14,20,.75],[-19,33,1],[83,44,1.5],[-86,-31,1.25],[90,-55,1.2],[-91,57,.85],[44,79,1.1],[-29,-79,1.2]])this.tree(x,z,s);
      this.doghouse(-16,-8,1.7,.3);
      this.fixed('cylinder','#3a8c80',0,.08,73,3.0,.08,3.0);
      this.fixed('cylinder','#96c479',0,.18,73,2.72,.035,2.72);
      this.bowl(27,19,6,'#df6854');this.bowl(-30,9,4.2,'#47b7c8');
      this.bench(8,-77,.18);
      this.fixed('box','#d9eee5',42,21,-96,23,21,3);
      this.fixed('box','#3b879c',42,24,-92.7,8,11,.4);
      for(const dx of [-4,4])this.fixed('box','#bedfeb',42+dx,27,-92.1,3.6,5.7,.1);
      this.fixed('box','#f7e6b7',42,34,-92.4,10,.5,.8);
      this.fixed('box','#ed8d66',42,43,-96,26,2,7);
      const rng=this.rng;
      for(let i=0;i<120;i++){
        const s=rng.next()*t.length,lane=(rng.next()>.5?1:-1)*(12+rng.next()*14),p=t.at(s,lane);
        if(i%3===0){const h=.8+rng.next()*1.1;this.fixed('cone',i%2?'#4a9b52':'#57a958',p.x,h/2,p.z,.25,h/2,.25,0,rng.next()*6,.2);}
        else{this.fixed('sphere',i%2?'#e9a8ab':'#ffe37f',p.x,.6,p.z,.36,.35,.36);this.fixed('cylinder','#529453',p.x,.27,p.z,.045,.27,.045);}
      }
      // A cheerful start gantry and a properly tiled finish line.
      const start=t.at(0),g=M.transform(start.x,0,start.z,1,1,1,0,start.yaw);
      for(const x of [-9,9]){
        this.fixed('cylinder','#14868a',x,5.2,0,.32,5.2,.32,0,0,0,g);
        this.fixed('sphere','#ffe06b',x,10.9,0,.57,.57,.57,0,0,0,g);
      }
      this.fixed('box','#173c48',0,9.1,0,9.3,1.1,.38,0,0,0,g);
      for(let j=0;j<2;j++)for(let i=0;i<18;i++)this.fixed('box',(i+j)%2?'#f9e8b5':'#234957',i-8.5,8.4+j*.7,.42,.48,.32,.08,0,0,0,g);
      for(let i=0;i<16;i++)for(let j=0;j<3;j++)this.fixed('box',(i+j)%2?'#34434b':'#fff4dc',i-7.5,.07,j*.75-1,.5,.02,.375,0,0,0,g);
      for(let i=0;i<18;i++){
        const p=t.at((.03+i/18*.93)*t.length,-10.5);const arrow=M.transform(p.x,0,p.z,1,1,1,0,p.yaw);
        if(i%3===1){this.fixed('cylinder','#eee2b5',0,1.3,0,.12,1.3,.12,0,0,0,arrow);this.fixed('box','#1a8790',0,2.9,0,1.7,.72,.14,0,0,0,arrow);this.fixed('box','#fff2c7',.25,2.9,.16,.72,.12,.04,0,0,.65,arrow);this.fixed('box','#fff2c7',.25,2.56,.16,.72,.12,.04,0,0,-.65,arrow);}
      }
      for(const [x,z,col] of [[-39,71,'#e9755f'],[70,-67,'#a58add'],[76,23,'#69cbd4']]){
        this.fixed('sphere',col,x,6,z,2.6,3,2.6);this.fixed('cylinder','#f1e2b3',x,2.8,z,.045,2.8,.045);
      }
      // Clouds are geometry, so there are no external textures or assets.
      for(let i=0;i<17;i++){
        const a=i/17*PI*2,x=Math.sin(a)*150,z=Math.cos(a)*150,y=38+rng.next()*16;
        for(let j=-1;j<=1;j++)this.fixed('sphere','#eff9ed',x+j*4,y+(j===0?1.8:0),z,5.8,3,3.4);
      }
    }
    fence(x,y,z,yaw){const p=M.transform(x,y,z,1,1,1,0,yaw);this.fixed('box','#f5dcab',0,6,0,2.3,6,.42,0,0,0,p);this.fixed('cone','#f5dcab',0,12.2,0,2.3,1.2,.43,0,PI/4,0,p);}
    tree(x,z,s){
      this.fixed('cylinder','#987058',x,4*s,z,.8*s,4*s,.8*s,0,0,-.07);
      this.fixed('sphere','#2f9264',x,10*s,z,4.8*s,5.7*s,4.8*s);
      this.fixed('sphere','#57ad66',x-2*s,11.2*s,z+1.5*s,3.8*s,3.9*s,3.6*s);
      this.fixed('sphere','#69bb72',x+2.1*s,13*s,z,3.2*s,3.5*s,3.2*s);
      for(let i=0;i<4;i++)this.fixed('sphere','#f3b56c',x+Math.sin(i*1.7)*3*s,(9.5+i%2*3)*s,z+Math.cos(i*1.7)*3*s,.38*s,.43*s,.38*s);
    }
    doghouse(x,z,s,yaw){const p=M.transform(x,0,z,s,s,s,0,yaw);this.fixed('box','#e98256',0,2.2,0,3.4,2.2,3.6,0,0,0,p);this.fixed('box','#345a67',0,1.6,3.64,1.45,1.6,.06,0,0,0,p);this.fixed('sphere','#345a67',0,3,3.65,1.45,1.25,.07,0,0,0,p);for(const side of [-1,1])this.fixed('box','#38546b',side*1.9,5,0,2.45,.3,4.2,0,0,side*-.52,p);this.fixed('box','#f5cf82',0,.15,4,3.8,.15,1,0,0,0,p);this.fixed('sphere','#f4d2a0',0,4,3.76,.53,.21,.07,0,0,0,p);}
    bowl(x,z,s,col){this.fixed('cone',col,x,.9,z,s,1.05,s);this.fixed('cylinder','#a5e1de',x,1.82,z,s*.8,.025,s*.8);for(let i=0;i<12;i++){const a=i/12*PI*2;this.fixed('sphere',col,x+Math.sin(a)*s*.88,1.8,z+Math.cos(a)*s*.88,s*.22,.28,s*.22);}}
    bench(x,z,yaw){const p=M.transform(x,0,z,1,1,1,0,yaw);for(let i=0;i<4;i++)this.fixed('box','#bd8459',0,6,i*1.3,11,.35,.5,0,0,0,p);for(let i=0;i<3;i++)this.fixed('box','#c99566',0,8+i*1.4,-1,11,.52,.35,0,0,0,p);for(const x of [-8,8])for(const z of [0,4])this.fixed('box','#37565b',x,3,z,.4,3,.4,0,0,0,p);}
    shadow(x,z,sx=1,sz=1,y=.09){this.shape('cylinder','#55824c',x,y,z,sx,.006,sz);}
    zones(game){
      for(const z of game.zones){
        const p=this.track.at(z.s,z.lane),g=M.transform(p.x,0,p.z,1,1,1,0,p.yaw);
        const col=z.type==='mud'?'#966a49':z.type==='water'?'#69c5cf':'#dbc566';
        this.shape('sphere',col,0,.08,0,z.width*.5,.025,z.length*.5,0,0,0,g);
        if(z.type==='boost'){
          for(let j=-3;j<=3;j++)for(const side of [-1,1])this.shape('box','#fff2a0',side*.65,.13,j*1.45,.85,.024,.21,0,side*-.6,0,g);
          for(let k=0;k<4;k++){const h=(this.clock*2+k)%3;this.shape('sphere','#f5e798',Math.sin(k*2)*1.2,h+.2,k*2-3,.07,.07,.07,0,0,0,g);}
        }else{
          for(let k=0;k<5;k++)this.shape('sphere',z.type==='mud'?'#b88656':'#a9e1df',Math.sin(k*4)*z.width*.3,.12,Math.cos(k*4)*z.length*.3,.5,.012,1,0,0,0,g);
        }
      }
    }
    obstacle(o){
      const p=this.track.at(o.s,o.lane),g=M.transform(p.x,0,p.z,1,1,1,0,p.yaw+(o.type==='slipper'?.6:0));
      if(o.type==='box'){
        this.shape('box','#be8b55',0,1.1,0,1.5,1.1,1.35,0,0,0,g);
        this.shape('box','#e2b27a',0,2.25,0,1.6,.09,1.44,0,0,0,g);
        this.shape('box','#efd0a0',0,1.12,1.36,.24,1.1,.025,0,0,0,g);
        this.shape('box','#efd0a0',0,2.35,0,.24,.01,1.42,0,0,0,g);
      }else if(o.type==='slipper'){
        this.shape('sphere','#5c91b7',0,.25,0,1.1,.24,2.35,0,0,0,g);
        this.shape('sphere','#91c5d4',0,.8,.6,1.12,.65,1.5,0,0,0,g);
        this.shape('sphere','#3a6885',0,.83,-.6,.72,.14,.7,0,0,0,g);
        this.shape('sphere','#e2e8c5',0,1.44,.9,.33,.08,.36,0,0,0,g);
      }else if(o.type==='ball'){
        this.shape('sphere','#d1e87b',0,1.1,0,1.2,1.2,1.2,this.clock*.3,0,.4,g);
        for(let i=0;i<18;i++){const a=i/18*PI*2;this.shape('sphere','#f8f1c5',Math.sin(a)*1.21,1.1+Math.cos(a)*1.21,0,.055,.055,.055,0,0,0,g);}
      }
    }
    hazard(o){
      const p=this.track.at(o.s,o.lane),g=M.transform(p.x,0,p.z,1,1,1,0,p.yaw+PI/2);
      if(o.type==='pigeon'){
        this.shape('sphere','#8ea4ba',0,.9,0,.6,.7,.9,0,0,0,g);this.shape('sphere','#506c85',0,1.6,.57,.44,.48,.44,0,0,0,g);
        this.shape('sphere','#8ed3b9',0,1.22,.6,.35,.17,.35,0,0,0,g);this.shape('cone','#f4c772',0,1.53,1.06,.12,.3,.12,PI/2,0,0,g);
        for(const s of [-1,1]){this.shape('sphere','#f9f2dd',s*.28,1.7,.86,.12,.13,.085,0,0,0,g);this.shape('sphere','#1e3547',s*.28,1.7,.93,.045,.06,.035,0,0,0,g);this.shape('cylinder','#e19e7d',s*.23,.25,.1+Math.sin(this.clock*12+s)*.15,.065,.26,.065,0,0,0,g);}
      }else{
        const color=o.active?'#e78175':'#779aac';
        this.shape('sphere',color,0,1.1,0,1.7,1.1,2,0,0,0,g);this.shape('box','#3f626a',0,.3,2,2.2,.28,.7,0,0,0,g);
        for(const s of [-1,1])this.shape('cylinder','#244451',s*1.55,.65,-.4,.7,.22,.7,0,0,PI/2,g);
        for(let i=0;i<9;i++)this.shape('sphere','#547079',0,1.7+i*.3,-.8+Math.sin(i*.38)*1.3,.36,.36,.36,0,0,0,g);
        this.shape('box','#536976',0,4.4,-.4,.7,.17,.27,0,0,0,g);
        if(o.active)for(let i=0;i<6;i++)this.shape('sphere','#f7e6ad',Math.sin(i*2+this.clock*9)*2,.3+(i%3)*.4,2+(i+this.clock*10)%4,.09,.09,.09,0,0,0,g);
      }
    }
    item(type,parent,scale=1){
      const g=M.multiply(parent,M.transform(0,0,0,scale,scale,scale));
      const s=(...a)=>this.shape(...a,0,0,0,g);
      if(type==='bone'){
        this.shape('cylinder','#fff1c6',0,0,0,.15,.68,.15,0,0,PI/2,g);
        for(const x of [-.65,.65])for(const y of [-.17,.17])s('sphere','#fff1c6',x,y,0,.26,.25,.23);
      }else if(type==='sausage'){
        this.shape('sphere','#da705d',0,0,0,.8,.3,.3,0,0,.3,g);
        for(const x of [-.85,.85])this.shape('cone','#f2c093',x,x*.3,0,.21,.15,.21,0,0,PI/2,g);
        for(let i=0;i<3;i++)this.shape('box','#ecab79',i*.3-.3,.17+i*.08,.24,.06,.13,.028,0,0,.5,g);
      }else if(type==='milk'){
        s('cone','#75b5d6',0,-.12,0,.68,.26,.68);s('cylinder','#fff8df',0,.11,0,.52,.04,.52);
      }else if(type==='fish'){
        s('sphere','#6ac5e4',0,0,0,.6,.33,.23);this.shape('cone','#4fa9ce',-.63,0,0,.32,.29,.14,0,0,-PI/2,g);s('sphere','#f7f3d8',.35,.08,.21,.12,.12,.06);s('sphere','#234752',.37,.09,.26,.045,.05,.024);
      }else if(type==='yarn'){
        s('sphere','#b685e0',0,0,0,.58,.58,.58);for(let j=0;j<3;j++)for(let i=0;i<12;i++){const a=i/12*PI*2;s('sphere','#d1b4e9',Math.sin(a)*.59,Math.cos(a)*.59*Math.cos(j),Math.cos(a)*.59*Math.sin(j),.028,.028,.028);}
      }else if(type==='broom'){
        this.shape('cylinder','#bc8855',0,.3,0,.065,.77,.065,0,0,-.45,g);this.shape('box','#edcf7e',-.35,-.46,0,.38,.29,.19,0,0,-.45,g);
      }else if(type==='shampoo'){
        s('box','#8ae1df',0,0,0,.35,.53,.24);s('box','#fff1bd',0,0,.25,.22,.21,.015);s('box','#eb9275',0,.61,0,.23,.1,.19);s('sphere','#eefced',.53,.48,0,.16,.16,.16);
      }else if(type==='trap'){
        s('box','#d7a76a',0,-.17,0,.58,.08,.39);this.shape('box','#768e91',0,.14,0,.43,.035,.30,0,0,.75,g);s('sphere','#f4de86',.31,0,0,.18,.12,.14);
      }else if(type==='fly'){
        s('sphere','#374f51',0,0,0,.23,.31,.27);for(const side of [-1,1])this.shape('sphere','#d7f3df',side*.3,.23,0,.36,.05,.21,0,0,side*Math.sin(this.clock*35)*.5,g);s('sphere','#e9a188',0,.13,.21,.21,.17,.1);
      }else if(type==='frenzy'){
        s('sphere','#d8f583',0,0,0,.45,.45,.45);for(let i=0;i<6;i++){const a=i/6*PI*2+this.clock*2;s('sphere','#f5e595',Math.sin(a)*.69,Math.cos(a)*.69,0,.11,.11,.11);}
      }else{
        s('sphere','#ff758d',0,0,0,.27,.27,.27);s('sphere','#fff0ca',-.05,.1,.22,.075,.075,.075);for(let i=0;i<3;i++)s('sphere','#d8bb88',-.4-i*.2,-.15,0,.04,.04,.04);
      }
    }
    pickups(game){
      for(const p of game.pickups){
        if(p.respawn>0)continue;
        const pos=this.track.at(p.s,p.lane),h=1.25+Math.sin(this.clock*2+p.phase)*.22;
        this.shape('cylinder','#d7b87b',pos.x,.08,pos.z,.84,.022,.84);
        const g=M.transform(pos.x,h,pos.z,1,1,1,0,this.clock*.9+p.phase);
        this.item(p.type,g,1.2);
        this.shape('sphere','#fef4b0',pos.x,2.35+Math.sin(this.clock*3+p.phase)*.15,pos.z,.095,.095,.095);
      }
      for(const t of game.traps){const p=this.track.at(t.s,t.lane);this.item(t.type,M.transform(p.x,.4,p.z,1,1,1,0,p.yaw),1.7);if(t.type==='shampoo')this.shape('sphere','#afe8df',p.x,.1,p.z,1.8,.035,2.1);}
    }
    pet(r,time,override=null){
      const p=override||this.track.at(r.s,r.lane),isCat=r.species==='cat';
      const bounce=r.speed>1?Math.abs(Math.sin(r.anim*1.4))*.10:Math.sin(time*2)*.025;
      const stun=r.stun>0,turn=r.steer*.17+(r.drifting?r.steer*.23:0)+(stun?Math.sin(time*15)*.18:0);
      const size=p.scale||1,g=M.transform(p.x,r.y+bounce,p.z,size,size,size,0,p.yaw+turn,stun?Math.sin(time*14)*.12:-r.steer*.075);
      const palettes=isCat?[['#edaa61','#ffdeb2','#c68050'],['#879fb2','#dce0d6','#60778e'],['#c8b5a2','#f1dbc2','#8a776b']]:[['#eac48d','#fff0d4','#906b51'],['#787b87','#f1e4ca','#414b5e'],['#aa7156','#eed0a0','#714a3c']];
      const [fur,cream,dark]=palettes[r.color%3],collar=['#ed7758','#68ccd4','#b49bdd'][r.color%3];
      const s=(type,col,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,par=g)=>this.shape(type,col,x,y,z,sx,sy,sz,rx,ry,rz,par);
      this.shadow(p.x,p.z,1.05,1.7,.055);
      s('sphere',fur,0,1.12,0,.66,.67,1.12);s('sphere',cream,0,1.12,.56,.56,.53,.61);
      // Four separately articulated legs, with a diagonal running gait.
      for(const side of [-1,1])for(const end of [-1,1]){
        let swing=r.speed>1?Math.sin(r.anim*1.5+(side===end?0:PI))*.66:0;
        if(r.y>.1)swing=end*.5;
        const washing=isCat&&stun&&side===1&&end===1;
        const leg=M.multiply(g,M.transform(side*.48,.86,end*.67,1,1,1,washing?-1.4+Math.sin(time*16)*.4:swing));
        s('sphere',fur,0,-.23,0,.20,.35,.23,0,0,0,leg);s('sphere',cream,0,-.55,.13,.24,.17,.32,0,0,0,leg);
      }
      const head=M.multiply(g,M.transform(0,1.65,1.01,1,1,1,r.boost>0?-.08:0,stun?Math.sin(time*10)*.33:0));
      s('sphere',fur,0,0,.1,.67,.59,.64,0,0,0,head);
      s('sphere',cream,0,-.2,.56,isCat?.44:.49,.29,isCat?.22:.41,0,0,0,head);
      s('sphere',isCat?'#d88b8c':'#31444a',0,-.10,isCat?.80:.97,.17,.12,.12,0,0,0,head);
      const blink=Math.sin(time*.6+r.blink*5)>.998;
      for(const side of [-1,1]){
        s('sphere','#fff7e2',side*.35,.19,.55,.255,blink?.035:.27,.15,0,0,0,head);
        s('sphere','#253e45',side*.35+(r.steer||0)*.027,.18,.677,isCat?.083:.10,blink?.015:.14,.055,0,0,0,head);
        if(!blink)s('sphere','#ffffff',side*.33,.23,.725,.04,.046,.025,0,0,0,head);
        if(isCat){s('cone',fur,side*.44,.65,.02,.29,.42,.24,0,0,-side*.15,head);s('cone','#e4a7a0',side*.44,.66,.19,.17,.27,.05,0,0,-side*.15,head);for(let j=0;j<2;j++)s('cylinder',cream,side*.59,-.15-j*.09,.72,.018,.29,.018,0,0,PI/2+side*(j-.5)*.2,head);}
        else s('sphere',dark,side*.67,-.10,.01,.25,.58,.28,Math.sin(r.anim*1.5)*.18,0,-side*.16,head);
      }
      if(r.speed>8&&!isCat)s('sphere','#e79898',0,-.40,.81,.15,.20,.07,Math.sin(r.anim*1.2)*.2,0,0,head);
      s('cylinder',collar,0,1.3,.85,.57,.14,.57,PI/2,0,0);s('sphere','#ffd871',0,.84,.91,.17,.17,.055);
      for(let i=0;i<(isCat?7:4);i++){
        const a=i/(isCat?7:4),wag=Math.sin(time*(r.speed>1?12:4))*a*.45;
        s('sphere',isCat&&i%2?dark:fur,wag,1.1+a*(isCat?1.65:.8),-1.0-a*.7,.18-a*.07,.23,.20-a*.07);
      }
      if(isCat)for(let i=0;i<3;i++)s('sphere',dark,0,1.68,-.7+i*.39,.36,.055,.08);
      // An oversized parasite is always visible above the pet's silhouette.
      const bug=M.multiply(g,M.transform(0,1.98,-.12,1,1,1,-r.steer*.12,0,Math.sin(time*4)*.045));
      const flea=r.rider==='flea',bugCol=flea?'#91cc63':'#b87565';
      s('sphere',bugCol,0,.27,0,.39,.49,.32,0,0,0,bug);s('sphere',flea?'#c5e689':'#dfac87',0,.66,.10,.34,.31,.30,0,0,0,bug);
      s('sphere',collar,0,.84,.06,.39,.22,.35,0,0,0,bug);s('box','#ffeab3',0,.86,.385,.10,.08,.045,0,0,0,bug);
      for(const side of [-1,1]){
        s('sphere','#fff6db',side*.155,.64,.355,.15,.14,.065,0,0,0,bug);s('sphere','#253e45',side*.155,.63,.413,.069,.075,.025,0,0,0,bug);
        s('cylinder','#426256',side*.27,.95,.12,.025,.29,.025,0,0,-side*.43,bug);s('sphere','#ffdc7e',side*.39,1.21,.12,.068,.072,.068,0,0,0,bug);
        const armAngle=r.y>.1?side*.8:-side*.6;
        s('cylinder',bugCol,side*.38,.31,.17,.046,.26,.046,r.y>.1?0:1,0,armAngle,bug);
        s('sphere',cream,side*.50,r.y>.1?.52:.27,.34,.09,.09,.09,0,0,0,bug);
        for(let j=0;j<(flea?2:3);j++)s('cylinder',bugCol,side*.40,.02,-.2+j*.18,.044,.23,.044,0,0,side*1.05,bug);
      }
      s('box','#ffd468',0,.12,-.38,.14,.05,.30,.2,0,Math.sin(time*10)*.15,bug);
      if(r.shield>0)for(let i=0;i<12;i++){const a=i/12*PI*2+time*3;s('sphere','#b6f5ed',Math.sin(a)*1.1,1.3+Math.cos(a*2)*.45,Math.cos(a)*1.65,.085,.085,.085);}
      if(stun)for(let i=0;i<3;i++){const a=time*5+i*2.09;s('sphere','#ffe17b',Math.sin(a)*.9,3.35,Math.cos(a)*.9,.14,.14,.14);}
      if(r.distracted>0){const a=time*9;s('sphere',isCat?'#ff5e77':'#f2cd60',Math.sin(a)*1.9,.11,2.8,.18,.09,.18);}
    }
    burst(r,type,count=13){const p=this.track.at(r.s,r.lane),col=['boost','pickup'].includes(type)?'#ffe09b':type==='slip'?'#c6f0ed':'#fae4b6';for(let i=0;i<count;i++){const a=Math.random()*PI*2,speed=1+Math.random()*3;this.particles.push({x:p.x,y:1+r.y,z:p.z,vx:Math.sin(a)*speed,vy:2+Math.random()*3,vz:Math.cos(a)*speed,life:.6+Math.random()*.4,max:1,col,size:.08+Math.random()*.12});}}
    draw(game,time,dt,menu=false,selection=null){
      this.clock=time;this.r.clearDynamic();this.zones(game);
      for(const o of game.obstacles)this.obstacle(o);for(const h of game.hazards)this.hazard(h);this.pickups(game);
      if(menu){
        const hero={...game.player,speed:0,anim:time*4,steer:Math.sin(time*.55)*.25,stun:0,y:0,boost:0,shield:0,distracted:0,...selection};
        this.pet(hero,time,{x:0,z:73,yaw:.55+Math.sin(time*.24)*.2,scale:1.55});
      }else for(const racer of game.racers)if(!racer.eliminated)this.pet(racer,time);
      if(!menu)for(const r of game.racers){
        if(r.speed>12&&!r.eliminated&&Math.random()<dt*(r.boost>0?45:15)){
          const p=this.track.at(r.s-1.7,r.lane+(Math.random()-.5));this.particles.push({x:p.x,y:.25+r.y,z:p.z,vx:0,vy:.5,vz:0,life:.4,max:.4,col:r.boost>0?'#ffe899':r.drifting?'#8ee3ee':'#ead4a3',size:r.boost>0?.17:.12});
        }
      }
      for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=3*dt;const k=Math.max(0,p.life/p.max);this.shape('sphere',p.col,p.x,p.y,p.z,p.size*k,p.size*k,p.size*k);}
      this.particles=this.particles.filter(p=>p.life>0).slice(-350);
    }
  }
  root.PetWorld=World;
})(window);
