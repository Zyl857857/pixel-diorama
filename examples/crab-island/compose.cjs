const fs = require('node:fs');
const shapes = [];
const groups = [];
const add = (id, kind, at, material, options = {}) => shapes.push({id, kind, at, material, ...options});
const rock = (id, at, size, material, options = {}) => add(id, 'rock', at, material, {size, ...options});
const box = (id, at, size, material, options = {}) => add(id, 'box', at, material, {size, ...options});
const beam = (id, at, to, radius, material, options = {}) => add(id, 'beam', at, material, {to, radius, ...options});
const curve = (id, nodes, radii, material, options = {}) => {
  for (let i = 0; i < nodes.length - 1; i++) {
    beam(id+'-'+i, nodes[i], nodes[i+1], radii[i], material, {...options, endRadius:radii[i+1]});
    if (i) rock(id+'-knuckle-'+i, nodes[i], Array(3).fill(radii[i]*2.18), material, options);
  }
};
const ring = (id, at, radius, material, {height=.12,...options}={}) =>
  add(id, 'cylinder', at, material, {radius,height,...options});
const ramp = (colors, settings={}) => ({ramp:colors.split(' ').map(color=>'#'+color), ...settings});
const flip = (side, [x,y,z]) => [x*side,y,z];

const recipe = {
  title:'断潮岛 · 巨钳守卫', seed:48103, locale:'zh-CN',
  background:'#0c1825', sun:[-.78,1.0,.80], spacing:.087,
  camera:{target:[0,.95,-.02],dist:16.5,yaw:.24,pitch:.50},
  terrain:{radius:[6.35,5.0], height:.30, depth:.55, roughness:.155, edge:.10,
    surface:'beach', cliff:'deep', capCliff:'deep', pathMaterial:'stone', pathWidth:.25,
    hills:[[-2.8,-2.1,.52,1.38,1.04],[2.6,-1.94,.27,1.4,1.02],[0,-1.3,.1,2.1,1.5]]},
  water:{center:[0,0], radius:[6.35,5], level:-.025, baseLevel:-.025,
    island:{radius:[4.45,3.58],foam:'foam'}, shore:'beach',floor:'deep',
    dark:'#133d58',light:'#54c8c4',reflection:.19,rippleA:[-3.94,2.4],rippleB:[4.11,1.98]},
  materials:{
    deep:ramp('0b2438 13384e 1c5062 2b7180',{pattern:'strata',texture:.56}),
    beach:ramp('503637 80604d ad8a64 d8b683 f1ca90',{texture:.46}),
    stone:ramp('172434 2b3a45 485656 6e7163 9b9981',{texture:.63,pattern:'strata'}),
    foam:ramp('61a9ac aee8d7 e3f7dc',{glow:true}),
    shell:ramp('39162b 66213a a33947 d55247 f57551',{texture:.42}),
    lacquer:ramp('662739 a83d43 e35f4c f9915a ffb474',{texture:.34}),
    joint:ramp('1c1a2b 362238 582938 86433f',{texture:.28}),
    gold:ramp('61423e b67b48 e9a75d ffe19a',{texture:.28}),
    shine:ramp('ffb474 ffe19a fff3c6',{glow:true}),
    leaf:ramp('15393c 255c52 438268 7aa378',{texture:.49}),
    wood:ramp('342737 64423d 99674b c38c5f',{pattern:'planks',texture:.32}),
    steel:ramp('263b57 50718a 87aeb1 c6d6cc e3f7dc',{texture:.24}),
    cloth:ramp('123756 165a7a 2e94a3 65c7c5',{texture:.28}),
  },
  clearPaths:[[[-1.28,3.03],[-.28,2.15],[.15,1.15],[.22,.54]]],
  scatter:[
    {id:'lava-pebbles',kind:'rock',bounds:[-4,-3.2,4,3.1],count:25,material:'stone',minSize:.09,maxSize:.30,
      waterMin:.07,clearance:.8,separation:.41},
    {id:'dune-reeds',kind:'reed',bounds:[-4,-3.0,4,3.0],count:21,material:'leaf',minSize:.11,maxSize:.34,
      waterMin:.08,waterMax:.26,clearance:1.0,separation:.26}
  ],
  lights:[
    {at:[.0,2.42,.6],color:'#ff8154',radius:1.4,gain:.49},
    {at:[-.5,.71,2.39],color:'#79dad7',radius:1.20,gain:.49}
  ],
  shapes,
  motion:{groups}
};

const bossZ=-1.00;
rock('abdomen',[0,1.64,bossZ+.03],[2.66,1.25,1.73],'joint',{accent:'shell',spacing:.058,shadow:2.2,keepOut:2.35});
rock('carapace-rim',[0,2.10,bossZ],[3.16,.69,2.09],'shell',{accent:'lacquer',spacing:.058});
rock('carapace-crown',[0,2.29,bossZ-.22],[2.83,1.02,1.81],'shell',{accent:'lacquer',spacing:.056,yaw:-.06});
rock('carapace-saddle',[0,2.52,bossZ-.36],[1.58,.69,.92],'lacquer',{accent:'shell',spacing:.056});
for (const side of [-1,1]) {
  const f = point=>flip(side,point);
  for (let i=0;i<5;i++) {
    const x=.58+i*.175,y=2.48-i*.046,z=-1.61+i*.26;
    rock(`keel-${side}-${i}`,f([x,y,z]),[.42,.31,.51],'shell',{accent:'lacquer',spacing:.053,yaw:side*.33});
  }
  for (let i=0;i<4;i++) {
    const x=.99+i*.15,z=-1.63+i*.34;
    curve(`shell-spike-${side}-${i}`,[f([x,2.33,z]),f([x+.16,2.57,z-.10]),f([x+.28,2.79-i*.08,z-.17])],
      [.23,.14,.026],'shell',{spacing:.056});
  }
  for (let i=0;i<4;i++) {
    const root=f([1.05-i*.085,1.66-i*.05,-.57-i*.39]);
    const knee=f([2.03+i*.04,1.57-i*.115,-.23-i*.62]);
    const ankle=f([2.58+i*.08,.73-i*.055,.09-i*.74]);
    const foot=f([2.90+i*.035,.28,.43-i*.79]);
    const id=`walking-leg-${side}-${i}`;
    curve(id+'-upper',[root,knee],[.30-i*.016,.21-i*.013],'shell',{spacing:.063});
    rock(id+'-socket',knee,[.50-i*.059,.48-i*.035,.45-i*.043],'joint',{accent:'lacquer',spacing:.059});
    curve(id+'-lower',[knee,ankle,foot],[.21-i*.014,.124-i*.008,.032],'shell',{spacing:.059});
  }
  const eye=f([.65,2.42,-.022]);
  curve(`eyestalk-${side}`,[f([.50,2.11,-.25]),f([.58,2.35,-.10]),eye],[.18,.12,.09],'joint',{spacing:.049});
  rock(`eye-socket-${side}`,eye,[.35,.29,.25],'joint',{accent:'shell',spacing:.049});
  rock(`eye-${side}`,f([.66,2.438,.087]),[.21,.145,.101],'shine',{spacing:.049});
  beam(`brow-${side}`,f([.45,2.48,.107]),f([.81,2.61,.075]),.066,'lacquer',{endRadius:.09,spacing:.049});
  curve(`mouth-flank-${side}`,[f([.55,1.83,.02]),f([.39,1.63,.125]),f([.18,1.70,.16])],
    [.108,.105,.034],'lacquer',{spacing:.054});

  const high = side===-1;
  const root=f([1.13,1.81,-.40]);
  const elbow=f([1.90,high?2.10:1.58,.35]);
  const wrist=f([2.26,high?2.45:1.36,1.07]);
  const claw=`claw-${side}`, jaw=`jaw-${side}`;
  groups.push({id:claw,pivot:root,keys:[
    {at:0},{at:1.2,rotation:[high?-.10:.09,0,side*.05]},
    {at:2.8,rotation:[high?-.25:-.09,side*.08,side*.15]},
    {at:3.65,rotation:[high?.16:.13,side*.12,side*.012]},
    {at:4.3,rotation:[high?.07:.1,side*.055,0]},
    {at:6.28,rotation:[-.055,-side*.044,0]},{at:8}
  ]});
  groups.push({id:jaw,parent:claw,pivot:wrist,keys:[
    {at:0},{at:2.8,rotation:[.14,0,0]},{at:3.65,rotation:[-.25,0,0]},
    {at:4.3,rotation:[-.19,0,0]},{at:6.1,rotation:[.08,0,0]},{at:8}
  ]});
  curve(claw+'-arm',[root,elbow,wrist],[.35,.36,.31],'shell',{spacing:.059,motion:claw});
  rock(claw+'-arm-cuff',elbow,[.74,.68,.73],'joint',{accent:'lacquer',spacing:.061,motion:claw});
  const y=wrist[1];
  rock(claw+'-palm',f([2.16,y+.09,1.34]),high?[1.19,1.00,1.31]:[1.01,.83,1.08],'shell',
    {accent:'lacquer',yaw:side*-.23,spacing:.052,motion:claw});
  rock(claw+'-crown',f([2.28,y+.35,1.34]),[.72,.60,.81],'lacquer',{spacing:.053,motion:claw});
  const upper=[[2.28,y+.29,1.45],[2.17,y+.55,1.91],[1.85,y+.54,2.30],[1.52,y+.39,2.50],[1.31,y+.21,2.51]];
  const lower=[[2.19,y-.17,1.32],[2.04,y-.37,1.82],[1.74,y-.39,2.28],[1.47,y-.29,2.53],[1.26,y-.11,2.60]];
  curve(claw+'-fixed-finger',upper.map(f),[.36,.30,.219,.13,.029],'lacquer',{spacing:.049,motion:claw});
  curve(jaw+'-moving-finger',lower.map(f),[.30,.25,.164,.104,.029],'shell',{spacing:.049,motion:jaw});
  for (let i=0;i<3;i++) {
    const [x,h,z]=upper[i+1];
    curve(claw+'-tooth-'+i,[f([x,h-.15,z]),f([x-.067,h-.31+i*.026,z+.02])],[.099-i*.017,.025],
      'gold',{spacing:.049,motion:claw});
  }
}
rock('mandible-center',[0,1.72,.16],[.39,.24,.23],'joint',{spacing:.051});
for(let i=0;i<3;i++) {
  const z=-.63-i*.31;
  beam('shell-scar-'+i,[-.31+i*.05,2.69+i*.035,z],[.22+i*.05,2.72+i*.04,z-.26],.038,'gold',
    {spacing:.049,endRadius:.022});
}

const hero = [-.40,.31,2.33];
const heroYaw=-.17;
const h = ([x,y,z])=>[hero[0]+x*Math.cos(heroYaw)+z*Math.sin(heroYaw),hero[1]+y,
  hero[2]+z*Math.cos(heroYaw)-x*Math.sin(heroYaw)];
const heroBox = (id,at,size,mat,options={})=>box('hero-'+id,h(at),size,mat,{yaw:heroYaw,spacing:.049,...options});
const heroRock = (id,at,size,mat,options={})=>rock('hero-'+id,h(at),size,mat,{yaw:heroYaw,spacing:.049,...options});
const heroBeam=(id,at,to,rad,mat,options={})=>beam('hero-'+id,h(at),h(to),rad,mat,{spacing:.049,...options});
heroRock('left-boot',[-.145,.062,-.18],[.20,.164,.33],'joint',{shadow:.62});
heroRock('right-boot',[.15,.05,.14],[.21,.16,.29],'joint');
heroBeam('left-shin',[-.146,.12,-.20],[-.115,.42,-.105],.083,'steel');
heroBeam('right-shin',[.15,.12,.15],[.12,.42,.075],.081,'steel');
heroBlock();
function heroBlock() {
  heroBox('belt',[0,.465,.005],[.36,.11,.235],'wood');
  heroBox('belt-buckle',[0,.47,-.127],[.105,.072,.044],'gold');
  heroRock('cuirass',[0,.64,-.025],[.51,.39,.32],'steel',{accent:'steel'});
  heroBox('gorget',[0,.81,-.042],[.235,.08,.22],'gold');
  heroBox('helmet',[0,.945,-.06],[.315,.25,.30],'steel');
  heroBox('visor',[0,.935,-.219],[.242,.075,.05],'joint');
  heroBox('faceguard',[0,.886,-.234],[.071,.103,.048],'steel');
  heroRock('crest',[0,1.099,.018],[.135,.16,.31],'lacquer');
  heroRock('pauldron-left',[-.252,.725,-.033],[.215,.18,.204],'steel');
  heroRock('pauldron-right',[.251,.708,-.045],[.215,.17,.22],'gold');
  heroBeam('left-arm',[-.26,.68,-.05],[-.40,.60,-.29],.084,'steel');
  heroBeam('right-arm',[.26,.68,-.05],[.38,.66,-.26],.081,'steel');
  heroRock('gauntlet',[.38,.66,-.27],[.15,.15,.17],'steel');
  heroRock('shield-rim',[-.41,.59,-.31],[.424,.50,.17],'gold');
  heroRock('shield',[-.427,.59,-.358],[.326,.405,.138],'cloth');
  heroRock('shield-boss',[-.445,.59,-.414],[.133,.136,.075],'gold');
  for (let i=0;i<5;i++) {
    const x=-.187+i*.095;
    heroBox('cape-'+i,[x,.50-.045*Math.sin(i*.75),.159+.018*i],
      [.125,.57+.08*Math.sin(i),.064],'cloth',{tilt:-.40+i*.024});
  }
  heroBeam('sword-grip',[.345,.584,-.175],[.426,.716,-.349],.057,'joint');
  heroBeam('sword-crossguard',[.292,.772,-.407],[.562,.722,-.365],.043,'gold');
  heroBeam('sword-blade',[.429,.76,-.39],[.574,1.12,-.977],.075,'steel',{endRadius:.040});
  heroBeam('sword-point',[.574,1.12,-.977],[.623,1.223,-1.094],.040,'shine',{endRadius:.012});
  heroBeam('sword-edge',[.468,.773,-.379],[.616,1.165,-1.03],.022,'shine',{endRadius:.015});
}

// One broken basalt outcrop and palms enclose the rear without competing with the two figures.
const stacks=[
  [-3.52,-1.15,.34,1.50],[-3.55,-1.66,.43,1.91],[-3.21,-2.18,.46,2.54],
  [-2.86,-2.58,.39,2.18],[-2.45,-2.68,.31,1.42],[-3.98,-.71,.28,.88],
  [3.59,-.76,.27,.78],[3.74,-1.12,.33,1.04],[3.55,-1.56,.33,1.19],
];
stacks.forEach(([x,z,r,height],i)=>{
  add('basalt-spire-'+i,'cone',[x,-.045,z],'stone',{radius:r,topRadius:r*.76,height,anchor:'ground',
    tilt:i%2?.10:-.04,spacing:.074,shadow:r*2,keepOut:r});
  rock('basalt-cap-'+i,[x,height-.08,z-.08],[r*1.95,r*.63,r*1.62],'stone',{anchor:'ground',spacing:.071});
  rock('basalt-foot-'+i,[x+.12,.17,z+.16],[r*2.66,.59,r*2.1],'stone',{anchor:'ground',spacing:.073});
});
function palm(id,x,z,yaw,scale) {
  const p=([a,b,c])=>[x+scale*(a*Math.cos(yaw)+c*Math.sin(yaw)),.46+b*scale,
    z+scale*(c*Math.cos(yaw)-a*Math.sin(yaw))];
  curve(id+'-trunk',[[0,-.29,0],[.03,.53,0],[.13,1.08,0],[.27,1.67,0],[.46,2.11,.03]].map(p),
    [.125,.119,.102,.085,.065].map(r=>r*scale),'wood',{spacing:.057});
  for (let i=0;i<7;i++) {
    const a=i*Math.PI*2/7, length=(.72+(i%3)*.16)*scale;
    const point=(t,side=0)=>p([.46+Math.cos(a)*length*t-Math.sin(a)*side,
      2.11+.37*Math.sin(t*Math.PI*.93)-.31*t*t,.03+Math.sin(a)*length*t+Math.cos(a)*side]);
    beam(id+'-spine-'+i,point(0),point(.47),.062*scale,'leaf',{endRadius:.045,spacing:.055});
    beam(id+'-tip-'+i,point(.47),point(1.18),.053*scale,'leaf',{endRadius:.019,spacing:.051});
    for (let j=0;j<5;j++) for(const sign of [-1,1]) {
      const t=.17+j*.166, width=(.12+.15*Math.sin(t*Math.PI))*scale;
      beam(id+'-leaf-'+i+'-'+j+'-'+sign,point(t),point(t+.14,sign*width),.062*scale,'leaf',
        {endRadius:.015,spacing:.051});
    }
  }
  rock(id+'-crown',p([.46,2.113,.03]),[.26*scale,.31*scale,.24*scale],'leaf',{spacing:.055});
}
palm('palm-a',2.97,-2.03,.28,1.0);
palm('palm-b',2.19,-2.73,-.58,.73);

// Tide-buried ruins, broken mooring post, shells, and a few colored fragments around the shore.
for (let i=0;i<9;i++) {
  const x=-1.13+i*.245,z=2.89-i*.199;
  box('buried-step-'+i,[x,.024,z],[.44-i*.012,.103,.28],'stone',
    {anchor:'ground',yaw:.31+(i%3)*.23,spacing:.067});
}
for (const [i,x,z,angle] of [[0,-2.94,1.66,.19],[1,-2.66,1.39,.46],[2,-2.44,1.57,-.14],[3,3.54,.87,.23]]) {
  box('ruin-foot-'+i,[x,.075,z],[.52,.22,.49],'stone',{anchor:'ground',yaw:angle});
  box('ruin-block-'+i,[x,.2,z],[.35,.31,.3],'stone',{anchor:'ground',yaw:angle,tilt:.17-i*.057});
}
for (let i=0;i<5;i++) {
  const x=2.99+i*.134,z=1.43+i*.145;
  box('wreck-plank-'+i,[x,.34+i*.012,z],[.84-i*.086,.09,.108],'wood',
    {yaw:-.51+i*.10,tilt:.2-i*.06,spacing:.054});
}
for (let i=0;i<12;i++) {
  const a=.8+i*.38,x=Math.cos(a)*(3.16+.54*Math.sin(i*8)),z=Math.sin(a)*(2.64+.22*Math.cos(i*3));
  rock('shell-fragment-'+i,[x,.07,z],[.14+.062*(i%3),.13,.17],'gold',{anchor:'ground',yaw:i*.77,spacing:.053});
}
for (const [index,x,z] of [[0,-3.68,.59],[1,3.89,.47],[2,2.01,2.72],[3,-1.92,2.71]]) {
  for (let i=0;i<4;i++) {
    const a=i*2.39996,
      px=x+.11*Math.sin(a),pz=z+.12*Math.cos(a);
    curve('coral-'+index+'-'+i,[[px,.16,pz],[px+.09*Math.sin(a),.36+i*.034,pz+.08*Math.cos(a)],
      [px+.17*Math.sin(a),.41+i*.049,pz+.17*Math.cos(a)]],[.068,.059,.023],'lacquer',{spacing:.053});
  }
}
fs.writeFileSync(process.argv[2],JSON.stringify(recipe,null,2));
