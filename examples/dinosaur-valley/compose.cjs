'use strict';
const fs = require('node:fs');

const shapes = [], groups = [];
let seed = 21941;
const random = () => {
  seed = (Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/4294967296;
};
const ramp = (rgb, settings={}) => ({ramp:rgb.split(' ').map(s=>'#'+s),...settings});
const add = (id,kind,at,material,options={}) => shapes.push({id,kind,at,material,...options});
const rock = (id,p,size,m,opts={}) => add(id,'rock',p,m,{size,...opts});
const box = (id,p,size,m,opts={}) => add(id,'box',p,m,{size,...opts});
const beam = (id,p,to,r,m,opts={}) => add(id,'beam',p,m,{to,radius:r,...opts});
const cone = (id,p,r,h,top,m,opts={}) => add(id,'cone',p,m,{radius:r,height:h,topRadius:top,...opts});
const tube = (id,path,m,opts={}) => add(id,'tube',[0,0,0],m,{path,spacing:.065,...opts});
const point = (origin,yaw) => ([x,y,z]) => [
  origin[0]+Math.cos(yaw)*x-Math.sin(yaw)*z,origin[1]+y,
  origin[2]+Math.sin(yaw)*x+Math.cos(yaw)*z
];
function subject(label,origin,yaw) {
  const p=point(origin,yaw);
  return {
    p,
    rock:(id,at,size,m,opts={})=>rock(label+'-'+id,p(at),size,m,{yaw:-yaw,spacing:.052,...opts}),
    beam:(id,at,to,r,m,opts={})=>beam(label+'-'+id,p(at),p(to),r,m,{spacing:.049,...opts}),
    tube:(id,path,m,opts={})=>tube(label+'-'+id,path.map(([x,y,z,a,b])=>[...p([x,y,z]),a,b]),m,opts)
  };
}
const recipe = {
  title:'侏罗纪 · 浅滩饮水', locale:'zh-CN', seed:82104, spacing:.090, background:'#091b21',
  sun:[-.78,1,.73], camera:{target:[-.56,1.29,.02],dist:15.5,yaw:.31,pitch:.45},
  terrain:{radius:[6.15,4.45],height:.34,depth:.76,roughness:.135,edge:.104,
    surface:'moss',cliff:'shale',capCliff:'earth',hills:[
      [-4.1,-2.3,.29,2.3,1.9],[3.65,-1.75,.27,2.4,1.4],[-1.68,-3.0,.48,1.5,1.25],
      [3.2,1.66,.12,1.4,1.4],[-3.9,2.5,.16,1.8,1.15]
    ]},
  water:{river:true,center:[.87,0],radius:[1,4.6],level:.065,baseLevel:.065,shore:'earth',floor:'shale',
    dark:'#10394a',light:'#75b6ab',reflection:.30,rippleA:[.53,-2.18],rippleB:[.46,.96],drink:[.34,1.23]},
  materials:{
    shale:ramp('122831 293e44 41545a 647278 898878',{texture:.55,pattern:'strata'}),
    earth:ramp('34362e 5b5942 827855 aa9a72 c0aa7c',{texture:.36,pattern:'strata'}),
    moss:ramp('233934 355240 536b44 75854a 9ea05b',{texture:.50}),
    leaf:ramp('183e38 2a5e47 4b8052 72a258 a7bc63',{texture:.38}),
    wood:ramp('272f2e 463e33 645341 827855',{texture:.32,pattern:'planks'}),
    hide:ramp('292e28 4f4532 765838 a17145 c68d54',{texture:.45}),
    stripe:ramp('222d2d 3b4030 60533a 796543 997245',{texture:.35}),
    belly:ramp('524936 827055 a8936e c6b589',{texture:.43}),
    plate:ramp('463733 794e42 a1624b ba7852 d9aa6b',{texture:.38}),
    ink:ramp('182829 222d2d',{texture:.20}),
    ivory:ramp('a8936e c6b589 e5d4ac f5e6bc',{texture:.22}),
    iris:ramp('d9aa6b f4bd64',{glow:true}),
    foam:ramp('477b85 70a9ac 9cd2c6 d2e7ce',{texture:.34,bias:.04}),
    cascade:ramp('355f6c 477b85 70a9ac 9cd2c6',{texture:.19,bias:.07}),
  },
  lights:[
    {at:[.53,.73,-2.22],color:'#71bdad',radius:2.34,gain:.23},
    {at:[-.65,2.4,1.83],color:'#f1c282',radius:2.03,gain:.18}
  ],
  effect:{type:'mist',color:'#b3d2c7',count:23,opacity:.12,radius:[.85,.55],origins:[[.52,.17,-2.2],[.76,.24,-2.12]]},
  scatter:[
    {id:'shale-shingle',kind:'rock',bounds:[-5.5,-3.6,5.4,3.9],count:47,
      material:'shale',accent:'moss',minSize:.09,maxSize:.30,separation:.31,waterMin:.12},
    {id:'horsetail-bank',kind:'reed',bounds:[-5.2,-3.5,5.3,3.9],count:31,
      material:'leaf',minSize:.17,maxSize:.53,separation:.24,waterMin:.04,waterMax:.43}
  ],
  shapes,motion:{groups}
};

// Stratified basalt walls form a horseshoe around the upper river.
const faces=[
  [-4.23,-2.00,1.61,1.26,1.45],[-3.60,-2.64,1.83,1.56,1.56],[-2.71,-3.07,2.03,2.16,1.58],
  [-1.64,-3.39,2.12,2.83,1.63],[-.67,-3.50,1.77,3.18,1.10],
  [.23,-3.65,1.74,3.19,1.09],[1.23,-3.59,1.67,3.34,1.03],
  [2.27,-3.19,1.83,2.66,1.38],[3.38,-2.62,1.57,2.13,1.42],[4.21,-1.84,1.49,1.46,1.29]
];
faces.forEach(([x,z,w,h,d],i)=>{
  rock('cliff-mass-'+i,[x,h*.45,z],[w,h,d],'shale',{anchor:'ground',spacing:.123,yaw:i*.28,shadow:w*.84,keepOut:w*.64});
  for (let j=0;j<3;j++) {
    const y=h*(.23+j*.251);
    rock('cliff-ledge-'+i+'-'+j,[x+(random()-.5)*.53,y,z+d*(.19+random()*.11)],
      [w*(.72+random()*.34),.27+random()*.41,d*(.64+random()*.34)],
      j===2&&i%3===0?'earth':'shale',{accent:j>=1?'moss':'shale',yaw:(random()-.5)*.62,spacing:.099,anchor:'ground'});
  }
  rock('clifftop-'+i,[x,h*.86,z-.03],[w*.81,.48,d*.76],'moss',{anchor:'ground',accent:'leaf',spacing:.094});
});
rock('upper-lip',[.55,3.06,-3.16],[1.48,.41,.89],'shale',{accent:'moss',spacing:.067});
rock('split-shelf',[.49,1.31,-2.99],[1.90,.51,1.27],'shale',{accent:'cascade',spacing:.063,yaw:-.03});
rock('submerged-striker',[.60,.13,-2.39],[.48,.31,.64],'shale',{accent:'cascade',spacing:.061,yaw:.18});
add('water-over-lip','sheet',[.55,3.20,-2.98],'cascade',{size:[.95,1.84,.24],accent:'foam',spacing:.049});
add('water-lower-fan','sheet',[.48,1.45,-2.73],'cascade',{size:[1.48,1.40,.39],accent:'foam',spacing:.049});
add('minor-ribbon','sheet',[1.13,3.13,-2.99],'cascade',{size:[.20,1.66,.24],accent:'foam',spacing:.049});
for (let i=0;i<10;i++) {
  const x=.55+(random()-.5)*2.08, z=-2.60+random()*.58;
  if(Math.abs(x-.53)<.43)continue;
  rock('wet-boulder-'+i,[x,.12+random()*.21,z],[.17+random()*.38,.15+random()*.31,.22+random()*.33],
    'shale',{accent:i%3===0?'earth':'cascade',spacing:.060,yaw:(random()-.5)*.52});
}
for (const [i,x,z,size,q] of [[0,1.19,-1.02,.47,.18],[1,.46,-.44,.33,-.53],
    [2,1.25,.42,.34,-.04],[3,.99,2.18,.44,.24],[4,1.12,3.35,.32,-.25],[5,.44,2.96,.25,.27]]) {
  rock('river-stone-'+i,[x,.074,z],[size,.193,size*.78],'shale',{accent:'cascade',spacing:.057,yaw:q});
}
const periodKeys = (pivot,id,fn,count=64) => {
  groups.push({id,pivot,sampled:true,keys:Array.from({length:count+1},(_,i)=>({at:i*8/count,...fn((i%count)/count)}))});
};
const splitFlow = (z)=>.94 + .43*Math.sin(.91*z+.30) + .27*Math.sin(.43*z-.9);
for(let i=0;i<18;i++){
  const start=(i*.618033989)%1, x=.48+(random()-.5)*1.52, z=-2.36+random()*.23;
  const pivot=[x,.09,z], drop='basin-splash-'+i, drift=(x-.48)*.72;
  periodKeys(pivot,drop,t=>{
    const f=(t*5+start)%1, height=.42+.34*(i%4)/3;
    return {shift:[drift*f,(height*f-height*f*f)*2.6,.27*f+.65*f*f],
      scale:[1+.58*f,Math.max(.14,1-.57*f),1+.35*f],opacity:Math.min(1,f*18,(1-f)*3.8)};
  },120);
  rock(drop,pivot,[.041+i%4*.017,.034+i%5*.014,.045+i%5*.011],i%3?'foam':'ivory',
    {spacing:.049,motion:drop});
}
for(let i=0;i<16;i++){
  const start=(i*.618033989)%1, drift=(random()-.5)*.99;
  const pivot=[.64,.085,-2.19], id='downstream-foam-'+i;
  periodKeys(pivot,id,t=>{
    const f=(t+(i%2?t:0)+start)%1,z=-2.19+6.16*f;
    return {shift:[splitFlow(z)-.64+drift+.068*Math.sin(17*f+i),0,z+2.19],
      scale:[1+f,.72,1.33+f*.68],opacity:Math.min(.72,f*8,(1-f)*7)*(.92-.45*f)};
  },128);
  rock(id,pivot,[.051+i%3*.024,.026,.104+i%4*.041],'foam',{spacing:.049,motion:id});
}
// Allosaurus. Broad hip, balanced tail, two brow crests and three-finger forelimbs.
const hunter=subject('allosaur',[-1.86,.34,1.17],0);
const warm={accent:'stripe',underside:'belly',banded:true};
const bodyPivot=[-.43,1.59,0], neckPivot=[.60,1.84,0], skullPivot=[1.39,2.49,.025];
const jawPivot=[1.44,2.28,.02], tailBase=[-.92,1.66,0];
const choreography=[
  // Second, torso pitch and shift, neck pitch, skull counter-pitch, jaw pitch.
  [0,    0,     0,     0,      0,      0,      0],
  [.72,  .025, -.025, .023,   .036,  -.025,  -.018],
  [1.33, .017,  .006, .013,   .018,  -.017,  -.006],
  [2.38,-.135,  .071,-.069,  -.51,    .265,  -.018],
  [3.45,-.28,   .140,-.150, -1.063,   .600,  -.022],
  [3.79,-.262,  .128,-.130, -1.018,   .621,  -.076],
  [4.13,-.282,  .140,-.148, -1.066,   .608,  -.020],
  [4.52,-.25,   .123,-.116,  -.996,   .624,  -.064],
  [5.10,-.180,  .085,-.082,  -.746,   .536,  -.016],
  [6.12,-.035,  .029,-.021,  -.141,   .116,  -.055],
  [6.72, .027, -.010, .024,   .042,  -.056,  -.015],
  [7.34, .008, -.006, .009,   .007,  -.007,  -.004],
  [8,    0,     0,     0,      0,      0,      0]
];
const rig=(id,pivot,fn,parent)=>{
  groups.push({id,pivot:hunter.p(pivot),parent,keys:choreography.map(row=>({at:row[0],...fn(row)}))});
};
const turn=([x,y,z],[cx,cy],angle,dx=0,dy=0)=>{
  const c=Math.cos(angle),s=Math.sin(angle);
  return [cx+(x-cx)*c-(y-cy)*s+dx,cy+(x-cx)*s+(y-cy)*c+dy,z];
};
rig('hunter-body',bodyPivot,([,b,x,y])=>({rotation:[0,0,b],shift:[x,y,0]}));
rig('hunter-neck',neckPivot,([,,,,n])=>({rotation:[0,0,n]}),'hunter-body');
rig('hunter-skull',skullPivot,([,,,,,h])=>({rotation:[0,0,h]}),'hunter-neck');
rig('hunter-jaw',jawPivot,([,,,,,,j])=>({rotation:[0,0,j]}),'hunter-skull');
rig('hunter-tail',tailBase,([t,b])=>({rotation:[0,(t===0||t===8)?0:.11*Math.sin(t*Math.PI/4),-b*.76]}),'hunter-body');
function keepFootPlanted(side,hip,knee,ankle){
  const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  const a=length(hip,knee), b=length(knee,ankle);
  const angle=(from,to)=>Math.atan2(to[1]-from[1],to[0]-from[0]);
  const straight=angle(hip,knee), shin=angle(knee,ankle);
  const bonePose=(row)=>{
    if(row[0]===0||row[0]===8)return {top:hip,mid:knee};
    const [,pitch,x,y]=row, top=turn(hip,bodyPivot,pitch,x,y);
    const dx=ankle[0]-top[0],dy=ankle[1]-top[1],span=Math.min(a+b-.001,Math.hypot(dx,dy));
    const along=(a*a-b*b+span*span)/(2*span), away=Math.sqrt(Math.max(0,a*a-along*along));
    const heading=Math.atan2(dy,dx), c=Math.cos(heading),d=Math.sin(heading);
    return {top,mid:[top[0]+c*along-d*away,top[1]+d*along+c*away,knee[2]]};
  };
  rig('thigh-'+side,hip,row=>{
    const {top,mid}=bonePose(row);
    return {rotation:[0,0,angle(top,mid)-straight],shift:[top[0]-hip[0],top[1]-hip[1],0]};
  });
  rig('shin-'+side,knee,row=>{
    const {mid}=bonePose(row);
    return {rotation:[0,0,angle(mid,ankle)-shin],shift:[mid[0]-knee[0],mid[1]-knee[1],0]};
  });
}
hunter.tube('torso',[
  [-1.20,1.45,0,.24,.27],[-.83,1.62,0,.60,.64],[-.25,1.72,0,.67,.77],
  [.32,1.79,0,.53,.61],[.70,1.84,0,.36,.44],[.89,1.87,0,.21,.26]
],'hide',{...warm,motion:'hunter-body'});
hunter.tube('neck',[
  [.49,1.80,0,.43,.43],[.80,1.98,0,.406,.43],[1.14,2.31,.02,.337,.37],[1.39,2.49,.025,.28,.285]
],'hide',{...warm,motion:'hunter-neck'});
hunter.tube('tail',[
  [-.91,1.67,0,.45,.48],[-1.55,1.53,-.06,.36,.34],[-2.25,1.37,-.14,.25,.24],
  [-2.94,1.31,-.43,.167,.153],[-3.54,1.32,-.79,.104,.10],[-4.04,1.43,-.95,.016,.022]
],'hide',{...warm,motion:'hunter-tail'});
hunter.tube('skull',[
  [1.13,2.46,0,.22,.26],[1.53,2.57,.008,.377,.38],[1.88,2.61,.03,.37,.30],
  [2.26,2.55,.055,.28,.213],[2.57,2.49,.08,.19,.139],[2.65,2.48,.08,.046,.065]
],'hide',{accent:'stripe',underside:'ink',motion:'hunter-skull'});
hunter.tube('jaw',[
  [1.42,2.30,.02,.24,.19],[1.67,2.15,.015,.28,.125],[2.00,2.105,.042,.238,.081],
  [2.39,2.13,.072,.159,.069],[2.56,2.16,.083,.069,.025]
],'hide',{underside:'belly',accent:'ink',motion:'hunter-jaw'});
for(const side of [-1,1]) {
  hunter.rock('eyepit-'+side,[1.752,2.655,side*.318+.018],[.30,.218,.14],'ink',{motion:'hunter-skull'});
  hunter.rock('eye-'+side,[1.783,2.660,side*.395+.018],[.128,.086,.056],'iris',{motion:'hunter-skull'});
  hunter.rock('pupil-'+side,[1.811,2.657,side*.424+.018],[.029,.065,.03],'ink',{motion:'hunter-skull'});
  hunter.tube('brow-'+side,[
    [1.49,2.72,side*.256,.09,.105],[1.70,2.865,side*.266,.127,.123],[1.84,2.934,side*.24,.074,.085],
    [1.98,2.78,side*.264,.081,.070]
  ],'plate',{spacing:.049,motion:'hunter-skull'});
  hunter.rock('nostril-'+side,[2.40,2.513,side*.214+.064],[.13,.062,.037],'ink',{motion:'hunter-skull'});
  for(let k=0;k<8;k++){
    const x=1.78+k*.093, z=side*(.313-k*.019)+.039;
    const y=2.365-k*.007;
    const length=.075+(k===1||k===3?.052:.009);
    hunter.beam('upper-tooth-'+side+'-'+k,[x,y,z],[x+.012,y-length,z-.009*side],
      .023,'ivory',{endRadius:.005,motion:'hunter-skull'});
  }
  for(let k=0;k<6;k++){
    const x=1.83+k*.102, z=side*(.244-k*.016)+.043;
    hunter.beam('lower-tooth-'+side+'-'+k,[x,2.169,z],[x+.008,2.232+k*.003,z],.017,'ivory',
      {endRadius:.005,motion:'hunter-jaw'});
  }

  const offset=side>0?.13:-.30;
  const hip=[-.43,1.59,side*.46],knee=[.08+offset,1.04,side*.635],
    ankle=[-.16+offset,.20,side*.71],foot=[.01+offset,.065,side*.71];
  keepFootPlanted(side,hip,knee,ankle);
  hunter.tube('thigh-'+side,[
    [...hip,.31,.339],[hip[0]+.23,1.37,side*.54,.286,.322],[knee[0]-.06,1.19,side*.605,.232,.24],
    [...knee,.165,.174]
  ],'hide',{accent:'stripe',underside:'belly',motion:'thigh-'+side});
  hunter.rock('hip-'+side,[-.46,1.48,side*.51],[.66,.59,.48],'hide',{accent:'stripe',motion:'hunter-body'});
  hunter.tube('shin-'+side,[
    [...knee,.164,.168],[knee[0]-.12,.87,side*.65,.152,.164],[ankle[0]-.024,.37,side*.69,.106,.131],
    [...ankle,.081,.101]
  ],'hide',{accent:'stripe',underside:'belly',motion:'shin-'+side});
  hunter.rock('knee-'+side,knee,[.32,.32,.31],'hide',{accent:'stripe',motion:'shin-'+side});
  hunter.tube('heel-'+side,[[...ankle,.089,.102],[...foot,.134,.082]],
    'hide',{accent:'stripe',spacing:.049});
  hunter.rock('ground-shadow-'+side,[foot[0],foot[1]+.015,foot[2]],[.10,.085,.08],'ink',{shadow:.50});
  for(let i=-1;i<=1;i++){
    const t=[foot[0]+.25-Math.abs(i)*.054,foot[1]-.014,foot[2]+i*.143];
    hunter.beam('toe-'+side+'-'+i,foot,t,.071,'stripe',{endRadius:.038});
    hunter.beam('talon-'+side+'-'+i,t,[t[0]+.115,t[1]-.015,t[2]+i*.019],.034,'ivory',{endRadius:.007});
  }
  const armZ=side*.405, handZ=side*.58;
  hunter.tube('arm-'+side,[
    [.65,1.84,armZ,.125,.135],[.86,1.51,side*.51,.105,.101],[1.10,1.55,handZ,.073,.067],
    [1.23,1.51,handZ,.057,.045]
  ],'hide',{underside:'belly',spacing:.049,motion:'hunter-body'});
  for(let i=0;i<3;i++) {
    const z=handZ+(i-1)*.05;
    hunter.beam('finger-'+side+'-'+i,[1.19,1.51,z],[1.34,1.46-i*.021,z],.033,'stripe',{endRadius:.018,motion:'hunter-body'});
    hunter.beam('finger-tip-'+side+'-'+i,[1.34,1.46-i*.021,z],[1.39,1.405-i*.021,z],.020,'ivory',{endRadius:.005,motion:'hunter-body'});
  }
}
for (const side of [-1,1]) {
  for (const [i,x,y,z] of [
    [0,-.76,1.85,.57],[1,-.64,1.92,.57],[2,-.56,1.865,.62],[3,-.43,1.96,.626],
    [4,-.28,1.85,.667],[5,-.16,1.96,.63],[6,.02,1.93,.590],[7,.20,1.92,.555],
    [8,.36,1.87,.52],[9,.54,1.92,.464],[10,.69,1.95,.426],[11,.84,2.01,.394],
    [12,.96,2.10,.365],[13,1.04,2.19,.352]
  ]) {
    hunter.rock('scale-'+side+'-'+i,[x,y,side*z],[.090+(i%3)*.018,.064,.039],
      i%4===0?'belly':'stripe',{spacing:.049,yaw:side*.14,motion:i>9?'hunter-neck':'hunter-body'});
  }
}
for(let i=0;i<12;i++){
  const x=-1.05+i*.175;
  const y=2.12+.33*Math.exp(-((x+.24)**2)*1.7)+.12*Math.max(0,x);
  hunter.beam('dorsal-scale-'+i,[x,y+.015,.005],[x-.055,y+.105,.003],.068,'stripe',{endRadius:.017,motion:'hunter-body'});
}

const mouthAt=(time)=>{
  const end=choreography.findIndex(k=>k[0]>time);
  const a=choreography[end-1],b=choreography[end], f=(time-a[0])/(b[0]-a[0]);
  const [,body,x,y,neck,head,jaw]=a.map((value,j)=>value+(b[j]-value)*f*f*(3-2*f));
  return hunter.p(turn(turn(turn(turn([2.55,2.16,.085],jawPivot,jaw),skullPivot,head),neckPivot,neck),
    bodyPivot,body,x,y));
};
for (let i=0;i<8;i++){
  const start=4.76+i*.106, [x,height,z]=mouthAt(start);
  const pivot=[x+(random()-.5)*.12,.088,z+(random()-.5)*.14], id='muzzle-droplet-'+i;
  const duration=Math.sqrt(Math.max(.03,height-pivot[1])*.22)+.065;
  periodKeys(pivot,id,t=>{
    const age=(t*8-start)/duration;
    if(age<=0||age>=1)return {opacity:0};
    return {shift:[.12*age,(height-pivot[1])*(1-age*age),.10*age],
      scale:[.88,.7+age*1.12,.88],opacity:Math.min(.9,age*21,(1-age)*11)};
  },192);
  rock(id,pivot,[.036,.069,.036],'foam',{spacing:.049,motion:id});
}

// Ferns use curved fronds and individual leaflets. Trunks retain pairs of old leaf scars.
function fern(id,x,y,z,scale,height,yaw,fronds=7){
  const p=point([x,y,z],yaw);
  if(height>.1){
    tube(id+'-trunk',[[0,-.14,0,.16,.16],[.10,height*.48,0,.125,.124],[.19,height,0,.087,.09]]
      .map(([a,b,c,d,e])=>[...p([a*scale,b*scale,c*scale]),d*scale,e*scale]),'wood',{spacing:.069});
    for(let j=1;j<Math.ceil(height*6);j++){
      const t=j/Math.ceil(height*6),a=j*2.39996;
      rock(id+'-scar-'+j,p([(.19*t+.114*Math.cos(a))*scale,height*t*scale,.113*Math.sin(a)*scale]),
        [.113*scale,.075*scale,.107*scale],'earth',{spacing:.081});
    }
  }
  for(let i=0;i<fronds;i++){
    const a=i*Math.PI*2/fronds+.14*(random()-.5), length=(.80+.43*random())*scale;
    const F=(t,n=0)=>p([.19*scale+Math.cos(a)*length*t-Math.sin(a)*n,
      height*scale+scale*(.45*Math.sin(t*Math.PI*.87)-t*t*.24+(height>.1?0:.06)),Math.sin(a)*length*t+Math.cos(a)*n]);
    beam(id+'-rib-a-'+i,F(0),F(.41),.047*scale,'leaf',{endRadius:.039*scale,spacing:.081});
    beam(id+'-rib-b-'+i,F(.41),F(.78),.038*scale,'leaf',{endRadius:.025*scale,spacing:.080});
    beam(id+'-rib-c-'+i,F(.78),F(1.05),.026*scale,'moss',{endRadius:.008*scale,spacing:.081});
    for(let j=0;j<5;j++)for(const sign of [-1,1]){
      const t=.12+j*.155, w=scale*(.12+.21*Math.sin(t*Math.PI));
      beam(id+'-pinna-'+i+'-'+j+'-'+sign,F(t),F(t+.155,w*sign),.044*scale,
        i%3===0?'moss':'leaf',{endRadius:.009*scale,spacing:.081});
    }
  }
}
const treeFerns=[
  [-4.61,.54,-1.37,1.10,2.19,.5],[-3.64,1.33,-2.65,.80,1.66,1.7],
  [-2.16,2.38,-3.00,.67,1.29,2.3],[-.93,3.03,-3.16,.54,1.14,.8],
  [1.66,3.01,-3.03,.65,1.25,.85],[2.82,2.49,-2.86,.77,1.33,.3],
  [3.74,.49,-.73,.95,2.13,1.2],[4.47,.46,1.39,.80,1.45,2.9]
];
treeFerns.forEach(([x,y,z,s,h,q],i)=>fern('treefern-'+i,x,y,z,s,h,q,7));
const undergrowth=[
  [-5.09,.36,.83,.49],[-4.49,.39,2.11,.56],[-3.39,.43,2.99,.61],[-2.47,.38,3.10,.52],
  [-1.69,.39,3.31,.54],[-.86,.34,3.42,.41],[-1.01,.39,-.18,.44],[-1.99,.55,-2.12,.52],
  [2.28,.37,-.77,.52],[2.62,.42,1.72,.62],[2.28,.41,2.78,.61],[3.63,.38,2.65,.62],
  [4.38,.44,.95,.55],[3.65,.89,-2.17,.48],[-4.46,.54,-2.22,.47],[-4.01,.42,.17,.48]
];
undergrowth.forEach(([x,y,z,s],i)=>fern('fern-'+i,x,y,z,s,0,i*.91,5));
// Marks at ground level reward a closer orbit of the model.
for(const [index,x,z,angle] of [[0,-1.09,2.38,.92],[1,-1.32,2.86,.58],[2,-1.74,3.29,.81],[3,-2.1,3.57,.71]]) {
  const p=point([x,0,z],angle);
  rock('track-pad-'+index,p([0,.013,0]),[.28,.035,.18],'wood',{anchor:'ground',yaw:-angle,spacing:.049});
  for(let j=-1;j<=1;j++){
    const toe=p([.11+(.07- Math.abs(j)*.035),.011,j*.083]);
    rock('track-toe-'+index+'-'+j,toe,[.22,.031,.074],'wood',
      {anchor:'ground',yaw:-angle-j*.30,spacing:.049});
  }
}
const fossil = [-3.82,.63,2.19];
rock('ammonite-boulder',[-3.82,.47,2.19],[.89,.30,.74],'shale',{accent:'earth',spacing:.054,yaw:-.55});
const spiral = Array.from({length:29},(_,i)=>{
  const theta=i*.36,r=.019+i*.0086;
  return [fossil[0]+Math.cos(theta)*r,fossil[1]-.046*Math.sin(theta)*r,
    fossil[2]+Math.sin(theta)*r,.017+i*.001,.012+i*.0007];
});
tube('ammonite-fossil',spiral,'ivory',{spacing:.049});
for(let i=12;i<spiral.length;i+=2){
  const [x,y,z,rr]=spiral[i], dx=x-fossil[0], dz=z-fossil[2];
  beam('fossil-rib-'+i,[x-dx*.10,y,z-dz*.10],[x+dx*.17,y-.01,z+dz*.17],
    rr*.51,'belly',{endRadius:.006,spacing:.049});
}
tube('fallen-log',[[-5.15,.59,1.79,.173,.176],[-4.96,.58,2.04,.172,.175],[-4.55,.49,2.42,.166,.172],
  [-4.09,.45,2.73,.153,.152],[-3.84,.46,2.94,.145,.14]],'wood',{accent:'moss',spacing:.063});
for(let i=0;i<8;i++){
  const q=[-4.96+i*.14,.51+random()*.13,2.10+i*.105];
  beam('shelf-fungus-stem-'+i,q,[q[0]-.078,q[1]+.10,q[2]+.047],.033,'ivory',{endRadius:.020});
  rock('shelf-fungus-'+i,[q[0]-.079,q[1]+.105,q[2]+.05],[.18,.064,.143],'plate',{accent:'ivory',spacing:.050});
}

fs.writeFileSync(process.argv[2],JSON.stringify(recipe,null,2));
