'use strict';

const sceneMotion=(()=>{
  const seconds=8;
  const zero=[0,0,0];
  const point=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  const isZero=v=>v.every(x=>x===0);

  function compile(config,shapes,blockers=[]){
    if(!Array.isArray(config?.groups)||!config.groups.length) throw new Error('Motion needs at least one group');
    const ids=new Map();
    const groups=config.groups.map(group=>{
      if(!group||typeof group.id!=='string'||!group.id.trim()||ids.has(group.id)||!point(group.pivot))
        throw new Error('Each motion group needs a unique ID and an XYZ pivot');
      const parent=group.parent===undefined?-1:ids.get(group.parent);
      if(parent===undefined) throw new Error('Put the parent before motion group '+group.id);
      if(!Array.isArray(group.keys)||group.keys.length<2||group.keys[0]?.at!==0||group.keys.at(-1)?.at!==seconds)
        throw new Error('Motion '+group.id+' needs keys from 0 to '+seconds+' seconds');
      const keys=group.keys.map((key,i)=>{
        const rotation=key?.rotation??zero, shift=key?.shift??zero;
        if(!Number.isFinite(key?.at)||(i>0&&key.at<=group.keys[i-1].at)||!point(rotation)||!point(shift))
          throw new Error('Invalid motion key for '+group.id);
        if((i===0||i===group.keys.length-1)&&(!isZero(rotation)||!isZero(shift)))
          throw new Error('Motion '+group.id+' must begin and end in the rest pose');
        return [key.at,rotation,shift];
      });
      ids.set(group.id,ids.size);
      return {pivot:group.pivot,parent,keys,range:[0,0]};
    });
    let bound=0;
    for(const s of shapes){
      if(s.motion===undefined) continue;
      if(!ids.has(s.motion)) throw new Error('Unknown motion group on '+s.id);
      if(blockers.includes(s.id)) throw new Error('Moving shapes cannot be walk blockers: '+s.id);
      bound++;
    }
    if(!bound) throw new Error('Assign at least one shape to a motion group');
    return {ids,groups};
  }

  function matrices(groups,time){
    const poses=[];
    for(const {keys,pivot,parent} of groups){
      const end=keys.findIndex(key=>key[0]>time);
      const a=keys[end-1], b=keys[end];
      const step=(time-a[0])/(b[0]-a[0]);
      const t=step*step*(3-2*step);
      const mix=(x,y)=>x.map((v,i)=>v+(y[i]-v)*t);
      const [x,y,z]=mix(a[1],b[1]);
      const [sx,sy,sz]=[Math.sin(x),Math.sin(y),Math.sin(z)];
      const [cx,cy,cz]=[Math.cos(x),Math.cos(y),Math.cos(z)];
      const rotation=[
        [cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],
        [sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],
        [-sy,cy*sx,cy*cx],
      ];
      const shift=mix(a[2],b[2]);
      const offset=rotation.map((r,i)=>pivot[i]+shift[i]-dot(r,pivot));
      poses.push(parent<0?{rotation,offset}:compose(poses[parent],rotation,offset));
    }
    return poses;
  }

  function dot([a,b,c],[x,y,z]){return a*x+b*y+c*z;}

  function compose(parent,rotation,offset){
    const columns=rotation[0].map((_,j)=>rotation.map(row=>row[j]));
    return {
      rotation:parent.rotation.map(row=>columns.map(column=>dot(row,column))),
      offset:parent.rotation.map((row,j)=>dot(row,offset)+parent.offset[j]),
    };
  }

  function apply(groups,time,rest,output){
    if(!groups) return;
    const phase=((time%seconds)+seconds)%seconds;
    const poses=matrices(groups,phase);
    for(let g=0;g<groups.length;g++){
      const {rotation,offset}=poses[g];
      const [[a,b,c],[d,e,f],[h,i,j]]=rotation;
      const [start,end]=groups[g].range;
      for(let q=start*12;q<end*12;q+=12){
        const x=rest[q],y=rest[q+1],z=rest[q+2];
        output[q]=a*x+b*y+c*z+offset[0];
        output[q+1]=d*x+e*y+f*z+offset[1];
        output[q+2]=h*x+i*y+j*z+offset[2];

        // Rotate the symmetric covariance tensor along with each sample: R C Rᵀ.
        const xx=rest[q+4],xy=rest[q+5],xz=rest[q+6];
        const yy=rest[q+8],yz=rest[q+9],zz=rest[q+10];
        const ax=a*xx+b*xy+c*xz, ay=a*xy+b*yy+c*yz, az=a*xz+b*yz+c*zz;
        const bx=d*xx+e*xy+f*xz, by=d*xy+e*yy+f*yz, bz=d*xz+e*yz+f*zz;
        const cx=h*xx+i*xy+j*xz, cy=h*xy+i*yy+j*yz, cz=h*xz+i*yz+j*zz;
        output[q+4]=ax*a+ay*b+az*c;
        output[q+5]=ax*d+ay*e+az*f;
        output[q+6]=ax*h+ay*i+az*j;
        output[q+8]=bx*d+by*e+bz*f;
        output[q+9]=bx*h+by*i+bz*j;
        output[q+10]=cx*h+cy*i+cz*j;
      }
    }
  }

  return {compile,apply};
})();
if(typeof module==='object')module.exports=sceneMotion;
