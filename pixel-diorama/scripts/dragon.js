'use strict';

const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const scale=(a,t)=>a.map(x=>x*t);
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=([a,b,c],[x,y,z])=>[b*z-c*y,c*x-a*z,a*y-b*x];
const unit=a=>scale(a,1/(Math.hypot(...a)||1));
const curve=(a,b,c,t)=>mix(mix(a,b,t),mix(b,c,t),t);

function spline(points,t){
  const k=Math.min(points.length-2,Math.floor(t));
  const v=t-k;
  const a=points[Math.max(0,k-1)],b=points[k],c=points[k+1],d=points[Math.min(points.length-1,k+2)];
  return b.map((x,i)=>x+.5*v*(c[i]-a[i]+v*(2*a[i]-5*x+4*c[i]-d[i]+v*(3*x-3*c[i]+d[i]-a[i]))));
}

// Sculpt the sampled skin as one field so the shoulder, neck, folded thighs
// and paws share actual surfaces. Anatomy accents follow that surface.
function volume(stride,put,dye,faces){
  const span=[[-1.67,1.17],[-.12,1.92],[-.74,.90]];
  const count=span.map(([lo,hi])=>Math.ceil((hi-lo)/stride)+1);
  const edgeList=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const corner=Array.from({length:8},(_,i)=>[i&1,i>>1&1,i>>2&1]);
  const [nx,ny,nz]=count;
  const index=(x,y,z)=>x+nx*(y+ny*z);
  const coords=(x,y,z)=>[span[0][0]+x*stride,span[1][0]+y*stride,span[2][0]+z*stride];
  const data=new Float32Array(nx*ny*nz);
  for(let z=0;z<nz;z++) for(let y=0;y<ny;y++) for(let x=0;x<nx;x++){
    data[index(x,y,z)]=faces.field(...coords(x,y,z));
  }

  for(let z=0;z<nz-1;z++) for(let y=0;y<ny-1;y++) for(let x=0;x<nx-1;x++){
    const offset=index(x,y,z);
    const density=corner.map(([a,b,c])=>data[offset+index(a,b,c)]);
    if(density.every(v=>v>=0)||density.every(v=>v<0))continue;
    const p=[0,0,0];
    let crossings=0;
    for(const [a,b] of edgeList){
      if((density[a]<0)===(density[b]<0))continue;
      const v=density[a]/(density[a]-density[b]);
      const here=mix(corner[a],corner[b],v);
      for(let c=0;c<3;c++) p[c]+=here[c];
      crossings++;
    }
    const [px,py,pz]=coords(x+p[0]/crossings,y+p[1]/crossings,z+p[2]/crossings);
    const s=stride*.31, f=faces.field;
    const n=unit([f(px+s,py,pz)-f(px-s,py,pz),f(px,py+s,pz)-f(px,py-s,pz),
      f(px,py,pz+s)-f(px,py,pz-s)]);
    put([px,py,pz],n,dye(px,py,pz,n,faces),1.22);
  }
}

function ellipsoid(center,radii,axis=[1,0,0]){
  const side=unit(cross(axis,[0,0,1]));
  const up=unit(cross(side,axis));
  const basis=[axis,side,up].map((v,i)=>scale(v,1/radii[i]));
  const [a,b,c]=basis;
  const [r,s,t]=radii.map(v=>1/v**2);
  const inner=Math.min(...radii);
  const [ox,oy,oz]=center;
  return (x,y,z)=>{
    x-=ox; y-=oy; z-=oz;
    const u=(a[0]*x+a[1]*y+a[2]*z)**2, v=(b[0]*x+b[1]*y+b[2]*z)**2, w=(c[0]*x+c[1]*y+c[2]*z)**2;
    const k=Math.sqrt(u+v+w);
    const grad=Math.sqrt(u*r+v*s+w*t);
    return grad<1e-8?-inner:k*(k-1)/grad;
  };
}

function anatomy(){
  const blend=(a,b,k)=>{
    const bridge=Math.max(0,k-Math.abs(a-b))/k;
    return Math.min(a,b)-.25*k*bridge*bridge;
  };
  const ell=(x,y,z,a,b,c)=>ellipsoid([x,y,z],[a,b,c]);
  const bone=(a,b,span,side,extra=.04)=>{
    const d=sub(b,a);
    return ellipsoid(mix(a,b,.5),[Math.hypot(...d)*.5+extra,span,side],unit(d));
  };

  const solids=[
    ell(.07,.455,0,.69,.297,.30),
    ell(-.36,.49,0,.329,.31,.34),
    ell(.55,.415,-.02,.377,.254,.29),
    bone([-.50,.49,.02],[-.79,.82,.06],.236,.199,.13),
    bone([-.80,.76,.06],[-.80,1.08,.085],.166,.157,.14),
    bone([-.80,1.02,.08],[-.70,1.35,.133],.144,.143,.125),
    bone([-.72,1.31,.13],[-.91,1.50,.17],.143,.132,.09),
    ell(-.94,1.514,.173,.234,.155,.166),
    bone([-1.027,1.512,.18],[-1.406,1.453,.198],.091,.111,.072),
    ell(-1.424,1.439,.197,.116,.072,.096),
    bone([-1.017,1.427,.181],[-1.430,1.382,.197],.058,.085,.046),
    ell(-1.092,1.421,.184,.144,.078,.133)
  ];
  const cuts=[
    bone([-1.15,1.416,.195],[-1.62,1.391,.200],.017,.159,.06)
  ];
  for(const side of [-1,1]){
    const near=side>0;
    const shoulder=[-.401,.486,side*.238], elbow=[-.368,.229,side*(near?.43:.358)];
    const wrist=[near?-.698:-.803,.105,side*(near?.531:.435)];
    const thigh=[.504,.43,side*.198], knee=[.365,.223,side*(near?.479:.421)];
    const heel=[near?.746:.708,.099,side*(near?.57:.457)];
    solids.push(
      bone(shoulder,elbow,.122,.138,.094),
      bone(elbow,wrist,.081,.079,.074),
      ell(wrist[0]-.061,.083,wrist[2],.166,.072,.111),
      bone(thigh,knee,.188,.160,.105),
      bone(knee,heel,.089,.094,.078),
      ell(heel[0]-.061,.076,heel[2],.147,.067,.112),
      ell(-1.05,1.516,.171+side*.106,.159,.089,.084),
      bone([-1.185,1.545,.180+side*.095],[-1.009,1.596,.179+side*.139],.043,.051,.041)
    );
    cuts.push(ell(-1.103,1.546,.173+side*.175,.072,.042,.042));
    cuts.push(ell(-1.413,1.468,.195+side*.093,.042,.024,.020));
  }

  function skin(x,y,z){
    let d=solids[0](x,y,z);
    for(let i=1;i<solids.length;i++) d=blend(d,solids[i](x,y,z),i<7?.103:.060);
    return d;
  }
  function cavities(x,y,z){
    if(x>-1.01||y<1.31||y>1.66)return -1;
    let cut=-1;
    for(const d of cuts) cut=Math.max(cut,-d(x,y,z));
    return cut;
  }
  return {field:(x,y,z)=>Math.max(skin(x,y,z),cavities(x,y,z),-.001-y),cavities};
}

function dragon(shape,spacing,emit,noise){
  const size=shape.radius??1;
  const stride=spacing/size;
  const skin=shape.material, plate=shape.accent??skin, membrane=shape.face??skin;
  const recess=shape.recess??membrane;
  const put=(p,n,material,gain)=>emit(scale(p,size),n,material,gain);
  function tube(profile,material=skin,finish){
    const ref=Math.abs(profile.at(-1)[2]-profile[0][2])>
      Math.abs(profile.at(-1)[0]-profile[0][0])+.35?[1,0,0]:[0,0,1];
    const stepsPerJoint=profile.slice(1).map((p,i)=>Math.max(2,Math.ceil(Math.hypot(...sub(p.slice(0,3),profile[i].slice(0,3)))/stride*1.32)));
    for(let j=0;j<stepsPerJoint.length;j++){
      const steps=stepsPerJoint[j];
      const limit=j===stepsPerJoint.length-1?steps:steps-1;
      for(let i=0;i<=limit;i++){
        const t=j+i/steps;
        const row=spline(profile,t);
        const tangent=unit(sub(spline(profile,Math.min(profile.length-1,t+.02)).slice(0,3),spline(profile,Math.max(0,t-.02)).slice(0,3)));
        const side=unit(sub(ref,scale(tangent,dot(ref,tangent))));
        const up=unit(cross(tangent,side));
        const r=Math.max(.005,row[3]), h=Math.max(.005,row[4]);
        const around=Math.max(5,Math.ceil(Math.PI*2*Math.max(r,h)/stride*1.22));
        for(let k=0;k<around;k++){
          const theta=(k+(i%2)*.46)*Math.PI*2/around;
          const x=Math.cos(theta),y=Math.sin(theta);
          const bump=finish?(noise(k*.67+4,t*9)-.5)*.13:0;
          const p=add(row.slice(0,3),add(scale(side,x*r*(1+bump)),scale(up,y*h*(1+bump))));
          const n=unit(add(scale(side,x/r),scale(up,y/h)));
          put(p,n,finish?.(p,n,t,k)??material,1.22);
        }
      }
    }
  }

  function spur(a,b,c,r,material=plate){
    tube([[...a,r,r*.81],[...b,r*.64,r*.48],[...c,.006,.006]],material);
  }

  const shell=anatomy();
  volume(Math.max(.032,stride*.94),put,(x,y,z,n,faces)=>{
    if(faces.cavities(x,y,z)>-.011) return membrane;
    const throat=x<-.785-.24*(1.32-y)**2&&y>.51&&y<1.46&&n[0]<-.31;
    const belly=y<.285&&x>-.34&&x<.44&&n[1]<-.32&&Math.abs(z)<.27;
    const rib=y*30+4.2*(z-.071)**2+x*8;
    if((throat||belly)&&Math.sin(rib)>.46) return plate;
    const cheek=x<-1.04&&y>1.46&&n[1]>.24&&Math.abs(z-.18)>.093;
    if(cheek&&noise(x*26,y*32+z*22)>.47) return plate;
    return skin;
  },shell);

  const tail=[[.49,.394,-.035,.246,.206],[.86,.276,.027,.185,.155],[1.16,.157,.245,.131,.115],
    [1.46,.076,.510,.107,.093],[1.72,-.091,.714,.080,.069],[1.80,-.33,.90,.057,.053],
    [1.69,-.467,1.105,.043,.039],[1.52,-.411,1.274,.024,.027],[1.44,-.29,1.316,.008,.009]];
  tube(tail,skin,(p,n,t)=>n[1]<-.33&&Math.sin(t*15)>.31?plate:skin);
  const spine=[[-.65,1.34,.132,.071],[-.59,1.11,.101,.081],[-.56,.83,.07,.087],[-.34,.75,.035,.091],
    [-.10,.71,.003,.09],[.15,.677,-.01,.084],[.40,.665,-.016,.080],[.64,.598,-.023,.062]];
  for(const [x,y,z,r] of spine){
    spur([x,y-r*.39,z],[x+.073,y+r*.64,z],[x+.15,y+r*1.23,z+.012],r,plate);
  }
  for(const [x,y,z,r] of tail.slice(1,-2)){
    spur([x,y+r*.84,z],[x+.03,y+r*1.62,z],[x+.13,y+r*1.87,z+.021],r*.37);
  }

  for(const side of [-1,1]){
    const near=side>0;
    for(const [x,z,len] of [[near?-.777:-.880,side*(near?.531:.435),.21],
      [near?.664:.630,side*(near?.57:.457),.14]]){
      for(const toe of [-1,0,1]){
        const q=z+toe*.071;
        const tip=x-len+.037*Math.abs(toe);
        tube([[x+.02,.068,q,.048,.049],[x-.078,.058,q+toe*.016,.040,.037],
          [tip+.04,.041,q+toe*.030,.028,.023]],skin);
        spur([tip+.049,.047,q+toe*.027],[tip,.043,q+toe*.035],[tip-.028,.014,q+toe*.046],.028);
      }
    }
    const z=.173+side*.11;
    tube([[-.905,1.610,z,.077,.071],[-.831,1.719,z+side*.069,.062,.055],
      [-.627,1.808,z+side*.135,.041,.032],[-.505,1.979,z+side*.158,.008,.008]],plate,
      (p,n,t)=>t<.6?skin:plate);
    spur([-.847,1.517,z],[-.741,1.562,z+side*.109],[-.667,1.68,z+side*.171],.046,skin);
    // Project the mouth and nostril onto both cheeks, keeping the groove
    // readable at pixel scale even where the boundary is undersampled.
    function cheekSurface(x,y){
      const origin=.194;
      if(shell.field(x,y,origin)>=0)return null;
      let lo=0,hi=.38;
      for(let i=0;i<12;i++){
        const v=(lo+hi)*.5;
        if(shell.field(x,y,origin+side*v)<0)lo=v;
        else hi=v;
      }
      return origin+side*lo;
    }
    for(let i=0;i<=17;i++){
      const t=i/17,x=-1.501+.391*t,y=1.405+.025*t-.033*Math.sin(Math.PI*t);
      const upper=cheekSurface(x,y+.016);
      const lower=cheekSurface(x,y-.016);
      const edge=side>0?Math.max(upper??.194,lower??.194):Math.min(upper??.194,lower??.194);
      if(upper!==null||lower!==null) put([x,y,edge+side*.006],[-.12,-.07,side*.99],recess,.52+.20*Math.sin(Math.PI*t));
    }
    const nostril=cheekSurface(-1.433,1.471);
    if(nostril!==null) put([-1.433,1.471,nostril+side*.007],[-.31,.25,side*.916],recess,.80);

    const eyeSide=.173+side*.172;
    const eyeNormal=[-.33,.105,side*.94];
    tube([[-1.153,1.550,eyeSide,.016,.013],[-1.105,1.553,eyeSide+side*.010,.028,.021],
      [-1.049,1.566,eyeSide,.012,.009]],recess);
    put([-1.115,1.555,eyeSide+side*.031],eyeNormal,plate,.52);
    put([-1.119,1.553,eyeSide+side*.036],eyeNormal,recess,.26);
  }

  function wing(root,elbow,wrist,tips,flank){
    const fingers=tips.map((tip,i)=>{
      const midpoint=mix(wrist,tip,.48);
      const bend=add(midpoint,[.125,.22-i*.052,(tip[2]-wrist[2])*.16]);
      return t=>curve(wrist,bend,tip,t);
    });
    const leading=t=>curve(wrist,elbow,root,t);
    const inner=t=>curve(wrist,add(mix(wrist,flank,.53),[-.10,.01,-.08]),flank,t);
    const edges=[...fingers,inner,leading];
    for(let i=0;i<edges.length-1;i++){
      const a=edges[i],b=edges[i+1];
      const cells=Math.max(6,Math.ceil(Math.hypot(...sub(a(1),b(1)))/stride*1.24));
      const rows=Math.max(10,Math.ceil(Math.max(Math.hypot(...sub(wrist,a(1))),Math.hypot(...sub(wrist,b(1))))/stride*1.43));
      const joined=i>=fingers.length-1;
      function panel(u,v){
        const bow=Math.sin(Math.PI*u);
        const span=v*(1-bow**.81*(joined?.10:.18+.028*i)*v*v);
        const p=mix(a(span),b(span),u);
        const billow=bow*Math.sin(Math.PI*span*.88);
        p[1]+=.105*billow;
        p[2]+=.072*billow*Math.sign(wrist[2]);
        return p;
      }
      for(let j=1;j<=rows;j++){
        const v=j/rows, columns=Math.max(2,Math.ceil(v*cells));
        for(let k=0;k<=columns;k++){
          const u=k/columns, p=panel(u,v);
          const du=sub(panel(Math.min(1,u+.004),v),panel(Math.max(0,u-.004),v));
          const dv=sub(p,panel(u,v-.004));
          const n=unit(cross(du,dv));
          const pigment=i===fingers.length&&v>.76&&u>.61?skin:membrane;
          put(add(p,scale(n,.011)),n,pigment,1.24);
          put(sub(p,scale(n,.011)),scale(n,-1),membrane,1.16);
        }
      }
    }
    tube([[...root,.126,.102],[...leading(.75),.106,.087],[...leading(.48),.077,.065],
      [...leading(.23),.059,.051],[...wrist,.041,.036]],skin);
    for(const rib of fingers){
      tube([[...wrist,.039,.035],[...rib(.39),.027,.025],[...rib(.73),.018,.016],
        [...rib(.94),.010,.010],[...rib(1),.006,.006]],skin);
    }
    tube([[...root,.15,.099],[...mix(root,flank,.52),.117,.084],[...flank,.08,.052]],skin);
    spur(wrist,add(wrist,[-.10,.106,.014]),add(wrist,[-.169,.078,.024]),.040);
  }

  wing([-.28,.561,-.219],[-.58,1.19,-.54],[-.23,1.67,-.90],[
    [.81,1.80,-1.61],[1.31,1.31,-1.57],[1.20,.91,-1.23],[.94,.61,-.90]],[.54,.49,-.23]);
  wing([-.27,.561,.230],[-.43,1.08,.72],[.04,1.55,.87],[
    [1.58,1.62,1.41],[1.72,1.14,1.44],[1.44,.74,1.30],[1.08,.56,1.06]],[.55,.48,.238]);
}

module.exports={dragon};
