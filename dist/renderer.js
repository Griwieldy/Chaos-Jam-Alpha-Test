(function(root){
  'use strict';
  const M={
    identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
    multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[r+4]*b[c*4+1]+a[r+8]*b[c*4+2]+a[r+12]*b[c*4+3];return o;},
    transform(x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
      const cx=Math.cos(rx),snx=Math.sin(rx),cy=Math.cos(ry),sny=Math.sin(ry),cz=Math.cos(rz),snz=Math.sin(rz);
      // T * Ry * Rx * Rz * S, column-major.
      return new Float32Array([(cy*cz+sny*snx*snz)*sx,cx*snz*sx,(-sny*cz+cy*snx*snz)*sx,0,(-cy*snz+sny*snx*cz)*sy,cx*cz*sy,(sny*snz+cy*snx*cz)*sy,0,sny*cx*sz,-snx*sz,cy*cx*sz,0,x,y,z,1]);
    },
    perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);},
    look(eye,target){
      let z=eye.map((v,i)=>v-target[i]),n=Math.hypot(...z);z=z.map(v=>v/n);let x=[z[2],0,-z[0]];n=Math.hypot(...x);x=x.map(v=>v/n);const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
      return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);
    }
  };
  const colors=new Map();
  function color(c){if(Array.isArray(c))return c;if(colors.has(c))return colors.get(c);const n=parseInt(c.replace('#',''),16),v=[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];colors.set(c,v);return v;}
  function geometry(type){
    const p=[],n=[];
    const tri=(a,b,c,normal)=>{p.push(...a,...b,...c);n.push(...normal,...normal,...normal);};
    if(type==='box'){
      for(const [a,b,c,d,nm] of [[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]]]){tri(a,b,c,nm);tri(a,c,d,nm);}
    }else if(type==='sphere'){
      const uv=(i,j)=>{const a=i/12*Math.PI,b=j/16*Math.PI*2;return [Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];};
      for(let i=0;i<12;i++)for(let j=0;j<16;j++){const a=uv(i,j),b=uv(i+1,j),c=uv(i+1,j+1),d=uv(i,j+1);p.push(...a,...b,...c,...a,...c,...d);n.push(...a,...b,...c,...a,...c,...d);}
    }else if(type==='cylinder'||type==='cone'){
      for(let i=0;i<16;i++){
        const a=i/16*Math.PI*2,b=(i+1)/16*Math.PI*2,va=[Math.cos(a),-1,Math.sin(a)],vb=[Math.cos(b),-1,Math.sin(b)],vc=type==='cone'?[0,1,0]:[Math.cos(b),1,Math.sin(b)],vd=type==='cone'?[0,1,0]:[Math.cos(a),1,Math.sin(a)],nm=[Math.cos((a+b)/2),type==='cone'?.5:0,Math.sin((a+b)/2)];
        tri(va,vb,vc,nm);if(type!=='cone'){tri(va,vc,vd,nm);tri([0,1,0],vd,vc,[0,1,0]);}tri([0,-1,0],vb,va,[0,-1,0]);
      }
    }
    return {positions:p,normals:n};
  }
  class Renderer{
    constructor(canvas){
      this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('Для игры нужен WebGL 2. Включите аппаратное ускорение браузера.');
      const vert=`#version 300 es
      precision highp float;
      layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNormal;
      layout(location=2) in mat4 aModel; layout(location=6) in vec3 aColor;
      uniform mat4 uVP; uniform vec3 uEye; out vec3 vColor; out vec3 vNormal; out vec3 vWorld; out float vDistance;
      void main(){vec4 w=aModel*vec4(aPos,1.);gl_Position=uVP*w;vWorld=w.xyz;vDistance=length(w.xyz-uEye);vColor=aColor;mat3 basis=mat3(aModel);vec3 lens=vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2]));vNormal=normalize(basis*(aNormal/max(lens,vec3(.000001))));}`;
      const frag=`#version 300 es
      precision highp float; in vec3 vColor; in vec3 vNormal; in vec3 vWorld; in float vDistance; uniform vec3 uFog; out vec4 outColor;
      void main(){vec3 N=normalize(vNormal);float d=max(0.,dot(N,normalize(vec3(-.6,1.,.4))));float light=.56+floor(d*4.)/4.*.43;vec3 c=vColor*light; c+=vec3(.02,.045,.055)*max(N.y,0.);float f=smoothstep(95.,230.,vDistance);outColor=vec4(mix(c,uFog,f),1.);}`;
      const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vert));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
      this.uniform={vp:gl.getUniformLocation(this.program,'uVP'),eye:gl.getUniformLocation(this.program,'uEye'),fog:gl.getUniformLocation(this.program,'uFog')};this.meshes=new Map();this.static=new Map();this.dynamic=new Map();this.fog=color('#8fdae4');
      for(const type of ['box','sphere','cylinder','cone'])this.addMesh(type,geometry(type));
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);this.resize();
    }
    addMesh(name,{positions,normals}){
      const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);
      for(const [i,values] of [[0,positions],[1,normals]]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);}
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(let i=0;i<4;i++){gl.enableVertexAttribArray(2+i);gl.vertexAttribPointer(2+i,4,gl.FLOAT,false,76,i*16);gl.vertexAttribDivisor(2+i,1);}
      gl.enableVertexAttribArray(6);gl.vertexAttribPointer(6,3,gl.FLOAT,false,76,64);gl.vertexAttribDivisor(6,1);gl.bindVertexArray(null);
      this.meshes.set(name,{vao,buffer,count:positions.length/3,data:new Float32Array(19*2048)});this.static.set(name,[]);this.dynamic.set(name,[]);
    }
    resize(){const ratio=Math.min(root.devicePixelRatio||1,1.6),w=Math.floor(this.canvas.clientWidth*ratio),h=Math.floor(this.canvas.clientHeight*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);}
    clearDynamic(){for(const a of this.dynamic.values())a.length=0;}
    clearStatic(){for(const a of this.static.values())a.length=0;}
    shape(type,col,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,parent=null,fixed=false){let m=M.transform(x,y,z,sx,sy,sz,rx,ry,rz);if(parent)m=M.multiply(parent,m);(fixed?this.static:this.dynamic).get(type).push(...m,...color(col));}
    render(eye,target,fov=62){
      this.resize();const gl=this.gl;gl.clearColor(...this.fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const vp=M.multiply(M.perspective(fov*Math.PI/180,this.canvas.width/this.canvas.height,.13,330),M.look(eye,target));gl.uniformMatrix4fv(this.uniform.vp,false,vp);gl.uniform3fv(this.uniform.eye,eye);gl.uniform3fv(this.uniform.fog,this.fog);
      for(const [name,g] of this.meshes){const a=this.static.get(name),b=this.dynamic.get(name),length=a.length+b.length;if(!length)continue;if(g.data.length<length)g.data=new Float32Array(Math.ceil(length/19/1024)*19*1024);g.data.set(a);g.data.set(b,a.length);gl.bindVertexArray(g.vao);gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.bufferData(gl.ARRAY_BUFFER,g.data.subarray(0,length),gl.DYNAMIC_DRAW);gl.drawArraysInstanced(gl.TRIANGLES,0,g.count,length/19);}
      gl.bindVertexArray(null);
    }
  }
  const api={Renderer,M,color,geometry};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PetGFX=api;
})(typeof window!=='undefined'?window:globalThis);
