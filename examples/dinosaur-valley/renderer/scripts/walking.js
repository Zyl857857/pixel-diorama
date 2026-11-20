'use strict';

const walking = (() => {
  const blocked = -32768;

  function ground(map,x,z) {
    const u=(x-map.x)/map.cell,v=(z-map.z)/map.cell;
    const i=Math.floor(u),j=Math.floor(v),w=map.width;
    if(i<0||j<0||i+1>=w||j+1>=map.height)return null;
    const start=j*w+i;
    const a=map.heights[start],b=map.heights[start+1],c=map.heights[start+w],d=map.heights[start+w+1];
    if(a===blocked||b===blocked||c===blocked||d===blocked)return null;
    const fx=u-i,fz=v-j;
    return ((a+(b-a)*fx)*(1-fz)+(c+(d-c)*fx)*fz)*.01;
  }

  function bake(spec,radius,inside,height,water,shapes) {
    if(!spec||!Array.isArray(spec.spawn)||spec.spawn.length!==2||!spec.spawn.every(Number.isFinite)) {
      throw new Error('Set walk.spawn to a dry, clear [x,z] point');
    }
    if(spec.facing!==undefined&&!Number.isFinite(spec.facing))throw new Error('walk.facing must be in radians');
    if(spec.showAvatar!==undefined&&typeof spec.showAvatar!=='boolean')throw new Error('walk.showAvatar must be boolean');
    if(spec.surfaces!==undefined&&!Array.isArray(spec.surfaces))throw new Error('walk.surfaces needs an array of box IDs');
    if(spec.blockers!==undefined&&!Array.isArray(spec.blockers)) throw new Error('walk.blockers needs an array of shape IDs');
    if(spec.hazards!==undefined&&!Array.isArray(spec.hazards)) throw new Error('walk.hazards needs a list of [x,z,radius] circles');
    const cell=.12, x=-radius[0]-.35,z=-radius[1]-.35;
    const width=Math.ceil(-2*x/cell)+1, rows=Math.ceil(-2*z/cell)+1;
    const blockers=(spec.blockers??[]).map(id=>{
      const s=shapes.find(shape=>shape.id===id);
      if(!s)throw new Error('Unknown walk blocker '+id);
      const [cx,,cz]=s.at;
      const cos=Math.cos(s.yaw??0),sin=Math.sin(s.yaw??0);
      const [w,,d]=s.size??[.6,.45,.5];
      const defaultRadius={cylinder:.5,cone:.5,dome:1,dish:.55};
      let r=s.kind==='fir'?.18*(s.height??2.1):s.radius??defaultRadius[s.kind];
      if(s.kind==='cylinder'||s.kind==='cone')r=Math.max(r,s.topRadius??0);
      if(s.kind==='beam'){
        const dx=s.to[0]-cx,dy=s.to[1]-s.at[1],dz=s.to[2]-cz;
        const end=dy*Math.sin(s.tilt??0)+dz*Math.cos(s.tilt??0);
        const ux=dx*cos+end*sin,uz=-dx*sin+end*cos;
        return (x,z)=>{
          const u=x-cx,v=z-cz;
          const t=Math.max(0,Math.min(1,(u*ux+v*uz)/(ux*ux+uz*uz||1)));
          return Math.hypot(u-ux*t,v-uz*t)<=(s.radius??.075)+.15;
        };
      }
      return (x,z)=>{
        const dx=x-cx,dz=z-cz;
        return r?Math.hypot(dx,dz)<=r+.15:
          Math.abs(dx*cos-dz*sin)<w*.5+.15&&Math.abs(dx*sin+dz*cos)<d*.5+.15;
      };
    });
    for(const h of spec.hazards??[]){
      if(!Array.isArray(h)||h.length!==3||!h.every(Number.isFinite)||h[2]<=0)throw new Error('Invalid walk hazard circle');
      blockers.push((x,z)=>Math.hypot(x-h[0],z-h[1])<=h[2]+.15);
    }
    const surfaces=(spec.surfaces??[]).map(id=>{
      const shape=shapes.find(candidate=>candidate.id===id);
      if(shape?.kind!=='box'||shape.motion!==undefined||shape.tilt||!shape.size)
        throw new Error('Walk surface '+id+' must be a static, horizontal box with a size');
      if((spec.blockers??[]).includes(id))throw new Error('Walk surface '+id+' cannot also be a blocker');
      const [cx,y,cz]=shape.at, [w,h,d]=shape.size;
      const top=y+h*.5, cos=Math.cos(shape.yaw??0), sin=Math.sin(shape.yaw??0);
      return (x,z,base)=>{
        const dx=x-cx,dz=z-cz;
        const gapX=Math.max(0,Math.abs(dx*cos-dz*sin)-w*.5);
        const gapZ=Math.max(0,Math.abs(dx*sin+dz*cos)-d*.5);
        const t=Math.min(1,Math.hypot(gapX,gapZ)/.23);
        return base+Math.max(0,top-base)*(1-t*t*(3-2*t));
      };
    });
    function walkHeight(x,z){
      const base=height(x,z);
      return surfaces.reduce((top,surface)=>Math.max(top,surface(x,z,base)),base);
    }
    const offsets=[[0,0],[.15,0],[-.15,0],[0,.15],[0,-.15]];
    const heights=[];
    for(let j=0;j<rows;j++)for(let i=0;i<width;i++){
      const px=x+i*cell,pz=z+j*cell;
      const walkable=offsets.every(([dx,dz])=>{
        const a=px+dx,b=pz+dz;
        return inside(a,b)<0&&water(a,b)>0;
      })&&!blockers.some(hits=>hits(px,pz));
      heights.push(walkable?Math.round(100*walkHeight(px,pz)):blocked);
    }
    const map={x,z,cell,width,height:rows,heights,spawn:spec.spawn,facing:spec.facing??-.30,showAvatar:spec.showAvatar??false};
    if(ground(map,...map.spawn)===null)throw new Error('Walk spawn is outside the clear land; move walk.spawn');
    return map;
  }

  function spawn(map) {
    const [x,z]=map.spawn;
    return {x,y:ground(map,x,z),z,travel:0,facing:map.facing,moving:false,gait:0};
  }

  function step(map,hero,horizontal,vertical,yaw,dt) {
    hero.moving=false;
    hero.gait*=Math.exp(-14*dt);
    if(!horizontal&&!vertical)return;
    const strength=Math.hypot(horizontal,vertical);
    const distance=Math.min(dt,.06)*1.65/strength;
    const dx=(horizontal*Math.cos(yaw)-vertical*Math.sin(yaw))*distance;
    const dz=(-horizontal*Math.sin(yaw)-vertical*Math.cos(yaw))*distance;
    const oldX=hero.x,oldZ=hero.z;
    function tryStep(x,z){
      const y=ground(map,x,z);
      const run=Math.hypot(x-hero.x,z-hero.z);
      if(y===null||Math.abs(y-hero.y)>.018+1.04*run)return false;
      Object.assign(hero,{x,y,z});
      return true;
    }
    if(!tryStep(hero.x+dx,hero.z+dz)){
      tryStep(hero.x+dx,hero.z);
      tryStep(hero.x,hero.z+dz);
    }
    const moved=Math.hypot(hero.x-oldX,hero.z-oldZ);
    hero.travel+=moved;
    hero.moving=moved>.0001;
    if(hero.moving){
      hero.gait+=(1-hero.gait)*Math.min(1,dt*26);
      const heading=Math.atan2(hero.x-oldX,hero.z-oldZ);
      const angle=heading-hero.facing;
      hero.facing+=Math.atan2(Math.sin(angle),Math.cos(angle))*Math.min(1,dt*18);
    }
  }

  return {bake,ground,spawn,step};
})();
if(typeof module!=='undefined')module.exports=walking;
