'use strict';

const {drop,flight}=require('./fluid');

const TAU = 2 * Math.PI;
const mix = (a,b,t) => a + (b-a)*t;
const unit = v => {
  const length = Math.hypot(...v) || 1;
  return v.map(x => x / length);
};

// Ledge coordinates use a bevelled rectangle. Sill, crown and seam offsets
// share the same perimeter so the cap meets every exposed face.
function ledge(s, spacing, emit, noise) {
  const [w,h,d] = s.size.map(v => v/2);
  const bevel = Math.min(h*.49,w*.30,d*.30);
  const rows = Math.max(3,Math.ceil(2*h/spacing));
  const sides = Math.max(16,Math.ceil(4*(w+d)/spacing));
  const edge = a => {
    const x=Math.cos(a),z=Math.sin(a);
    const r=1/Math.max(Math.abs(x),Math.abs(z),(.66*(Math.abs(x)+Math.abs(z))));
    return [x*r,z*r];
  };
  const crown = (x,z) => h + .085*(noise(4*x+3,4*z)-.52);
  const snow = (x,z) => noise(x*2.3+8,z*2.5+4)+.26*noise(x*8.7,z*8.7+10) > .63;
  const edgeScale = v => 1-.17*Math.max(0,(v-(1-bevel/h))*h/bevel)-.10*Math.max(0,-v);
  for(let j=0;j<=rows;j++){
    const v=-1+2*j/rows, roof=v>1-bevel/h;
    for(let i=0;i<sides;i++){
      const a=i*TAU/sides;
      const [u,t]=edge(a);
      const nx=Math.abs(u)>.90?Math.sign(u):Math.abs(t)<.9?u:0;
      const nz=Math.abs(t)>.90?Math.sign(t):Math.abs(u)<.9?t:0;
      const x=w*u,z=d*t;
      const layer=Math.floor((j/rows)*Math.max(2,Math.round(h*5)));
      const breakage=(noise(11*u+20*layer,11*t)-.50)*.12+(noise(u*7,t*7)-.50)*.10;
      const step=edgeScale(v)+breakage*(1-Math.abs(v)**4);
      const cap=s.accent&&v>.62&&snow(x,z)&&v>.92-(noise(u*9+1,t*9)*.29);
      const moss=s.moss&&v>.23&&v<.80&&noise(x*6+10,z*6+7)>.72;
      emit([x*step,v*h+(crown(x,z)-h)*(v+1)*.5,z*step],unit([nx,roof?.72:.02,nz]),
        cap?s.accent:moss?s.moss:s.material,1.17);
    }
  }
  const limit=edgeScale(1);
  const topX=Math.ceil(2*w*limit/spacing),topZ=Math.ceil(2*d*limit/spacing);
  for(let i=0;i<=topX;i++)for(let j=0;j<=topZ;j++){
    const u=(2*i/topX-1),v=(2*j/topZ-1);
    if((Math.abs(u)+Math.abs(v))*.66>1)continue;
    const x=u*w*limit,z=v*d*limit;
    const mat=s.accent&&snow(x,z)?s.accent:s.moss&&noise(x*4,z*4)>.72?s.moss:s.material;
    emit([x,crown(x/limit,z/limit),z],[0,1,0],mat,1.21);
  }
}

const waterPhase = (kind,t) => kind+t*.997;

function stream(s, spacing, emit, noise) {
  const [dx,dy,dz]=s.to.map((v,i)=>v-s.at[i]);
  const span=Math.hypot(dx,dz);
  const direction=[dx/span,0,dz/span];
  const lateral=[direction[2],0,-direction[0]];
  const normal=unit([-direction[0]*dy,span,-direction[2]*dy]);
  const endWidth=s.endWidth??s.width;
  const columns=Math.max(5,Math.ceil(Math.max(s.width,endWidth)/spacing));
  const rows=Math.max(3,Math.ceil(Math.hypot(dx,dy,dz)/spacing));
  for(let j=0;j<=rows;j++){
    const t=j/rows, width=mix(s.width,endWidth,t);
    for(let i=0;i<=columns;i++){
      const u=i/columns-.5;
      const edge=(u+(noise(i*.51,t*7)-.5)*.045)*width;
      const mat=s.material;
      emit([dx*t+lateral[0]*edge,dy*t,dz*t+lateral[2]*edge],normal,mat,1.13,waterPhase(6,t));
    }
  }
}

// The core of the fall stays connected. Swollen folds in its cross-section
// and particles peeling off the sides give it a broken silhouette in motion.
function cascade(s, spacing, emit, noise) {
  const [dx,dy,dz]=s.to.map((v,i)=>v-s.at[i]);
  const span=Math.hypot(dx,dz);
  const [fx,fz]=span>1e-6?[dx/span,dz/span]:[0,1];
  const lateral=[fz,0,-fx];
  const endWidth=s.endWidth??s.width;
  const width=Math.max(s.width,endWidth);
  const thickness=s.thickness??Math.max(.12,Math.min(.38,width*.24));
  const folds=s.strands??Math.max(1,Math.min(6,Math.round(width/.32)));
  const rows=Math.max(4,Math.ceil(1.22*Math.hypot(dx,dy,dz)/spacing));
  const segments=Math.max(16,Math.ceil(TAU*Math.max(width*.53,thickness*.8)/spacing));
  for(let j=0;j<=rows;j++){
    const v=j/rows,t=flight(v);
    const pinch=Math.sin(Math.PI*v)**2;
    const halfWidth=mix(s.width,endWidth,v)*(.50-.070*pinch);
    const halfDepth=thickness*(.39+.28*v-.12*pinch);
    const lean=unit([fx*-dy*(.16+1.68*t),span,fz*-dy*(.16+1.68*t)]);
    const skew=(noise(13,t*4.3)-.5)*width*.17*pinch;
    for(let i=0;i<segments;i++){
      const theta=(i+(j%2)*.41)*TAU/segments;
      const a=Math.cos(theta),b=Math.sin(theta);
      const swell=(noise(a*folds+22.7,t*3.4)-.5)*.51;
      const curl=.13*Math.sin(a*folds*Math.PI*1.3+t*9)+.16*(noise(a*9+3,t*5)-.5);
      const side=a*halfWidth*(1+.065*noise(i*.27,t*3))+skew;
      const depth=b*halfDepth*(1+swell+curl);
      const surface=[dx*t+lateral[0]*side+lean[0]*depth,dy*v+lean[1]*depth,
        dz*t+lateral[2]*side+lean[2]*depth];
      const n=unit(lateral.map((axis,k)=>axis*a/halfWidth+lean[k]*b/halfDepth));
      emit(surface,n,s.material,1.18,waterPhase(5,t));
    }
  }
}

module.exports={ledge,stream,cascade};
