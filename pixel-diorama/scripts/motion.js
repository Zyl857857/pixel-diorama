'use strict';

const sceneMotion=(()=>{
  const seconds=8;
  const zero=[0,0,0], unit=[1,1,1];
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
      const sampled=group.sampled===true;
      const keys=group.keys.map((key,i)=>{
        const rotation=key?.rotation??zero, shift=key?.shift??zero;
        if(!Number.isFinite(key?.at)||(i>0&&key.at<=group.keys[i-1].at)||!point(rotation)||!point(shift))
          throw new Error('Invalid motion key for '+group.id);
        const scale=key.scale??unit, opacity=key.opacity??1;
        if(!point(scale)||scale.some(value=>value<=0)||!Number.isFinite(opacity)||opacity<0||opacity>1)
          throw new Error('Invalid scale or opacity for '+group.id);
        if(sampled&&Math.abs(key.at-i*seconds/(group.keys.length-1))>1e-7)
          throw new Error('Sampled motion keys must be evenly spaced');
        if(!sampled&&(i===0||i===group.keys.length-1)&&
          (!isZero(rotation)||!isZero(shift)||scale.some(value=>value!==1)||opacity!==1))
          throw new Error('Motion '+group.id+' must begin and end in the rest pose');
        return key.scale===undefined&&key.opacity===undefined
          ? [key.at,rotation,shift]
          : [key.at,rotation,shift,scale,opacity];
      });
      if(sampled){
        const first=keys[0], last=keys.at(-1);
        const pose=key=>[...key[1],...key[2],...(key[3]??unit),key[4]??1];
        const finalPose=pose(last);
        if(pose(first).some((value,i)=>value!==finalPose[i]))
          throw new Error('Sampled motion '+group.id+' needs matching first and last poses');
      }
      ids.set(group.id,ids.size);
      return {pivot:group.pivot,parent,keys,range:[0,0],...(sampled?{sampled:true}:{})};
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
    for(const {keys,pivot,parent,sampled} of groups){
      const end=sampled?Math.min(keys.length-1,Math.floor(time*(keys.length-1)/seconds)+1):keys.findIndex(key=>key[0]>time);
      const a=keys[end-1], b=keys[end];
      const step=(time-a[0])/(b[0]-a[0]);
      const t=sampled?step:step*step*(3-2*step);
      const mix=(x,y)=>x.map((v,i)=>v+(y[i]-v)*t);
      const [x,y,z]=mix(a[1],b[1]);
      const [sx,sy,sz]=[Math.sin(x),Math.sin(y),Math.sin(z)];
      const [cx,cy,cz]=[Math.cos(x),Math.cos(y),Math.cos(z)];
      const rotation=[
        [cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],
        [sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],
        [-sy,cy*sx,cy*cx],
      ];
      if(a[3]||b[3]){
        const scale=mix(a[3]??unit,b[3]??unit);
        for(const row of rotation) for(let i=0;i<3;i++) row[i]*=scale[i];
      }
      const startOpacity=a[4]??1, endOpacity=b[4]??1;
      const opacity=startOpacity+(endOpacity-startOpacity)*t;
      const shift=mix(a[2],b[2]);
      const offset=rotation.map((r,i)=>pivot[i]+shift[i]-dot(r,pivot));
      poses.push(parent<0?{rotation,offset,opacity}:compose(poses[parent],rotation,offset,opacity));
    }
    return poses;
  }

  function dot([a,b,c],[x,y,z]){return a*x+b*y+c*z;}

  function compose(parent,rotation,offset,opacity){
    const columns=rotation[0].map((_,j)=>rotation.map(row=>row[j]));
    return {
      opacity:parent.opacity*opacity,
      rotation:parent.rotation.map(row=>columns.map(column=>dot(row,column))),
      offset:parent.rotation.map((row,j)=>dot(row,offset)+parent.offset[j]),
    };
  }

  function apply(groups,time,rest,output){
    if(!groups) return;
    const phase=((time%seconds)+seconds)%seconds;
    const poses=matrices(groups,phase);
    for(let g=0;g<groups.length;g++){
      const {rotation,offset,opacity}=poses[g];
      const [[a,b,c],[d,e,f],[h,i,j]]=rotation;
      const [start,end]=groups[g].range;
      for(let q=start*12;q<end*12;q+=12){
        const x=rest[q],y=rest[q+1],z=rest[q+2];
        output[q+3]=rest[q+3]*opacity;
        output[q]=a*x+b*y+c*z+offset[0];
        output[q+1]=d*x+e*y+f*z+offset[1];
        output[q+2]=h*x+i*y+j*z+offset[2];

        // Transform each sample’s symmetric covariance along with its position: A C Aᵀ.
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
