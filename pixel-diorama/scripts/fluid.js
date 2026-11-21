'use strict';

const sceneFluid=(()=>{
  const loop=8, tau=2*Math.PI;
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(x,b));
  const mix=(a,b,t)=>a+(b-a)*t;
  const fract=x=>x-Math.floor(x);
  const poolTime=(t,period)=>fract(t/period);
  const fade=(a,b,t)=>clamp((t-a)/(b-a));

  // Use normalized time for horizontal inertia and quadratic vertical drop.
  const drop=q=>q*(.16+.84*q);
  const flight=depth=>(Math.sqrt(.16**2+3.36*depth)-.16)/1.68;

  function compile(s,materials,key,first,group){
    const delta=s.to.map((v,i)=>v-s.at[i]);
    const [dx,dy,dz]=delta, span=Math.hypot(dx,dz);
    const axis=span>1e-7?[dx/span,dz/span]:[0,1];
    const falls=s.kind==='cascade';
    const width=s.width, endWidth=s.endWidth??width;
    const thickness=s.thickness??Math.max(.12,Math.min(.38,Math.max(width,endWidth)*.24));
    const duration=falls?Math.sqrt(-dy*.84/4.9):Math.hypot(...delta)/1.35;
    const cycles=clamp(Math.round(loop/duration),1,23);
    const count=falls?clamp(Math.ceil(width*(-dy)*190),126,455):clamp(Math.ceil(width*span*51),44,220);
    const splash=falls?clamp(Math.ceil(endWidth*104),76,235):0;
    const ramp=materials[s.material].ramp;
    const foam=materials[s.accent??s.material].ramp;
    return {at:s.at,delta,axis,width,endWidth,thickness,
      reach:s.splash??Math.max(.36,endWidth*.5),colors:[ramp[Math.floor(ramp.length*.52)],ramp.at(-1),foam.at(-1)],
      key,first,count,splash,falls,cycles,group};
  }

  function seed(flow){
    let state=flow.key|0;
    const random=()=>{
      state=Math.imul(1664525,state)+1013904223|0;
      return (state>>>0)/4294967296;
    };
    return Array.from({length:flow.count+flow.splash},(_,i)=>{
      const offset=(i+random())*.61803398875;
      return [offset,random(),random(),random(),random(),random(),random()];
    });
  }

  function write(out,index,x,y,z,alpha,radius,long,axis,ink){
    const q=index*12, [a,b,c]=axis;
    const r=radius*radius, stretch=long*long-r;
    out[q]=x;
    out[q+1]=y;
    out[q+2]=z;
    out[q+3]=alpha;
    out[q+4]=r+a*a*stretch;
    out[q+5]=a*b*stretch;
    out[q+6]=a*c*stretch;
    out[q+7]=ink;
    out[q+8]=r+b*b*stretch;
    out[q+9]=b*c*stretch;
    out[q+10]=r+c*c*stretch;
    out[q+11]=3;
  }

  function pigment(color){
    return (color>>16&255)+((color>>8&255)<<8)+((color&255)<<16);
  }

  function paint(flow,particles,time,out){
    const {at,delta,axis,width,endWidth,thickness,reach,count,first,cycles,falls}=flow;
    const [ox,oy,oz]=at,[dx,dy,dz]=delta,[fx,fz]=axis;
    const [body,bright,white]=flow.colors.map(pigment);
    const t=fract(time/loop)*loop;
    const inverseLength=1/(Math.hypot(dx,dy,dz)||1);
    const streamAxis=[dx*inverseLength,dy*inverseLength,dz*inverseLength];
    const size=clamp(Math.sqrt(width)*.87,.4,1.55);
    for(let i=0;i<count;i++){
      const [offset,lane,front,wake,grain,spin,froth]=particles[i];
      const q=fract(offset+t*Math.max(1,cycles+Math.floor(spin*3)-1)/loop);
      const v=falls?drop(q):q;
      const w=mix(width,endWidth,v);
      const drift=falls?(.015+.075*v)*Math.sin(11*q+lane*19+wake*5):.019*Math.sin(q*13+lane*32);
      const split=falls&&front>.80?fade(.53,1,q)**2:0;
      const across=((lane-.5)*(falls?.96+.12*v+.26*split:.90)+drift)*w;
      if(falls){
        const vy=dy*(.16+1.68*q);
        const tangentLength=Math.hypot(dx,vy,dz);
        const tangent=[dx/tangentLength,vy/tangentLength,dz/tangentLength];
        const face=(front<.13?-.57:1)*Math.sqrt(Math.max(.07,1-(2*lane-1)**2));
        const belt=thickness*face*(.27+.25*wake+.17*v+.29*split+.13*Math.sin(spin*tau+q*8+lane*9));
        const thinning=1-.27*fade(.2,.72,q)+.23*fade(.78,1,q);
        const puff=fade(.02,.12,q)*fade(1,.96,q);
        const air=grain<.08+.37*v?v:.12*v;
        const ink=froth<.38*air?white:froth<.54+.50*air?bright:body;
        const r=size*(.010+.015*wake)*thinning;
        const length=size*(.023+.102*(.16+1.68*q))*(.42+.58*grain);
        write(out,first+i,ox+dx*q+fz*across+fx*belt,oy+dy*v,
          oz+dz*q-fx*across+fz*belt,puff*(.48+.53*spin),r,length,tangent,ink);
      }else{
        const sheen=(.3+.7*fade(.45,.89,front)) * fade(0,.09,q)*fade(1,.92,q);
        const ripple=.014*Math.sin(q*12+lane*23+spin*.8);
        write(out,first+i,ox+dx*q+fz*across,oy+dy*q+.022+ripple,oz+dz*q-fx*across,
          sheen*(.30+.47*grain),size*(.010+.014*grain),size*(.035+.066*wake),
          streamAxis,froth<.17?white:froth<.84?bright:body);
      }
    }

    // Momentum turns into a spreading surface current. A smaller portion leaves
    // on ballistic arcs, with fine mist lingering close to the collision.
    for(let i=count;i<particles.length;i++){
      const [offset,lane,speed,wake,grain,spin,froth]=particles[i];
      const spray=i-count<flow.splash*.33;
      const mist=i-count>=flow.splash*.88;
      const period=loop/(spray?12+Math.floor(grain*4):mist?6+Math.floor(grain*2):8+Math.floor(grain*4));
      const age=poolTime(t+offset*period,period);
      const push=1-(1-age)**2;
      const origin=(lane-.5)*endWidth*.88;
      const advance=.034+reach*push*(.31+speed*(spray?.95:1.58));
      const side=origin+reach*push*(wake-.5)*1.7;
      const life=fade(0,.13,age)*fade(1,.35,age);
      const x=ox+dx+fz*side+fx*advance,z=oz+dz-fx*side+fz*advance;
      const hit=oy+dy;
      const launch=4*(.075+spin*.42);
      const rise=spray?launch*age*(1-age):mist?.09+(.16+.18*spin)*age:.030+(.085+.046*spin)*(1-age)**3;
      const opacity=mist?.12:spray?.42+speed*.51:.37+spin*.59;
      const radius=mist?.042+.070*age:spray?.012+.014*grain:.027+.032*speed+.019*push;
      const yVelocity=spray?launch*(1-2*age):0;
      const dirX=fx*speed+fz*(wake-.5),dirZ=fz*speed-fx*(wake-.5);
      const length=Math.hypot(dirX,yVelocity,dirZ)||1;
      const drag=[dirX/length,yVelocity/length,dirZ/length];
      write(out,first+i,x,hit+rise,z,life*opacity,radius,radius*(mist?1.15:spray?1.26:1.72),
        drag,froth<.69?white:bright);
    }
  }

  function prepare(flows){
    return flows.map(flow=>seed(flow));
  }

  function apply(flows,particles,time,out,posed){
    for(let i=0;i<flows.length;i++){
      const flow=flows[i];
      paint(flow,particles[i],time,out);
      if(posed){
        const from=flow.first*12,to=(flow.first+flow.count+flow.splash)*12;
        posed.set(out.subarray(from,to),from);
      }
    }
  }

  return {compile,drop,flight,prepare,apply};
})();
if(typeof module==='object')module.exports=sceneFluid;
