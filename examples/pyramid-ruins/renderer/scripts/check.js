'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {inflateSync}=require('node:zlib');
const {build}=require('./build');
const {generate}=require('./geometry');
const walking=require('./walking');
const sceneMotion=require('./motion');
const {compileAvatar}=require('./avatar');
const {renderPreview}=require('./preview');
const recipes=path.join(__dirname,'../assets/recipes');
const read=name=>JSON.parse(fs.readFileSync(path.join(recipes,name+'.json'),'utf8'));
const waterPoints=world=>{
  let count=0;
  for(let i=11;i<world.rows.length;i+=12) if(world.rows[i]===1) count++;
  return count;
};
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pixel-diorama-'));
try {
  for(const theme of ['cedar-spring','desert-observatory','rain-tram-stop']){
    const recipe=read(theme), world=generate(recipe), again=generate(recipe);
    assert.deepEqual(world.rows,again.rows);
    assert.ok(world.rows.every(Number.isFinite));
    assert.notDeepEqual(renderPreview(world),renderPreview(world,.78));
    const file=path.join(temp,theme+'.html');
    build(path.join(recipes,theme+'.json'),file,true);
    const page=fs.readFileSync(file,'utf8');
    const [,width,height]=page.match(/<canvas id="canvas" width="(\d+)" height="(\d+)"/);
    const poster=Buffer.from(page.match(/<img id="poster" src="data:image\/png;base64,([^"]+)"/)[1],'base64');
    assert.deepEqual([Number(width),Number(height)],[384,288]);
    assert.deepEqual([poster.readUInt32BE(16),poster.readUInt32BE(20)],[Number(width),Number(height)]);
    assert.doesNotMatch(page,/<(?:link|script|img)[^>]+(?:src|href)=["']https?:/i);
    assert.doesNotMatch(page,/\b(?:fetch|XMLHttpRequest)\s*\(/);
    const scene=JSON.parse(page.match(/<script id="scene" type="application\/json">(.+?)<\/script>/)[1]);
    assert.equal(world.meta.count,scene.count);
    assert.equal(scene.walk,undefined);
    assert.equal(scene.motion,undefined);
    assert.deepEqual(inflateSync(Buffer.from(scene.data,'base64')),Buffer.from(world.rows.buffer));
    console.log(theme+': '+scene.count+' splats, '+Buffer.byteLength(page)+' bytes');
  }
  const recipe=read('cedar-spring'), low=generate(recipe);
  const high=generate({...recipe,water:{...recipe.water,level:.36}});
  for(const shape of recipe.shapes.filter(s=>s.anchor!=='ground')) {
    assert.deepEqual(high.shapePositions[shape.id],low.shapePositions[shape.id]);
  }
  const reeds=world=>Object.entries(world.shapePositions).filter(([id])=>id.startsWith('bank-rushes-'));
  assert.notDeepEqual(reeds(low),reeds(high));
  assert.ok(waterPoints(high)>waterPoints(low));
  console.log('Water rise: '+waterPoints(low)+' → '+waterPoints(high)+' samples; authored anchors stable');
  const bounds=(x,z)=>Math.hypot(x/3,z/2)-1;
  const surface=(x,z)=>x*.12;
  const pool=(x,z)=>Math.hypot(x,z-.78)-.32;
  const blockers=[{id:'wall',kind:'box',at:[.5,0,0],size:[.3,1,.8],yaw:0}];
  const map=walking.bake({spawn:[-.7,0],blockers:['wall'],hazards:[[1,1,.3]]},
    [3,2],bounds,surface,pool,blockers);
  assert.throws(()=>walking.bake({spawn:[0,.78]},[3,2],bounds,surface,pool,blockers),/outside/);
  assert.equal(walking.ground(map,0,.78),null);
  assert.equal(walking.ground(map,1,1),null);
  const dome=walking.bake({spawn:[-2,0],blockers:['dome']},[3,2],bounds,surface,
    ()=>Infinity,[{id:'dome',kind:'dome',at:[0,0,0]}]);
  assert.equal(walking.ground(dome,.76,0),null);
  const mover=walking.spawn(map);
  for(let t=0;t<40;t++)walking.step(map,mover,1,0,0,.045);
  assert.ok(mover.x>-.25&&mover.x<.3);
  assert.ok(Math.abs(mover.y-mover.x*.12)<.013);
  for(let t=0;t<120;t++)walking.step(map,mover,0,1,0,.045);
  assert.ok(mover.z<-.9&&mover.z>-2);
  assert.notEqual(walking.ground(map,mover.x,mover.z),null);
  const demo=generate({...recipe,walk:{spawn:[-2.85,1.42],blockers:['hut-walls']}});
  assert.ok(demo.meta.walk.heights.length>100);
  assert.ok(demo.meta.avatar.some(pixel=>pixel[2]<0));
  const keeper=generate({...recipe,walk:{spawn:[-2.85,1.42],avatar:'spring-keeper'}});
  assert.ok(keeper.meta.avatar.some(([x,,, ,part])=>part===3&&x>=4));
  assert.notDeepEqual(keeper.meta.avatar,demo.meta.avatar);
  assert.deepEqual(compileAvatar({blocks:[{part:'arm-left',from:[2,1,0],to:[2,1,0],color:'#00ffaa'}]}).pixels,
    [[2,1,0,0x00ffaa,2]]);
  assert.throws(()=>compileAvatar('unknown'),/known preset/);
  const hero=walking.spawn(map);
  walking.step(map,hero,0,1,0,.06);
  assert.ok(Math.abs(hero.facing+.30)>.4);
  assert.equal(walking.ground(demo.meta.walk,-2.53,-1.16),null);
  const paver={id:'paver',kind:'box',at:[-.9,.05,0],size:[.6,.4,.8],yaw:.4};
  const lane=walking.bake({spawn:[-.9,0],surfaces:['paver'],showAvatar:true,facing:.48},[3,2],bounds,
    ()=>.07,()=>Infinity,[paver]);
  const walker=walking.spawn(lane);
  assert.equal(walker.y,.25);
  assert.equal(walker.facing,.48);
  assert.equal(lane.showAvatar,true);
  assert.equal(walking.ground(lane,0,0),.07);
  walking.step(lane,walker,0,1,0,.033);
  const movingGait=walker.gait;
  assert.ok(movingGait>0&&walker.travel>0);
  walking.step(lane,walker,0,0,0,.033);
  assert.ok(walker.gait>0&&walker.gait<movingGait);
  assert.ok(compileAvatar('ash-keeper').pixels.some(([x,,,color,part])=>x>=5&&color===0xffb353&&part===3));
  console.log('Walk mode: terrain height, collision, water, hazard and boundary checks passed');

  const clip={groups:[
    {id:'arm',pivot:[0,0,0],keys:[{at:0},{at:4,rotation:[0,0,Math.PI/2]},{at:8}]},
    {id:'tip',parent:'arm',pivot:[1,0,0],keys:[{at:0},{at:4,shift:[1,0,0]},{at:8}]},
  ]};
  const part={id:'detail',motion:'tip'};
  const rig=sceneMotion.compile(clip,[part]);
  rig.groups[1].range=[1,2];
  const sample=[1,0,0,1,4,0,0,0x121212,2,0,1,0];
  const rest=Float32Array.from([...sample,...sample]);
  const animated=rest.slice();
  sceneMotion.apply(rig.groups,4,rest,animated);
  const expected=[0,2,0,1,2,0,0,0x121212,4,0,1,0];
  assert.deepEqual(animated.slice(0,12),rest.slice(0,12));
  assert.ok(expected.every((value,i)=>Math.abs(animated[i+12]-value)<1e-6));
  sceneMotion.apply(rig.groups,8,rest,animated);
  assert.deepEqual(animated,rest);
  assert.throws(()=>sceneMotion.compile(clip,[part],[part.id]),/walk blockers/);
  assert.throws(()=>sceneMotion.compile({groups:[...clip.groups].reverse()},[part]),/parent/);

  const parcel={
    id:'smoke',pivot:[0,0,0],parent:'wind',sampled:true,
    keys:[{at:0,opacity:0},{at:4,scale:[3,1,1],opacity:.6},{at:8,opacity:0}],
  };
  const wind={id:'wind',pivot:[0,0,0],keys:[{at:0},{at:4,opacity:.2},{at:8}]};
  const smoke=sceneMotion.compile({groups:[wind,parcel]},[{id:'plume',motion:'smoke'}]).groups;
  smoke[1].range=[0,1];
  const plume=Float32Array.from(sample), frame=plume.slice();
  sceneMotion.apply(smoke,2,plume,frame);
  assert.equal(frame[0],2);
  assert.equal(frame[4],16);
  assert.ok(Math.abs(frame[3]-.18)<1e-6);
  sceneMotion.apply(smoke,0,plume,frame);
  assert.equal(frame[3],0);
  const opening=frame.slice();
  sceneMotion.apply(smoke,8,plume,frame);
  assert.deepEqual(opening,frame);
  assert.throws(()=>sceneMotion.compile({groups:[wind,{...parcel,keys:[...parcel.keys.slice(0,2),{at:8}]}]},
    [{id:'plume',motion:'smoke'}]),/matching first and last poses/);

  const dragon=read('bone-dragon-awakens');
  const moving=generate(dragon), still=generate(read('bone-dragon'));
  assert.equal(moving.meta.count,still.meta.count);
  assert.equal(still.meta.motion,undefined);
  const ranges=moving.meta.motion.groups.map(group=>group.range);
  assert.equal(ranges[0][0],moving.meta.motion.first);
  assert.equal(ranges.at(-1)[1],moving.meta.count);
  assert.ok(ranges.every(([start,end],i)=>end>start&&(i===0||start===ranges[i-1][1])));
  const animation=path.join(temp,'bone-dragon-awakens.html');
  build(path.join(recipes,'bone-dragon-awakens.json'),animation);
  assert.match(fs.readFileSync(animation,'utf8'),/sceneMotion\?\.apply/);
  console.log('Motion: parent inheritance, covariance, loop seam and sample ranges passed');

} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
