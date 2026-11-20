'use strict';

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

const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 360;

function renderPreview({meta,rows}, angle=0, width=FRAME_WIDTH, height=FRAME_HEIGHT, time=0) {
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
  const phase=time/8*2*Math.PI;
  const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const waterA=water&&rgbOf(water.dark), waterB=water&&rgbOf(water.light);
  for(const i of order) {
    const j=i*12;
    const p=[rows[j]-camera.target[0],rows[j+1]-camera.target[1],rows[j+2]-camera.target[2]];
    const cx=dot(r,p)*scale+width*.5, cy=height*.5-dot(u,p)*scale;
    const [a,b,c,ink,d,e,f,type]=rows.subarray(j+4,j+12);
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
      const x=rows[j],z=rows[j+2], d1=Math.hypot((x-water.rippleA[0])*1.14,(z-water.rippleA[1])*.83);
      const pulse=Math.sin(d1*21-phase*5)*Math.exp(-3.4*d1*d1);
      const lane=x+.12*Math.sin(z*2);
      const riffle=smooth(.79,.99,Math.sin(z*16.5-phase*7+Math.sin(lane*18)*2));
      const gap=smooth(.14,.95,Math.sin(lane*29+Math.sin(z*2.5-phase*2)*2.5));
      const boil=Math.exp(-5.2*d1*d1)*smooth(.12,.82,pulse);
      const lip=water.drink?Math.hypot(x-water.drink[0],z-water.drink[1]):10;
      let lap=0;
      for(const start of [3.45,4.13]){
        const age=time-start;
        if(age>0&&age<.94)lap+=Math.exp(-((lip-.72*age)**2)*1450)*(1-age/.94)**.85;
      }
      const shade=.33+.12*Math.sin(x*5+z*4)+pulse*.12;
      color=waterA.map((v,i)=>lerp(lerp(lerp(v,waterB[i],shade),color[i],.31),waterB[i],riffle*gap*.38+boil*.40+lap*.40));
    }
    if(type===5||type===6) {
      const y=rows[j+1], lane=Math.floor(rows[j]*30), top=type===6?1.45:3.20;
      const fall=Math.sqrt(Math.max(.004,top-y));
      const runner=smooth(.28,.99,Math.sin(phase*10-fall*28+lane*2.39));
      const flicker=smooth(-.31,.95,Math.sin(lane*1.77+y*2.60));
      color=color.map((v,i)=>lerp(v*.72,[196,232,222][i],.14+runner*flicker*.53));
    }
    for(let y=Math.max(0,Math.floor(cy-edgeY)); y<=Math.min(height-1,Math.ceil(cy+edgeY)); y++) {
      const dy=y+.5-cy;
      for(let x=Math.max(0,Math.floor(cx-edgeX)); x<=Math.min(width-1,Math.ceil(cx+edgeX)); x++) {
        const dx=x+.5-cx;
        const power=ixx*dx*dx+iyy*dy*dy+2*ixy*dx*dy;
        if(power>8.5)continue;
        const w=dark*Math.exp(-.5*power);
        const v=clamp((w-.38)/(.62-.38));
        const opacity=type===1?Math.min(.91,w*1.25):type>=5?.92*v*v*(3-2*v):dark<1?Math.min(.94,w):.99*v*v*(3-2*v);
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
