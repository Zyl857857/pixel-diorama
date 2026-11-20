'use strict';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{ const k=clamp(x); return k*k*(3-2*k); };

function createVolcano({center,radius,channels,lake,mountainHeight},seed,noise) {
  const [cx,cz]=center;
  const [rx,rz]=radius;
  function sample(x,z) {
    const dx=(x-cx)/rx, dz=(z-cz)/rz, angle=Math.atan2(dz,dx);
    const ridges=.043*Math.cos(angle*5+.69)+.032*Math.cos(angle*9-1.45)+.026*Math.sin(angle*14+.4);
    const rough=noise(seed+180,x*3.2,z*3.2)-.5;
    const q=Math.hypot(dx,dz)/(1+ridges);
    let channel=9, trail=0, priority=0;
    for (let f=0;f<channels.length;f++) {
      const path=channels[f];
      for (let i=1;i<path.length;i++) {
        const [ax,az,aWidth]=path[i-1], [bx,bz,bWidth]=path[i];
        const vx=bx-ax,vz=bz-az;
        const t=clamp(((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz));
        const width=mix(aWidth,bWidth,t);
        const norm=Math.hypot(x-mix(ax,bx,t),z-mix(az,bz,t)) / width;
        if (norm<channel) {
          channel=norm;
          trail=i-1+t;
          priority=f;
        }
      }
    }
    const [lx,lz,lrx,lrz]=lake;
    const lakeX=(x-lx)/lrx,lakeZ=(z-lz)/lrz;
    const a=Math.atan2(lakeZ,lakeX);
    const shore=Math.hypot(lakeX,lakeZ) - (.93+.085*Math.sin(a*3+.4)+.097*Math.cos(a*7)+.10*rough);
    const core=(q+.028*rough)/.214;
    const lava=Math.min(channel*.80+.095*rough,shore+1,core);
    return {q, angle,rough,channel,trail,priority,shore,core,lava};
  }
  function surface(x,z) {
    const s=sample(x,z);
    const fall=clamp(1-s.q);
    const bowl=2.53*Math.exp(-((s.q/.234)**4));
    const crown=.41*Math.exp(-(((s.q-.326)/.062)**2));
    const ridges=(.25*Math.sin(s.angle*7+10*s.q)+.21*Math.cos(s.angle*13-3*s.q))
      *smooth((s.q-.213)/.24)*smooth((1.08-s.q)/.30);
    const stones=(noise(seed+126,x*1.7,z*1.8)-.5)*.33+s.rough*.20;
    let y=mountainHeight*fall**1.24-bowl+crown+ridges+stones*smooth((1.43-s.q)/.40);
    const notch=s.priority===0 ? (.22+.89*Math.exp(-(((s.q-.33)/.142)**2))) : .21;
    y-=notch*(1-smooth((s.channel-.29)/1.41));
    y=mix(y,-.12+(.072*noise(seed+71,x*2,z*2)), .82*(1-smooth((s.shore+.17)/.37)));
    return y;
  }
  function pigment(s,x,z) {
    const coarse=noise(seed+94,x*2.7+z*.19,z*2.9);
    const fine=noise(seed+201,x*11.2,z*9.1);
    const crust= .51*coarse+.31*fine+.18*Math.sin(x*20.1-z*8.5);
    const intensity=clamp(.80-.38*s.lava+.38*crust + (s.core<.69 ? .13 : 0));
    return clamp(Math.floor(intensity*7),1,6);
  }
  return {sample,surface,pigment};
}
module.exports={createVolcano};
