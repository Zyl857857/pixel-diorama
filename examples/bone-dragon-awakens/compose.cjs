'use strict';

const fs=require('node:fs');

const scene=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const groups=[];
function track(id,pivot,poses,parent){
  const keys=[{at:0},...poses.map(([at,rotation,shift])=>({at,rotation,shift})),{at:8}];
  groups.push({id,pivot,parent,keys});
}
track('chest',[.89,1.84,-.32],[
  [.9,[0,0,.018],[0,-.055,0]],
  [2.43,[.035,.027,-.071],[0,.085,0]],
  [3.92,[.019,-.014,-.095],[0,.10,.03]],
  [5.1,[-.024,0,.025],[0,-.025,0]],
  [6.48,[0,0,-.018],[0,.034,0]],
]);
track('neck',[-1.34,1.95,.28],[
  [1.04,[0,0,.07]],
  [2.35,[-.08,.10,-.26]],
  [3.9,[-.06,.13,-.31]],
  [5.19,[.04,-.035,.10]],
  [6.56,[0,0,-.058]],
],'chest');
track('skull',[-2.48,2.25,.95],[
  [1.10,[0,-.039,.091]],
  [2.58,[.13,.15,-.24]],
  [3.76,[.10,.14,-.31]],
  [4.98,[-.045,.013,.14]],
  [6.35,[0,-.021,-.06]],
],'neck');
track('lower-jaw',[-2.31,2.24,1.11],[
  [1.24,[0,0,-.085]],
  [2.45,[0,0,.28]],
  [3.60,[0,0,.45]],
  [4.62,[0,0,-.014]],
  [5.9,[0,0,.06]],
],'skull');
track('far-wing',[-.89,2.06,-.44],[
  [.60,[-.09,-.05,.05]],
  [1.60,[-.33,-.12,.20]],
  [3.35,[.35,.13,-.29]],
  [4.68,[-.22,.025,.22]],
  [5.59,[.16,.034,-.105]],
  [6.71,[-.047,0,.047]],
],'chest');
track('near-wing',[-.74,2.04,.27],[
  [.74,[.08,.032,-.045]],
  [1.82,[.34,.16,-.20]],
  [3.52,[-.39,-.13,.23]],
  [4.92,[.25,.022,-.24]],
  [5.97,[-.135,-.046,.12]],
  [6.91,[.036,0,-.032]],
],'chest');
track('far-wingtip',[-1.86,4.29,-2.72],[
  [1.84,[.035,-.16,.12]],
  [3.62,[-.065,.23,-.12]],
  [5.10,[.02,-.12,.11]],
  [6.25,[0,.066,0]],
],'far-wing');
track('near-wingtip',[1.42,4.21,1.78],[
  [2.05,[.03,.18,-.155]],
  [3.78,[-.05,-.20,.11]],
  [5.16,[.013,.14,-.10]],
  [6.34,[0,-.068,.025]],
],'near-wing');
track('tail-base',[1.11,1.71,-.20],[
  [1.8,[0,.09,0]],[3.5,[.03,-.20,.12]],[5.18,[-.06,.25,-.04]],[6.47,[0,-.070,.067]],
]);
track('tail-middle',[2.02,1.08,.58],[
  [2.0,[0,.1,-.03]],[3.85,[0,-.19,.15]],[5.42,[0,.26,-.09]],[6.71,[0,-.13,.077]],
],'tail-base');
track('tail-end',[3.0,1.36,1.42],[
  [2.3,[0,.13,-.06]],[4.12,[0,-.29,.21]],[5.66,[0,.31,-.08]],[7.0,[0,-.09,.08]],
],'tail-middle');
track('halo',[.20,2.85,-2.67],[
  [1.6,[0,.05,-.06],[0,-.035,0]],
  [3.75,[.035,-.09,.17],[.08,.08,0]],
  [5.62,[.02,-.025,.09],[.03,.05,0]],
]);
for(const shape of scene.shapes){
  const id=shape.id;
  const spinal=id.match(/^spinal-(?:body|crest)-(\d+)$/);
  if(spinal){
    const segment=Number(spinal[1]);
    shape.motion=segment<3?'neck':segment<9?'chest':segment<12?'tail-base':segment<15?'tail-middle':'tail-end';
  }else if(id.startsWith('rib-')){
    shape.motion='chest';
  }else if(/^(?:jaw-|lower-tooth-)/.test(id)){
    shape.motion='lower-jaw';
  }else if(/^(?:skull-|crown-|nose-|fang-)/.test(id)){
    shape.motion='skull';
  }else if(/^wing-(far|near)-/.test(id)){
    const side=id.split('-')[1];
    shape.motion=/^wing-(?:far|near)-finger-(?:4)(?:-|$)/.test(id)?side+'-wing':
      id.includes('-finger-')?side+'-wingtip':side+'-wing';
  }else if(id.startsWith('halo-')){
    shape.motion='halo';
  }
}
scene.title='骨龙 · 断环苏醒';
Object.assign(scene.camera,{target:[.20,2.43,-.20],dist:18.45,yaw:-.21,pitch:.37});
scene.motion={groups};
fs.writeFileSync(process.argv[3],JSON.stringify(scene));
