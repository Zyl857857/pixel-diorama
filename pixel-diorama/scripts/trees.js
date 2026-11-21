'use strict';

const TAU=2*Math.PI, PHYLLOTAXIS=2.399963229728653;
const mix=(a,b,t)=>a+(b-a)*t;
const between=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=([x,y,z],[a,b,c])=>[y*c-z*b,z*a-x*c,x*b-y*a];
const unit=v=>{const k=Math.hypot(...v)||1;return v.map(n=>n/k);};
const place=(base,x,y,z)=>[base[0]+x,base[1]+y,base[2]+z];

function painter(shape,spacing,emit,noise){
  const wood=shape.trunk??shape.material;
  function limb(a,b,r0,r1){
    const direction=unit(minus(b,a));
    const u=unit(cross(direction,Math.abs(direction[1])>.9?[0,0,1]:[0,1,0]));
    const v=cross(direction,u);
    const steps=Math.max(1,Math.ceil(Math.hypot(...minus(b,a))/(spacing*.79)));
    const sides=Math.max(6,Math.ceil(TAU*r0/(spacing*.80)));
    for(let k=0;k<=steps;k++){
      const t=k/steps,p=between(a,b,t),radius=mix(r0,r1,t);
      for(let j=0;j<sides;j++){
        const angle=TAU*(j+.28*(k%2))/sides;
        const n=u.map((x,i)=>x*Math.cos(angle)+v[i]*Math.sin(angle));
        const bump=1+.12*Math.sin(3*angle+.80*t)+.066*Math.cos(5*angle-t);
        emit(p.map((x,i)=>x+n[i]*radius*bump),n,wood,1.13);
      }
    }
  }

  function stem(points,radii){
    for(let i=1;i<points.length;i++)limb(points[i-1],points[i],radii[i-1],radii[i]);
  }

  // Irregular lobes are anchored to real branch tips. Smaller lobes inherit
  // the branch direction, so the silhouette remains legible at any angle.
  function foliage(center,radii,yaw,phase){
    const [rx,ry,rz]=radii;
    const sy=Math.sin(yaw),cy=Math.cos(yaw);
    const area=4*Math.PI*((rx*ry)**1.6+(ry*rz)**1.6+(rz*rx)**1.6)**.625/3**.625;
    const count=Math.max(18,Math.ceil(area/(spacing*spacing)*1.39));
    for(let i=0;i<count;i++){
      const py=1-2*(i+.5)/count,a=i*PHYLLOTAXIS+phase;
      const ring=Math.sqrt(1-py*py),px=ring*Math.cos(a),pz=ring*Math.sin(a);
      const wav=.11*Math.sin(3*a+py*4+phase)+.070*Math.cos(5*a-py*7);
      const grain=(noise(phase+px*3.1+py*2.9,pz*4.6)-.5)*.30;
      const skin=1+wav+grain;
      const x=px*rx*skin, z=pz*rz*skin, y=py*ry*skin;
      const normal=unit([px*.74,py,pz*.74]);
      const n=[cy*normal[0]-sy*normal[2],normal[1],sy*normal[0]+cy*normal[2]];
      const fleck=noise(8.7+phase+px*3.1,pz*3.4+py*2.4);
      const lit=py>.27&&fleck>.55;
      emit(place(center,cy*x-sy*z,y,sy*x+cy*z),n,lit&&shape.accent?shape.accent:shape.material,1.12);
    }
  }
  return {limb,stem,foliage};
}

function maple(s,spacing,emit,noise){
  const h=s.height??3.0, spread=s.radius??h*.42;
  const {limb,stem,foliage}=painter(s,spacing,emit,noise);
  const lean=(noise(5,9)-.43)*h*.24;
  const turn=noise(14,3)*TAU;
  const axis=t=>[lean*t*t+.049*h*Math.sin(t*7.1)*t,h*t,.044*h*Math.sin(t*5.4)*t];
  stem([0,.20,.43,.63,.80,.96].map(axis),[.060,.043,.036,.026,.018,.005].map(n=>n*h));
  if(h>spacing*10){
    for(let i=0;i<5;i++){
      const a=turn+i*TAU/5,d=h*(.105+.080*noise(i,17));
      const x=Math.cos(a), z=Math.sin(a);
      stem([axis(.15),[x*d*.56,.040*h,z*d*.57],[x*d,-.032*h,z*d]],[.028*h,.020*h,.008*h]);
    }
  }
  for(let i=0;i<8;i++){
    const t=.42+i*.058;
    const a=turn+i*PHYLLOTAXIS+.28*(noise(i*1.7,3)-.5);
    const x=Math.cos(a),z=Math.sin(a);
    const length=spread*(.74+.33*noise(i,8))*(1-.42*(i/7)**3);
    const foot=axis(t);
    const rise=h*(.135+.063*noise(i,12))*(1-.37*i/7);
    const joint=place(foot,x*length*.56,rise*.62,z*length*.56);
    const tip=place(foot,x*length,rise,z*length);
    stem([foot,joint,tip],[h*(.021-.0014*i),h*.013,h*.004]);
    const crown=spread*(.32+.11*noise(i*2,1));
    foliage(place(tip,0,h*.048,0),[crown,h*(.031+.013*noise(i,2)),crown*.74],a,i*.64);
    if(crown>spacing*4.5){
      for(const side of [-1,1]){
        const az=a+side*(.52+noise(i,side)*.52);
        const edge=place(tip,Math.cos(az)*crown*.61,h*(.050+side*.014),Math.sin(az)*crown*.57);
        foliage(edge,[crown*.44,h*.019,crown*.35],az,i*2.6+side);
      }
    }
    for(const side of [-1,1]){
      const az=a+side*.91,d=length*.44;
      const outer=place(joint,Math.cos(az)*d,rise*(.42+side*.13),Math.sin(az)*d);
      limb(joint,outer,h*.011,h*.003);
      foliage(place(outer,0,h*.038,0),[crown*.67,h*.027,crown*.61],az,i+side);
    }
  }
  foliage(axis(.96),[spread*.37,h*.044,spread*.29],turn,4.7);
}

// A high, spreading canopy with a long clear trunk for rainforest trees.
function broadleaf(s,spacing,emit,noise){
  const h=s.height??4, spread=s.radius??h*.49;
  const {limb,stem,foliage}=painter(s,spacing,emit,noise);
  const lean=(noise(7,4)-.5)*h*.19, turn=noise(12,8)*TAU;
  const axis=t=>[lean*t*t,h*t,.039*h*Math.sin(t*5.2)*t];
  stem([0,.23,.54,.76,.94].map(axis),[.072,.049,.039,.026,.005].map(n=>n*h));

  if(h>spacing*10){
    for(let i=0;i<6;i++){
      const a=turn+i*TAU/6,d=h*(.16+.06*noise(i,22));
      const x=Math.cos(a)*d,z=Math.sin(a)*d;
      stem([axis(.23),[x*.47,h*.070,z*.47],[x,-.011*h,z]],[.033*h,.019*h,.005*h]);
    }
  }

  for(let i=0;i<7;i++){
    const a=turn+i*PHYLLOTAXIS+(noise(i,18)-.5)*.31;
    const t=.56+.045*i;
    const length=spread*(.73+.27*noise(i,3))*(1-.21*(i/6)**2);
    const lift=h*(.120-.009*i+.046*noise(i,7));
    const x=Math.cos(a)*length,z=Math.sin(a)*length;
    const root=axis(t),joint=place(root,x*.42,lift*.46,z*.42),tip=place(root,x,lift,z);
    stem([root,joint,tip],[h*(.022-.0012*i),h*.012,h*.0035]);
    const crown=spread*(.34+.10*noise(i,2));
    foliage(place(tip,0,h*.044,0),[crown,h*.064,crown*.73],a,i+1.3);

    const side=i%2?1:-1, az=a+side*.81;
    const outer=place(joint,Math.cos(az)*length*.46,lift*.48,Math.sin(az)*length*.46);
    limb(joint,outer,h*.010,h*.003);
    foliage(place(outer,0,h*.043,0),[crown*.68,h*.047,crown*.74],az,12+i*.97);
  }

  foliage(axis(.935),[spread*.44,h*.066,spread*.37],turn,7.1);
}

function fir(s,spacing,emit,noise){
  const h=s.height??2.1, spread=s.radius??h*.273;
  const {stem}=painter(s,spacing,emit,noise);
  const bend=(noise(4,18)-.5)*h*.13;
  const axis=t=>[bend*t*t,h*t,h*.027*Math.sin(t*3.3)*t];
  stem([0,.32,.61,.86,1].map(axis),[.040,.034,.022,.012,.001].map(n=>n*h));

  function spray(a,b,width,depth,phase){
    const direction=unit(minus(b,a));
    const vertical=Math.abs(direction[1])>.88;
    const side=unit(cross(direction,vertical?[0,0,1]:[0,1,0]));
    const up=cross(side,direction);
    const count=Math.max(4,Math.ceil(Math.hypot(...minus(b,a))/(spacing*.80)));
    const rings=Math.max(7,Math.ceil(TAU*Math.max(width,depth)/(spacing*1.13)));
    for(let k=0;k<=count;k++){
      const t=k/count;
      const taper=(.30+.70*Math.sin(Math.PI*t)**.61)*(1-t)**.62;
      const p=between(a,b,t);
      p[1]+=(t*t-.83*Math.sin(t*Math.PI))*.018*h;
      const sides=k===count?1:Math.max(4,Math.ceil(rings*Math.max(.26,taper)));
      for(let j=0;j<sides;j++){
        const angle=TAU*(j+(k%2)*.36)/sides;
        const x=Math.cos(angle),y=Math.sin(angle);
        const cut=1+.13*Math.cos(t*23+phase+angle*.8)+.10*(noise(phase+3*x,t*9)-.5);
        const n=unit(side.map((v,i)=>v*x+up[i]*y+direction[i]*(t-.55)*.65));
        const point=p.map((v,i)=>v+taper*cut*(side[i]*x*width+up[i]*y*depth));
        const exposed=vertical?n[1]>.21:n[1]>.62;
        const snow=exposed&&t<.89&&noise(phase+.11*k,angle*.73)>.50;
        emit(point,n,snow&&s.accent?s.accent:s.material,1.24);
      }
    }
  }

  const small=h<spacing*10,levels=small?4:6,arms=small?3:5;
  for(let i=0;i<levels;i++){
    const t=mix(.24,.83,i/(levels-1));
    const turn=i*PHYLLOTAXIS+noise(4*i,12)*.76;
    for(let j=0;j<arms;j++){
      const a=turn+j*TAU/arms+.24*(noise(j*1.23,i+2)-.5);
      const length=spread*(1-.68*i/levels)*(.82+.38*noise(j,i+9));
      const y=t+(noise(j+.2,i*2.6)-.5)*.055;
      const origin=axis(y);
      const c=Math.cos(a),sn=Math.sin(a);
      const joint=place(origin,c*length*.47,-.025*h,sn*length*.47);
      const tip=place(origin,c*length,.021*h,sn*length);
      if(!small&&i<4)stem([origin,joint,between(joint,tip,.42)],[h*.013,h*.007,h*.0015]);
      spray(place(origin,c*length*.14,h*.015,sn*length*.14),tip,length*.48,h*.063,i*4.1+j*.73);
      if(!small&&i<4){
        const side=(i+j)%2?1:-1;
        const reach=(.49+.08*noise(i+1,j))*length;
        const fork=place(joint,Math.cos(a+side*.88)*reach,h*.041,Math.sin(a+side*.88)*reach);
        spray(place(joint,0,.014*h,0),fork,length*.27,h*.027,i+j*.73+13);
      }
    }
  }
  const tipWidth=s.radius===undefined?h*.132:spread*(.132/.273);
  spray(axis(.81),axis(1.004),tipWidth,h*.117,2.25);
}

module.exports={fir,maple,broadleaf};
