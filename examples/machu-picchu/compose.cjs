'use strict';

const fs = require('node:fs');
const shapes = [];
const palette = {
  grass: {ramp:['#193b36','#315548','#53734b','#76974d','#a5b863','#ccce82'],texture:.43},
  bench: {ramp:['#254737','#446c46','#5d8a48','#81a64b','#9db85d','#bacb77'],texture:.34,bias:.038},
  rock: {ramp:['#152d34','#264247','#3b5656','#556e61','#6c8170','#8e9980'],pattern:'strata',texture:.51},
  peak: {ramp:['#213a3c','#355746','#4e7351','#708954','#96a067'],texture:.45},
  masonry: {ramp:['#323c36','#535d53','#777b69','#a09e84','#beb49a','#dbccad'],pattern:'masonry',texture:.35,bias:.019},
  wall: {ramp:['#303a36','#4a564e','#6d786f','#949d8e','#b0b8a5','#cfceb7'],pattern:'masonry',texture:.32},
  trail: {ramp:['#484c3b','#6d6d53','#8d8a63','#b7a97d','#d3c298'],texture:.49},
  thatch: {ramp:['#564434','#7c5d3a','#a1834c','#c1a365','#dfc384'],pattern:'planks',texture:.43},
  leaf: {ramp:['#183e37','#2e5b46','#497450','#718d58','#9eaa6b'],texture:.43},
  wood: {ramp:['#282f2c','#423e32','#686247']},
};
function add(id,kind,material,at,details) { shapes.push({id,kind,material,at,...details}); }
function box(id,x,y,z,w,h,d,material,details={}) {
  add(id,'box',material,[x,y,z],{size:[w,h,d],...details});
}
function stone(id,x,y,z,w,h,d,material='rock',details={}) {
  add(id,'rock',material,[x,y,z],{size:[w,h,d],...details});
}
function wall(id,a,b,base,height,mat='wall',width=.17) {
  const [dx,dz]=[b[0]-a[0],b[1]-a[1]];
  box(id,(a[0]+b[0])/2,base+height/2,(a[1]+b[1])/2,Math.hypot(dx,dz)+.032,height,width,mat,
    {yaw:-Math.atan2(dz,dx),spacing:.056});
}
function terrace(id,edges,top,run,mat='bench',rear=.35) {
  for(let i=1;i<edges.length;i++) {
    const a=edges[i-1],b=edges[i];
    const d=run+rear;
    const center=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    const span=Math.hypot(b[0]-a[0],b[1]-a[1])+.052;
    box(id+'-fill-'+i,center[0]-Math.sin(angle)*d/2,top-.32,center[1]-Math.cos(angle)*d/2,span,.54,d,'rock',{yaw:angle,spacing:.134});
    box(id+'-strip-'+i,center[0]-Math.sin(angle)*d/2,top-.021,center[1]-Math.cos(angle)*d/2,span,.047,d,mat,{yaw:angle,spacing:.082});
    wall(id+'-retaining-'+i,a,b,top-.28,.25,'masonry',.122);
  }
}
// Huayna Picchu and the lower ridge form one irregular silhouette.
stone('peak-shoulder',.88,1.30,-3.04,3.20,3.60,2.53,'peak',{accent:'grass',yaw:.35,spacing:.092});
stone('huayna-spire',1.23,2.49,-3.54,2.11,4.30,1.60,'peak',{accent:'grass',yaw:-.38,tilt:-.13,spacing:.079});
stone('huayna-exposed-face',1.87,1.99,-3.31,1.17,3.66,1.91,'rock',{accent:'peak',yaw:.24,tilt:.12,spacing:.086});
stone('huayna-rib',.65,2.09,-2.91,.91,3.38,1.40,'rock',{accent:'peak',yaw:-.19,tilt:-.22});
stone('rear-secondary-summit',-1.0,.83,-3.27,2.40,3.34,1.80,'peak',{accent:'grass',yaw:.22,tilt:.29});
stone('west-outcrop',-3.48,-.06,-1.52,3.10,2.75,2.02,'rock',{accent:'peak',yaw:.45});
stone('south-cliff',-2.33,-.81,1.88,3.92,2.13,2.23,'rock',{accent:'peak',yaw:.38,tilt:.14});
stone('east-cliff',3.02,-.73,.72,2.95,2.24,2.99,'rock',{accent:'peak',yaw:.45,tilt:.20});
stone('south-east-cliff',1.55,-.96,2.57,4.12,1.35,1.44,'rock',{yaw:-.33,accent:'peak'});
stone('western-knuckle',-4.23,-.68,.35,2.02,2.29,2.13,'rock',{accent:'peak',yaw:.38});
for(let i=0;i<5;i++){
  const front=3.20-i*.51;
  terrace('agricultural-'+i,[
    [-3.76+i*.115,front-.78],[-2.99+i*.10,front-.22],[-1.72+i*.04,front+.035],
    [-.29-i*.015,front-.03],[1.24-i*.10,front-.22],[2.18-i*.08,front-.73]
  ],-.22+i*.253,.47);
}
for(let i=0;i<4;i++){
  const x=4.12-i*.39;
  terrace('eastern-'+i,[[x-.55,1.48-i*.04],[x,1.01-i*.025],[x+.06,.28],[x-.20,-.60]],
    -.16+i*.27,.45,'bench',.62);
}
// Roofless quarters are split by the long grassy central plaza.
const plaza=1.08;
terrace('plaza',[[-3.28,1.24],[-2.13,1.33],[-.70,1.23],[.92,1.12],[2.34,.68],[3.03,.20]],plaza,2.42,'bench',.54);
terrace('rear-plaza',[[-2.20,-.37],[-1.30,-.60],[.17,-.78],[1.62,-.91],[2.18,-1.33]],1.15,1.06,'grass',.27);
terrace('upper-west',[[-3.53,.63],[-2.69,.64],[-1.74,.47]],1.31,1.49,'grass',.25);
terrace('temple-knoll',[[-2.23,-.68],[-1.46,-.77],[-.43,-.90]],1.48,1.11,'grass',.27);
terrace('upper-east',[[.87,.84],[1.84,.63],[2.70,.33],[3.17,-.25]],1.30,1.32,'grass',.29);

function room(id,x,z,y,w,d,h,angle=0,roofless=true,mat='wall') {
  const p=(a,b)=>[x+a*Math.cos(angle)+b*Math.sin(angle),z-a*Math.sin(angle)+b*Math.cos(angle)];
  wall(id+'-back',p(-w/2,-d/2),p(w/2,-d/2),y,h,mat);
  wall(id+'-west',p(-w/2,-d/2),p(-w/2,d/2),y,h*.98,mat);
  wall(id+'-east',p(w/2,-d/2),p(w/2,d/2),y,h*.83,mat);
  wall(id+'-door-l',p(-w/2,d/2),p(-.125,d/2),y,h*.76,mat);
  wall(id+'-door-r',p(.145,d/2),p(w/2,d/2),y,h*.83,mat);
  if(roofless) {
    box(id+'-interior',x,y+.016,z,w-.14,.03,d-.14,'trail',{yaw:angle,spacing:.068});
  } else {
    add(id+'-roof','gable','thatch',[x,y+h*.89,z],{size:[w+.24,.38,d+.26],yaw:angle,face:'masonry',spacing:.051});
  }
}
room('lookout-hut',-3.04,.10,1.31,.80,.66,.53,-.17,false,'masonry');
room('upper-house',-2.04,.01,1.31,.74,.71,.54,-.16);
room('lower-west',-2.52,.79,1.09,.79,.49,.42,-.08);
room('west-yard',-1.47,.73,1.08,.69,.54,.31,-.06);
room('east-quarter-a',1.20,.24,1.30,.73,.76,.49,-.12);
room('east-quarter-b',2.04,.07,1.30,.71,.78,.59,-.12);
room('east-quarter-c',2.80,-.32,1.30,.75,.76,.49,-.24);
room('east-quarter-d',2.24,-.82,1.30,.64,.68,.36,-.13);
room('western-court',-2.62,-.91,1.31,.78,.61,.37,-.22);
room('ridge-room',-.51,-1.25,1.48,.65,.66,.42,-.24);
wall('main-plaza-west',[-1.36,-.27],[-1.61,.31],1.09,.31,'wall');
wall('main-plaza-approach',[-1.01,.98],[-.26,1.00],1.08,.32,'masonry');
wall('approach-stone-post',[.31,.97],[.47,.94],1.08,.49,'masonry',.22);
wall('city-east-parapet',[1.52,.94],[2.63,.55],1.12,.27,'wall');
wall('city-west-parapet',[-3.50,.87],[-2.97,1.17],1.10,.25,'wall');
wall('temple-back',[-2.01,-1.56],[-.98,-1.66],1.48,.59,'masonry',.22);
wall('temple-side',[-2.01,-1.56],[-1.96,-.97],1.48,.55,'masonry',.20);
const windowWallZ=-.89;
for(const [i,[ax,bx]] of [[-2.01,-1.92],[-1.72,-1.61],[-1.40,-1.29],[-1.07,-.96]].entries()){
  wall('three-window-pier-'+i,[ax,windowWallZ],[bx,windowWallZ],1.48,.60,'masonry',.17);
}
wall('three-window-sill',[-2.01,windowWallZ],[-.96,windowWallZ],1.48,.19,'masonry');
wall('three-window-lintel',[-2.01,windowWallZ],[-.96,windowWallZ],1.98,.10,'masonry');
stone('ritual-stone',-1.73,1.72,-1.28,.39,.29,.34,'masonry',{accent:'trail',spacing:.05});
for(let i=0;i<18;i++) {
  const x=-.84+i*.047, y=-.19+i*.071, z=3.13-i*.114;
  box('ascending-step-'+i,x,y,z,.36,.12,.154,'trail',{yaw:-.34,spacing:.051});
  box('ascending-nose-'+i,x-.019,y+.044,z+.054,.36,.029,.038,'masonry',{yaw:-.34,spacing:.049});
}
for(let i=0;i<5;i++) {
  box('temple-step-'+i,-1.04-i*.063,1.14+i*.074,-.38-i*.078,.33,.12,.15,'trail',{yaw:.44,spacing:.052});
}
box('plaza-path',-.28,1.103,.18,.25,.043,1.51,'trail',{yaw:.33,spacing:.061});
box('plaza-path-spur',-.68,1.106,-.31,1.14,.047,.21,'trail',{yaw:.13,spacing:.064});

const trees=[
  [-4.15,-.45,1.50,.45],[-3.88,-.99,1.67,.49],[-3.47,-1.53,1.55,.58],[-3.38,-1.98,1.40,.45],
  [-2.99,-1.67,1.12,.45],[-2.65,-2.03,.93,.44],[-2.54,-2.44,1.07,.45],[-2.13,-2.43,.94,.44],
  [2.69,-1.52,1.04,.38],[3.17,-1.59,.94,.46],[3.51,-1.14,.64,.40],
  [-3.68,1.08,.45,.32],[-3.65,1.55,.25,.27],[-3.39,2.14,.06,.30],
  [3.42,1.72,.24,.33],[3.90,1.23,.33,.40],[4.12,.20,.11,.34],
  [-.20,-2.02,1.22,.40],[-.45,-2.32,1.51,.43],[.02,-2.4,1.75,.45],
  [-.02,-2.84,2.19,.45],[.26,-2.52,2.11,.46],[.48,-2.47,2.20,.44],
  [2.40,-2.26,1.64,.47],[2.71,-2.11,1.05,.43],
];
trees.forEach(([x,z,y,h],i)=>{
  add('tree-trunk-'+i,'cylinder','wood',[x,y,z],{radius:.032,height:h*.73,spacing:.09});
  stone('tree-crown-'+i,x,y+h*.73,z,h*.73,h*.77,h*.75,'leaf',{accent:'grass',spacing:.053});
  stone('tree-crown-offset-'+i,x+h*.20,y+h*.63,z+h*.16,h*.48,h*.56,h*.52,'leaf',{spacing:.063});
});
const recipe = {
  title:'马丘比丘 · 云上石城',locale:'zh-CN',seed:1438,background:'#12232e',spacing:.093,sun:[-.91,.81,.62],
  camera:{target:[0,1.36,-.19],dist:16.55,yaw:.29,pitch:.505},
  terrain:{radius:[4.98,3.92],height:-.51,depth:1.84,roughness:.56,edge:.22,surface:'grass',cliff:'rock',capCliff:'peak',
    hills:[[.74,-2.90,2.95,2.05,1.28],[-1.55,-2.54,1.85,1.65,1.24],[-3.54,-1.02,1.47,1.12,1.60],[3.54,-.97,1,1.82,1.47],[0,-.48,.73,2.90,2.70],[-2.45,1.71,.35,1.56,1.7]]},
  materials:palette, shapes,
  effect:{type:'mist',color:'#d7e8df',count:265,opacity:.20,origins:[
    [-4.52,-.81,1.10],[-3.3,-1.28,2.67],[-1.5,-1.30,3.79],[.58,-1.2,3.8],[2.64,-1.08,2.56],[4.5,-.95,1.34],
    [-5.02,-.19,-.71],[-4.3,.05,-2.95],[-2.75,.13,-3.73],[.33,.10,-4.25],[2.64,.20,-3.78],[4.05,.18,-1.89],[5.0,-.19,-.49]
  ]}
};
fs.writeFileSync(process.argv[2],JSON.stringify(recipe));
