'use strict';

const fs = require('node:fs');
const shapes = [];
const lights = [];
const colors = (ramp,options={}) => ({ramp:ramp.split(' '),...options});
const materials = {
  base:colors('#111927 #1b2738 #29374c #3c4c61',{pattern:'strata'}),
  pavement:colors('#252c3d #394357 #50586b #746f7e',{texture:.31}),
  stone:colors('#36364a #545169 #82717d #b09593 #d2b6a0',{pattern:'masonry',texture:.27}),
  roof:colors('#20263e #343b58 #4b5575 #6b7692',{pattern:'planks'}),
  waterEdge:colors('#192c45 #263c57 #3e5670 #57758f'),
  leaf:colors('#172d36 #293f48 #3b5458 #596e60',{texture:.45}),
  iron:colors('#5a3b42 #8d5941 #be7e4b #e3a75d #f5c275',{bias:.15}),
  beams:colors('#362c3d #674c47 #a37c57 #d29e68',{bias:.06}),
  lamp:colors('#e6a577 #ffd396 #fff0bf',{glow:true}),
  ember:colors('#a97162 #df9b75 #edb889',{glow:true}),
  glass:colors('#26324d #3a4a65 #556583'),
  fountain:colors('#486581 #b1d1d8',{glow:true}),
  hull:colors('#582f4a #854757 #b86b63 #da9481'),
};
const put = (id,kind,material,at,detail) => shapes.push({id,kind,material,at,...detail});
function box(id,x,y,z,w,h,d,mat,options={}){
  put(id,'box',mat,[x,y,z],{size:[w,h,d],...options});
}
function beam(id,at,to,radius,mat='beams'){
  put(id,'beam',mat,at,{to,radius,spacing:.049});
}
function rock(id,x,y,z,w,h,d,mat,options={}){
  put(id,'rock',mat,[x,y,z],{size:[w,h,d],...options});
}
function polyline(id,points,radius,mat) {
  for(let i=1;i<points.length;i++) beam(id+'-'+i,points[i-1],points[i],radius,mat);
}
const tx=0,tz=-1.99;
const level = [[.40,1.31],[.76,1.16],[1.16,.98],[1.60,.79],[1.95,.65],[2.32,.53],
  [2.75,.435],[3.16,.355],[3.58,.296],[3.99,.248],[4.38,.203],[4.76,.155],[5.11,.111],[5.41,.089]];
const corners = [[-1,1],[1,1],[1,-1],[-1,-1]];
// Match the interval between the official deck heights, with Y=.35 at ground level.
const heightMarks=[[.35,.35],[1.70,1.43],[2.72,2.53],[5.35,5.58],[6.21,6.60]];
function scaledHeight(y){
  for(let i=1;i<heightMarks.length;i++){
    const [a,b]=heightMarks[i-1], [c,d]=heightMarks[i];
    if(y<=c)return b+(d-b)*(y-a)/(c-a);
  }
  return y+.39;
}

function towerPoint([height,width],[jx,jz],inset=0) {
  return [tx+jx*(width-inset),height,tz+jz*(width-inset)];
}
box('tower-platform-footprint',tx,.220,tz,2.83,.25,2.78,'pavement',{spacing:.085});
for (const [i,corner] of corners.entries()) {
  const [x,y,z]=towerPoint(level[0],corner);
  box('footing-'+i,x,.39,z,.39,.35,.39,'stone');
  box('footing-cap-'+i,x,.56,z,.29,.085,.30,'iron',{spacing:.056});
  polyline('outer-leg-'+i,level.map(p=>towerPoint(p,corner)),.056,'iron');
  polyline('inner-leg-'+i,level.slice(0,9).map(p=>towerPoint(p,corner,.127)),.039,'beams');
  for(let j=0;j<8;j++){
    beam('leg-rivet-rail-'+i+'-'+j,towerPoint(level[j],corner),towerPoint(level[j],corner,.127),.034,'iron');
    beam('leg-inner-diagonal-'+i+'-'+j,towerPoint(level[j],corner,.127),towerPoint(level[j+1],corner),.025,'beams');
  }
  for(let j=0;j<6;j++){
    const p=towerPoint(level[j],corner);
    lights.push({at:[p[0],p[1]+.04,p[2]],color:'#efaf78',radius:.26,gain:.36});
  }
}
for(let face=0;face<4;face++) {
  const a=corners[face],b=corners[(face+1)%4];
  for(let j=3;j<level.length-1;j++){
    const lowerA=towerPoint(level[j],a), lowerB=towerPoint(level[j],b);
    const upperA=towerPoint(level[j+1],a), upperB=towerPoint(level[j+1],b);
    beam('lattice-rail-'+face+'-'+j,upperA,upperB,.033,'iron');
    beam('lattice-diagonal-a-'+face+'-'+j,lowerA,upperB,.025,'beams');
    if(j<10&&j%2===1) beam('lattice-diagonal-b-'+face+'-'+j,lowerB,upperA,.023,'beams');
  }
  const arch=Array.from({length:13},(_,i)=>{
    const t=-1+i/6;
    const height=.69+.93*Math.sqrt(Math.max(0,1-t*t));
    const width=.79+.415*Math.abs(t)**1.75;
    return [(a[0]===b[0]?a[0]:-a[0]*t)*width+tx,height,(a[1]===b[1]?a[1]:-a[1]*t)*width+tz];
  });
  polyline('lower-arch-'+face,arch,.057,'iron');
  for(let j=3;j<=9;j+=2) {
    const [x,y,z]=arch[j];
    beam('arch-spandrel-'+face+'-'+j,[x,y,z],
      [tx+(x-tx)*.79,1.70,tz+(z-tz)*.79],.026,'beams');
  }
}
for(const [i,[y,width,h]] of [[1.70,1.56,.093],[2.72,.88,.101],[5.35,.37,.098]].entries()){
  box('deck-'+i,tx,y,tz,width,h,width,'iron',{spacing:.058});
  box('deck-underside-'+i,tx,y-.07,tz,width*.87,.045,width*.87,'beams',{spacing:.063});
  const r=width*.515;
  for(let j=0;j<4;j++) {
    const a=corners[j],b=corners[(j+1)%4];
    beam('deck-gilt-'+i+'-'+j,[tx+a[0]*r,y+h*.56,tz+a[1]*r],[tx+b[0]*r,y+h*.56,tz+b[1]*r],.022,'lamp');
  }
}
box('beacon-room',tx,5.50,tz,.31,.20,.30,'glass',{spacing:.051});
box('beacon-window-front',tx,5.51,tz+.16,.18,.089,.038,'lamp',{spacing:.05});
box('beacon-window-side',tx+.16,5.51,tz,.038,.089,.18,'lamp',{spacing:.05});
put('beacon-cap','cone','iron',[tx,5.60,tz],{radius:.21,height:.24,topRadius:.06,spacing:.055});
beam('antenna',[tx,5.79,tz],[tx,6.16,tz],.026,'iron');
rock('antenna-beacon',tx,6.17,tz,.072,.093,.072,'lamp',{spacing:.049});

function placeTower([x,y,z]){
  return [tx+(x-tx)*.865,scaledHeight(y),tz+(z-tz)*.865];
}
for(const shape of shapes){
  shape.at=placeTower(shape.at);
  if(shape.to)shape.to=placeTower(shape.to);
  if(shape.size){
    shape.size[0]*=.865;
    shape.size[2]*=.865;
  }
}
for(const light of lights)light.at=placeTower(light.at);
function lamp(id,x,y,z,size=1){
  const h=.51*size;
  box(id+'-plinth',x,y+.04,z,.11*size,.086,.11*size,'roof');
  beam(id+'-pole',[x,y,z],[x,y+h,z],.027*size,'roof');
  box(id+'-glass',x,y+h,z,.109*size,.124*size,.109*size,'lamp',{spacing:.050});
  box(id+'-cap',x,y+h+.077*size,z,.122*size,.041,.122*size,'roof',{spacing:.057});
  lights.push({at:[x,y+h,z],color:'#ffc28b',radius:.85*size,gain:.56});
}
function tree(id,x,y,z,h){
  put(id+'-trunk','cylinder','roof',[x,y,z],{radius:.038,height:h*.77,spacing:.09});
  rock(id+'-crown',x,y+h*.70,z,h*.66,h*.63,h*.62,'leaf',{yaw:h+.4,spacing:.067});
  rock(id+'-crown-edge',x+h*.17,y+h*.66,z+h*.18,h*.42,h*.48,h*.45,'leaf',{yaw:h+.7,spacing:.074});
}
// One axis links the Champ de Mars, the tower, the Pont d'Iéna and the gardens.
for(const [i,[x,w]] of [[-3.63,2.65],[-1.58,1.45],[1.58,1.45],[3.63,2.65]].entries()){
  for(const [side,z] of [['left-bank',-.53],['right-bank',1.65]]){
    box(side+'-quay-'+i,x,.05,z,w,.38,.16,'stone',{spacing:.084});
    box(side+'-walk-'+i,x,.265,z+(z>0?.18:-.18),w,.14,.38,'pavement',{spacing:.085});
  }
}
for(const x of [-3.7,-2.68,-1.55,1.55,2.68,3.7]){
  for(const [side,z] of [['left',-.73],['right',1.85]]) lamp(side+'-quay-lamp-'+x,x,.33,z,.72);
}
box('jena-bridge-deck',0,.433,.55,.64,.111,2.26,'pavement',{spacing:.066});
box('axis-approach-tower',0,.326,-.75,.75,.103,.68,'stone',{spacing:.069});
box('axis-approach-garden',0,.335,1.83,.74,.122,.70,'stone',{spacing:.069});
for(const side of [-1,1]){
  const x=side*.355;
  box('jena-parapet-'+side,x,.497,.55,.089,.102,2.25,'stone',{spacing:.055});
  for(let i=0;i<=5;i++){
    const z=-.52+i*.428;
    box('jena-pier-'+side+'-'+i,x,.146,z,.21,.31,.085,'stone',{spacing:.049});
    box('jena-pier-cap-'+side+'-'+i,x,.32,z,.21,.089,.12,'stone',{spacing:.052});
  }
  for(let i=0;i<5;i++){
    const c=-.52+(i+.5)*.428;
    const arch=Array.from({length:9},(_,j)=>{
      const t=j/4-1;
      return [x,.157+.194*Math.sqrt(Math.max(0,1-t*t)),c+t*.178];
    });
    polyline('jena-arch-'+side+'-'+i,arch,.037,'stone');
  }
  for(const z of [-.55,1.65]) lamp('jena-end-lamp-'+side+'-'+z,x,.49,z,.78);
}
for(const side of [-1,1]){
  for(let i=0;i<4;i++){
    const z=-2.50-i*.49;
    tree('champ-tree-'+side+'-'+i,side*(1.81-i*.11),.26,z,.63+(i%2)*.18);
    tree('champ-outside-tree-'+side+'-'+i,side*(2.90-i*.14),.23,z+.12,.69+(i%2)*.16);
  }
  box('champ-lawn-side-'+side,side*1.01,.215,-3.22,.52,.14,1.64,'leaf',{spacing:.080});
  box('champ-path-edge-'+side,side*.57,.268,-3.19,.073,.034,1.60,'stone',{spacing:.071});
}
box('champ-central-lawn',0,.233,-3.68,.99,.11,1.13,'leaf',{spacing:.080});
box('champ-crossing',0,.291,-3.07,2.91,.034,.16,'stone',{spacing:.073});

for(const side of [-1,1]){
  for(let i=0;i<3;i++){
    const z=2.35+i*.56;
    tree('trocadero-tree-'+side+'-'+i,side*(1.14+i*.17),.32,z,.55+(i%2)*.14);
    rock('trocadero-hedge-'+side+'-'+i,side*(.83+i*.07),.34,z,.29,.20,.39,'leaf',{spacing:.067});
  }
}
box('warsaw-basin-surround',0,.302,2.80,1.23,.17,1.44,'stone',{spacing:.071});
box('warsaw-basin-water',0,.398,2.80,1.04,.029,1.27,'waterEdge',{spacing:.066});
for(const side of [-1,1]){
  for(let i=0;i<4;i++){
    const z=2.43+i*.235;
    beam('warsaw-jet-'+side+'-'+i,[side*.36,.413,z],[side*.19,.52,z+.049],.014,'fountain');
  }
}
for(let i=0;i<3;i++)box('trocadero-terrace-'+i,0,.273+i*.058,3.58+i*.125,2.66,.12,.19,'stone',{spacing:.075});
// A small riverboat, with its navigation lights at the two ends.
const bx=-2.44,bz=.43;
rock('bateau-hull',bx,.020,bz,1.23,.275,.46,'hull',{spacing:.057,yaw:-.09});
box('bateau-deck',bx,.151,bz,1.10,.063,.345,'stone',{yaw:-.09,spacing:.052});
box('bateau-cabin',bx-.03,.269,bz,.63,.185,.245,'glass',{yaw:-.09,spacing:.055});
box('bateau-roof',bx-.03,.380,bz,.70,.068,.29,'stone',{yaw:-.09,spacing:.056});
for (let i=0;i<4;i++) box('bateau-window-'+i,bx-.27+i*.15,.27,bz+.133+i*.014,.097,.085,.023,'ember',{spacing:.049});
rock('bateau-bow-light',bx+.53,.235,bz+.047,.076,.080,.076,'lamp',{spacing:.049});
rock('bateau-stern-light',bx-.52,.222,bz-.05,.066,.070,.066,'ember',{spacing:.049});

const recipe={
  title:'巴黎 · 塞纳河蓝调',locale:'zh-CN',seed:1889,background:'#141c31',spacing:.095,
  sun:[-.68,.85,.63],camera:{target:[0,2.25,-.20],dist:18.1,yaw:.57,pitch:.51},
  terrain:{radius:[5.56,4.50],height:.181,depth:.96,roughness:.17,edge:.12,
    surface:'leaf',cliff:'base',capCliff:'waterEdge',pathMaterial:'pavement',pathWidth:.16,
    hills:[[0,-2.35,.051,3.25,2.18],[0,3.40,.16,2.9,.62]]},
  water:{center:[0,.56],radius:[5.75,1.095],level:.044,baseLevel:.044,rectangular:true,
    shore:'waterEdge',floor:'base',dark:'#243f63',light:'#7095ad',reflection:.77,
    rippleA:[-2.1,.46],rippleB:[1.4,.72]},
  clearPaths:[[[-4.65,-.81],[4.66,-.81]],[[-4.18,1.98],[4.22,1.98]],
    [[-.86,2.10],[-.94,3.46],[-1.41,3.70]],[[.86,2.10],[.94,3.46],[1.41,3.70]],
    [[-3.60,-2.18],[-2.31,-3.80]],[[3.60,-2.18],[2.31,-3.80]]],
  extraColors:['#a58b86','#796579','#34597b','#47698b'],
  materials,shapes,lights,
};
fs.writeFileSync(process.argv[2],JSON.stringify(recipe));
