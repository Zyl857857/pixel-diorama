'use strict';

const sceneFluid=require('./fluid');
const sceneMotion=require('./motion');

const { deflateSync } = require('node:zlib');

const CRC = Uint32Array.from({length:256},(_,i)=>{
  for(let k=0;k<8;k++) i=(i>>>1)^((i&1)?0xedb88320:0);
  return i;
});

function png(width, height, rgb) {
  function chunk(type,data) {
    const out=Buffer.alloc(data.length+12);
    out.writeUInt32BE(data.length);
    out.write(type,4);
    data.copy(out,8);
    let crc=0xffffffff;
    for(let i=4;i<8+data.length;i++) crc=(crc>>>8)^CRC[(crc^out[i])&255];
    out.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);
    return out;
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
  const rows=Buffer.alloc(height*(width*3+1));
  for(let y=0;y<height;y++) rgb.copy(rows,y*(width*3+1)+1,y*width*3,(y+1)*width*3);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}

const rgbOf = p => [p >> 16 & 255, p >> 8 & 255, p & 255];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const clamp = value => Math.max(0,Math.min(1,value));

const smoothGate=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

const FRAME_WIDTH = 384;
const FRAME_HEIGHT = 288;

function renderPreview({meta,rows}, angle=0, width=FRAME_WIDTH, height=FRAME_HEIGHT, time=0) {
  if(meta.fluid){
    rows=rows.slice();
    sceneFluid.apply(meta.fluid,sceneFluid.prepare(meta.fluid),time,rows);
    const groups=meta.fluid.filter(flow=>flow.group!==undefined).map(flow=>({
      ...meta.motion.groups[flow.group],range:[flow.first,flow.first+flow.count+flow.splash]
    }));
    if(groups.length) sceneMotion.apply(groups,time,rows.slice(),rows);
  }
  const camera=meta.camera;
  const yaw=camera.yaw+angle, pitch=camera.pitch;
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  const eye=[cp*sy,sp,cp*cy];
  const r=[cy,0,-sy], u=[-sy*sp,cp,-cy*sp];
  const scale=height/(2*camera.dist*Math.tan(19*Math.PI/180));
  const order=Uint32Array.from({length:meta.count},(_,i)=>i);
  const depth=Float32Array.from(order,i=>eye[0]*rows[i*12]+eye[1]*rows[i*12+1]+eye[2]*rows[i*12+2]);
  order.sort((a,b)=>depth[a]-depth[b]);
  const image=new Float32Array(width*height*3);
  const background=rgbOf(meta.background);
  for(let i=0;i<image.length;i+=3) image.set(background,i);
  const water=meta.water;
  const phase=(time%8)*Math.PI/4;
  const hits=(meta.fluid??[]).filter(({at,delta,falls})=>falls&&water&&Math.abs(at[1]+delta[1]-water.level)<.12).slice(0,6);
  const waterA=water&&rgbOf(water.dark), waterB=water&&rgbOf(water.light);
  for(const i of order) {
    const j=i*12;
    const p=[rows[j]-camera.target[0],rows[j+1]-camera.target[1],rows[j+2]-camera.target[2]];
    const [a,b,c,ink,d,e,f,type]=rows.subarray(j+4,j+12);
    if(type>=5&&type<6){
      const t=type-5,envelope=smoothGate(0,.22,t)*(1-smoothGate(.83,1,t));
      const pulse=phase*12-t*2*Math.PI;
      const crossflow=rows[j]*13+rows[j+2]*9;
      p[0]+=envelope*.041*Math.sin(2*pulse+crossflow);
      p[1]+=envelope*.014*Math.sin(pulse-crossflow);
      p[2]+=envelope*(.046*Math.cos(pulse+crossflow)+.023*Math.cos(2*pulse-crossflow));
    }
    const cx=dot(r,p)*scale+width*.5, cy=height*.5-dot(u,p)*scale;
    const apply=([x,y,z])=>[a*x+b*y+c*z,b*x+d*y+e*z,c*x+e*y+f*z];
    const xcov=apply(r), ycov=apply(u), q=scale*scale;
    const xx=Math.max(.14,q*dot(r,xcov)+.14);
    const yy=Math.max(.14,q*dot(u,ycov)+.14);
    const xy=-q*dot(u,xcov);
    const det=Math.max(.0001,xx*yy-xy*xy);
    const ixx=yy/det, iyy=xx/det, ixy=-xy/det;
    const edgeX=2.8*Math.sqrt(xx), edgeY=2.8*Math.sqrt(yy);
    const dark=rows[j+3];
    let color=[ink&255,ink>>8&255,ink>>16&255];
    if(type===1) {
      const d1=Math.hypot(rows[j]-water.rippleA[0],rows[j+2]-water.rippleA[1]);
      const d2=Math.hypot(rows[j]-water.rippleB[0],rows[j+2]-water.rippleB[1]);
      const wave=Math.cos(d1*13.4-phase*4)*Math.exp(-2.5*d1*d1);
      const second=Math.cos(d2*11.2-phase*3)*Math.exp(-1.7*d2*d2);
      let wash=0;
      for(const {at,delta,reach} of hits){
        const x=rows[j]-at[0]-delta[0],z=rows[j+2]-at[2]-delta[2];
        const r=Math.hypot(x,z)/(reach*1.55);
        const crest=Math.cos(r*21-phase*7+.7*Math.sin(5*x+3*z));
        wash+=smoothGate(.24,.93,crest)*Math.exp(-1.7*r*r)*smoothGate(.05,.27,r);
      }
      const shade=.45+Math.min(.32,wash*.31)+.10*wave+.075*second+.09*Math.sin(rows[j]*1.7+rows[j+2]*2.1);
      color=waterA.map((v,i)=>v+(waterB[i]-v)*shade);
    }
    if(type>=5) {
      const travel=type-Math.floor(type);
      const across=rows[j]*14+rows[j+2]*9;
      const runs=phase*(type<6?12:6)-travel*Math.PI*2;
      const veer=Math.sin(across*.29+runs);
      const churn=.55*Math.sin(across+runs+veer)+.29*Math.sin(across*.43+2*runs)+.16*Math.cos(across*1.92+2*runs);
      const gleam=smoothGate(.25,.82,churn);
      color=color.map(v=>v*(.76+gleam*.51));
    }
    for(let y=Math.max(0,Math.floor(cy-edgeY)); y<=Math.min(height-1,Math.ceil(cy+edgeY)); y++) {
      const dy=y+.5-cy;
      for(let x=Math.max(0,Math.floor(cx-edgeX)); x<=Math.min(width-1,Math.ceil(cx+edgeX)); x++) {
        const dx=x+.5-cx;
        const power=ixx*dx*dx+iyy*dy*dy+2*ixy*dx*dy;
        if(power>8.5)continue;
        const w=dark*Math.exp(-.5*power);
        const v=clamp((w-.38)/(.62-.38));
        const opacity=type===1?Math.min(.9,w*1.28):type===3?Math.min(.94,w):.99*v*v*(3-2*v)*(type>=5&&type<6?.77:1);
        if(opacity<.008)continue;
        const o=(y*width+x)*3;
        for(let k=0;k<3;k++)image[o+k]+=(color[k]-image[o+k])*opacity;
      }
    }
  }
  const palette=meta.palette.map(rgbOf);
  const bytes=Buffer.alloc(image.length);
  for(let i=0;i<image.length;i+=3) {
    let min=196000,best=background;
    for(const p of palette) {
      const d=(image[i]-p[0])**2+(image[i+1]-p[1])**2*1.12+(image[i+2]-p[2])**2*.90;
      if(d<min) { min=d;best=p; }
    }
    for(let k=0;k<3;k++)bytes[i+k]=Math.round(best[k]*.88+image[i+k]*.12);
  }
  return png(width,height,bytes);
}
module.exports = {renderPreview, FRAME_WIDTH, FRAME_HEIGHT};
