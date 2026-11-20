'use strict';

const walking=require('./walking');
const {compileAvatar}=require('./avatar');
const sceneMotion=require('./motion');

const MAX_SPLATS = 215_000;
const MAX_SCENE_COLORS = 56;
const MAX_PALETTE_COLORS = 72;
const TAU = Math.PI * 2;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); };
const smooth = a => { a = clamp(a); return a * a * (3 - 2*a); };
const flat = n => Math.round(n * 16384) / 16384;
const point3 = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

function hex(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error('Expected a six-digit hex color, got ' + value);
  }
  return parseInt(value.slice(1), 16);
}
const rgb = value => [value >> 16 & 255, value >> 8 & 255, value & 255];
const pack = ([r,g,b]) => Math.round(r) + 256*Math.round(g) + 65536*Math.round(b);

function hash(word) {
  let result = 2166136261;
  for (const c of String(word)) result = Math.imul(result ^ c.charCodeAt(0), 16777619);
  return result >>> 0;
}
function rand(seed, x, y = 0, z = 0) {
  let a = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  a = Math.imul(a ^ a >>> 13, 1274126177);
  return ((a ^ a >>> 16) >>> 0) / 4294967296;
}
function noise(seed, x, z) {
  const i = Math.floor(x), j = Math.floor(z);
  const u = smooth(x-i), v = smooth(z-j);
  return mix(mix(rand(seed,i,j),rand(seed,i+1,j),u),
    mix(rand(seed,i,j+1),rand(seed,i+1,j+1),u),v);
}

function validate(recipe) {
  if (!recipe || typeof recipe.title !== 'string' || !recipe.title.trim() || !Number.isInteger(recipe.seed)) {
    throw new Error('Set a scene title and integer seed');
  }
  const terrain = recipe.terrain;
  if (!terrain || !Array.isArray(terrain.radius) || terrain.radius.length !== 2 ||
      terrain.radius.some(v => !Number.isFinite(v) || v < 1 || v > 10)) {
    throw new Error('Terrain radius needs two numbers from 1 to 10');
  }
  if (!recipe.materials || !Object.keys(recipe.materials).length) throw new Error('Provide materials');
  const materials = {};
  for (const [id, material] of Object.entries(recipe.materials)) {
    if (!Array.isArray(material.ramp) || material.ramp.length < 2) throw new Error('Missing ramp for ' + id);
    materials[id] = {...material, ramp: material.ramp.map(hex)};
  }
  const requireMaterial = (id, label) => {
    if (!Object.hasOwn(materials,id)) throw new Error(label + ' uses unknown material ' + id);
  };
  requireMaterial(terrain.surface,'terrain.surface');
  requireMaterial(terrain.cliff,'terrain.cliff');
  if (terrain.capCliff) requireMaterial(terrain.capCliff,'terrain.capCliff');
  if (terrain.pathMaterial) requireMaterial(terrain.pathMaterial,'terrain.pathMaterial');
  if (recipe.water) {
    const water = recipe.water;
    if (!Array.isArray(water.center) || water.center.length !== 2 || !water.center.every(Number.isFinite) ||
        !Array.isArray(water.radius) || water.radius.length !== 2 ||
        water.radius.some(n => !Number.isFinite(n) || n <= 0) || !Number.isFinite(water.level)) {
      throw new Error('Water requires center, radius and level');
    }
    requireMaterial(water.shore,'water.shore');
    requireMaterial(water.floor,'water.floor');
  }
  if (recipe.effect && (!['snow','rain','dust','mist'].includes(recipe.effect.type) ||
      recipe.effect.count!==undefined && (!Number.isInteger(recipe.effect.count) || recipe.effect.count<0 || recipe.effect.count>300))) {
    throw new Error('Use snow, rain, dust or mist with a particle count from 0 to 300');
  }
  if (recipe.effect?.origins!==undefined &&
      (!Array.isArray(recipe.effect.origins) || !recipe.effect.origins.length || !recipe.effect.origins.every(point3))) {
    throw new Error('Effect origins need at least one XYZ anchor');
  }
  const ids = new Set();
  for (const shape of recipe.shapes ?? []) {
    if (typeof shape.id!=='string' || !shape.id || ids.has(shape.id) || !point3(shape.at)) throw new Error('Give each shape a unique id and an XYZ position');
    ids.add(shape.id);
    if (!['box','rock','cylinder','cone','dome','dish','gable','fir','reed','beam','tube','sheet'].includes(shape.kind)) {
      throw new Error('Unknown shape ' + shape.kind + ' for ' + shape.id);
    }
    requireMaterial(shape.material, shape.id);
    if (shape.accent) requireMaterial(shape.accent, shape.id);
    if (shape.face) requireMaterial(shape.face, shape.id);
    if (['box','gable'].includes(shape.kind) && (!point3(shape.size) || shape.size.some(n=>n<=0))) {
      throw new Error(shape.id + ' needs three positive dimensions');
    }
    if (shape.size && (!point3(shape.size) || shape.size.some(n=>n<=0))) throw new Error('Invalid size for ' + shape.id);
    for (const key of ['radius','height','spacing','shadow']) {
      if (shape[key]!==undefined && (!Number.isFinite(shape[key]) || shape[key]<=0)) throw new Error('Invalid ' + key + ' for ' + shape.id);
    }
    if (shape.trunk) requireMaterial(shape.trunk, shape.id);
    if (shape.kind === 'beam' && !point3(shape.to)) throw new Error(shape.id + ' needs a beam endpoint');
  }
  if (recipe.scatter) for (const field of recipe.scatter) {
    requireMaterial(field.material, field.id);
    if (field.accent) requireMaterial(field.accent, field.id);
    if (field.trunk) requireMaterial(field.trunk, field.id);
    if (!field.id || !Number.isInteger(field.count) || field.count < 0 || field.count > 200 ||
        !['rock','fir','reed'].includes(field.kind) || !Array.isArray(field.bounds) || field.bounds.length !== 4 ||
        !field.bounds.every(Number.isFinite)) throw new Error('Invalid scatter field');
  }
  const camera = recipe.camera ?? {target:[0,.6,0],dist:16,yaw:-.35,pitch:.60};
  if (!point3(camera.target) || !(camera.dist > 0) || !Number.isFinite(camera.yaw) || !Number.isFinite(camera.pitch)) {
    throw new Error('Invalid camera');
  }
  return materials;
}

function generate(recipe) {
  const materials = validate(recipe);
  const { terrain, water } = recipe;
  const motion=recipe.motion===undefined?null:sceneMotion.compile(recipe.motion,recipe.shapes??[],recipe.walk?.blockers);
  if(!motion && recipe.shapes?.some(shape=>shape.motion!==undefined)) throw new Error('Shape motion needs a scene motion configuration');
  const seed = recipe.seed | 0;
  const [rx, rz] = terrain.radius;
  const spacing = clamp(recipe.spacing ?? .105, .067, .21);
  const sun = unit(recipe.sun ?? [-.7,1,.52]);
  const rows = [];
  const shapePositions = Object.create(null);
  const waterExpansion=water?clamp(1+(water.level-(water.baseLevel??.08))*.59,.68,1.42):1;
  const island = water?.island;
  const shoreDistance = (x,z) => {
    const u = x / island.radius[0], v = z / island.radius[1];
    const angle = Math.atan2(v,u);
    const shape = 1 + .09*Math.sin(3*angle + .45) + .032*Math.cos(7*angle - .5);
    return Math.hypot(u,v) - shape;
  };
  const aperture = (x,z) => {
    if (island) return -shoreDistance(x,z);
    if (!water) return Infinity;
    if (water.river) {
      const center = .94 + .43*Math.sin(.91*z+.30) + .27*Math.sin(.43*z-.9);
      const width = .51 + .38*Math.exp(-((z+.50)**2)/4.0) + .16*Math.exp(-((z-1.25)**2)/.63) + .24*Math.exp(-((z+2.70)**2)/.80);
      const banks = Math.abs(x-center+.065*Math.cos(z*5.1)) - width;
      return Math.max(banks,-3.88-z);
    }
    const u = (x-water.center[0])/(water.radius[0]*waterExpansion);
    const v = (z-water.center[1])/(water.radius[1]*waterExpansion);
    const theta = Math.atan2(v,u);
    if (water.rectangular) return Math.max(Math.abs(u),Math.abs(v)) - 1;
    return Math.hypot(u,v) - 1 + .05*Math.sin(3*theta+.7) + .036*Math.cos(5*theta);
  };
  const radial = (x,z) => {
    const a = Math.atan2(z/rz,x/rx);
    return Math.hypot(x/rx,z/rz) - 1 + (terrain.edge ?? .09) *
      (.65*Math.sin(a*3+2*rand(seed,13))+.35*Math.sin(a*7+2.5*rand(seed,15)));
  };
  const pathDistance = (x,z) => {
    let best = Infinity;
    for (const path of recipe.clearPaths ?? []) {
      for (let i=1;i<path.length;i++) {
        const a=path[i-1], b=path[i], dx=b[0]-a[0], dz=b[1]-a[1];
        const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1));
        best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
      }
    }
    return best;
  };
  function height(x,z) {
    let y=(terrain.height ?? .12)+(terrain.roughness ?? .24) *
      (.7*(noise(seed,x*1.3,z*1.3)-.5)+.3*(noise(seed+7,3*x,3*z)-.5));
    for (const h of terrain.hills ?? []) {
      const [hx,hz,amp,sx,sz]=h;
      const d=((x-hx)/sx)**2+((z-hz)/sz)**2;
      y+=amp*Math.exp(-d*2);
    }
    if (island) {
      const d = shoreDistance(x,z);
      return mix(water.level-.16,y,1-smooth((d+.095)/.19));
    }
    if (water) {
      const d=aperture(x,z);
      const near=1-smooth((d-.08)/.40);
      const shore=y+Math.max(0,water.level+.06-y)*near;
      const floor=Math.min(water.level-.23,(water.baseLevel??.08)-.36);
      y=mix(floor,shore,smooth((d+.21)/.29));
    }
    return y;
  }

  const shapes = (recipe.shapes ?? []).map(s => ({...s,at:[...s.at]}));
  for (const field of recipe.scatter ?? []) {
    const [xmin,zmin,xmax,zmax]=field.bounds;
    const key=hash(field.id)^seed;
    const slots=[];
    for (let i=0; i<field.count*22 && slots.length<field.count;i++) {
      const x=mix(xmin,xmax,rand(key,i,1)), z=mix(zmin,zmax,rand(key,i,2));
      const edge=aperture(x,z);
      if (radial(x,z)>-.10 || edge<(field.waterMin ?? .08) || edge>(field.waterMax ?? Infinity) ||
          pathDistance(x,z)<(field.clearance ?? .22) ||
          shapes.some(s=>s.keepOut && Math.hypot(s.at[0]-x,s.at[2]-z)<s.keepOut) ||
          slots.some(p=>Math.hypot(p[0]-x,p[1]-z)<(field.separation ?? .24))) continue;
      slots.push([x,z]);
      const scale=mix(field.minSize ?? .17,field.maxSize ?? .4,rand(key,i,3));
      shapes.push({id:field.id+'-'+i,kind:field.kind,at:[x,height(x,z),z],material:field.material,
        accent:field.accent,trunk:field.trunk,size:[scale*1.42,scale,scale*1.1],height:scale,
        yaw:rand(key,i,5)*TAU});
    }
  }
  for (const shape of shapes) {
    if (shape.anchor === 'ground') shape.at[1] += height(shape.at[0],shape.at[2]);
    if (Object.hasOwn(shapePositions,shape.id)) throw new Error('Duplicate shape id ' + shape.id);
    shapePositions[shape.id] = [...shape.at];
  }
  const zShadows=shapes.filter(s=>s.shadow).map(s=>({at:s.at,size:s.shadow,id:s.id}));
  const localLights=(recipe.lights ?? []).map(l=>({...l, rgb:rgb(hex(l.color))}));
  for (const lamp of localLights) if (!point3(lamp.at) || !(lamp.radius>0)) throw new Error('Invalid local light');

  function paint(point, normal, material, owner) {
    const [x,y,z]=point;
    const mat=materials[material];
    let lit=.29+.66*Math.max(0,dot(normal,sun))+.07*Math.max(0,normal[1])+ (mat.bias ?? 0);
    lit+=(noise(seed+5,x*2.6+y*.24,z*2.6-y*.80)-.5)*(mat.texture ?? .21);
    lit+=(noise(seed+11,x*6.4+y*1.8,z*6.4)-.5)*.072;
    if (mat.pattern==='strata') lit+=Math.sin(14*y+.5*Math.sin(x*1.3+z*.78))*.12;
    if (mat.pattern==='planks' && Math.abs(normal[1])<.68) {
      const u=Math.abs(normal[0])>.62?z:x;
      const width=mat.pitch ?? .21;
      const cell=Math.floor(u/width);
      lit+=(rand(seed,cell,19)-.5)*.21;
      if (u/width-cell<.10) lit-=.22;
    }
    if (mat.pattern==='masonry' && Math.abs(normal[1])<.68) {
      const row=Math.floor(y/.25), u=(Math.abs(normal[0])>.62?z:x)/.47+(row&1)*.5;
      if (Math.abs(y/.25-row)<.10 || u-Math.floor(u)<.09) lit-=.22;
    }
    if (normal[1]>.30 || owner==='terrain' && normal[1]>.10) {
      for (const s of zShadows) {
        if (s.id===owner) continue;
        const dx=(s.at[0]-x), dz=(s.at[2]-z);
        if (Math.abs(dx)+Math.abs(dz)>s.size*2+3) continue;
        const [a,b]=[dx*sun[0]+dz*sun[2],Math.abs(dx*sun[2]-dz*sun[0])];
        if (a>-.25 && a<2.25 && b<s.size*.64 && y<s.at[1]+s.size-a*.70) {
          lit-=.24*(1-a*.24);
          break;
        }
      }
    }
    if (mat.glow) lit=.97;
    const index=clamp(Math.floor(lit*mat.ramp.length),0,mat.ramp.length-1);
    let color=rgb(mat.ramp[index]);
    if (!mat.glow) {
      for (const lamp of localLights) {
        const d=sub(lamp.at,point),dist=Math.hypot(...d);
        if (dist>=lamp.radius) continue;
        const fall=(1-dist/lamp.radius)**2;
        const strength=fall*(lamp.gain ?? .53)*(.25+.75*Math.max(0,dot(normal,unit(d))));
        color=color.map((v,i)=>mix(v,lamp.rgb[i],clamp(strength)));
      }
    }
    return pack(color);
  }

  function splat(point, n, material, owner, s=spacing, type=0, tint) {
    if (rows.length >= 12*MAX_SPLATS) throw new Error('Scene exceeded the splat budget. Increase spacing or remove small geometry.');
    const sig=s*.54, width=sig*sig, depth=(sig*.36)**2;
    const covariance=(a,b)=>(a===b?width:0)+(depth-width)*n[a]*n[b];
    const color=tint ?? paint(point,n,material,owner);
    rows.push(...point.map(flat),type===1?.88:1.46,
      flat(covariance(0,0)),flat(covariance(0,1)),flat(covariance(0,2)),color,
      flat(covariance(1,1)),flat(covariance(1,2)),flat(covariance(2,2)),type);
  }

  const tNormal=(x,z)=>unit([(height(x-.06,z)-height(x+.06,z))/.12,1,
    (height(x,z-.06)-height(x,z+.06))/.12]);
  const topMat=(x,z) => {
    const d=aperture(x,z);
    if (island) {
      if (d<-.095) return water.floor;
      if (d<.15) return water.shore;
      if (terrain.pathMaterial && pathDistance(x,z)<(terrain.pathWidth ?? .28)) return terrain.pathMaterial;
      return terrain.surface;
    }
    if (d<-.09) return water.floor;
    if (d<.21) return water.shore;
    if (water?.river) {
      const pockets = noise(seed+19,x*.67,z*.91) + .36*noise(seed+31,x*2.3,z*2.1);
      if (pockets < .48 || (d<.52 && pockets<.79)) return water.shore;
    }
    if (terrain.pathMaterial && pathDistance(x,z)<(terrain.pathWidth ?? .28)) return terrain.pathMaterial;
    return terrain.surface;
  };
  const waterTint=water&&pack(rgb(hex(water.dark)));
  for (let j=-Math.ceil(rz/spacing)-3; j*spacing<rz+spacing*3;j++) {
    for (let i=-Math.ceil(rx/spacing)-3; i*spacing<rx+spacing*3;i++) {
      const x=(i+(j&1)*.5+(rand(seed,i,j,11)-.5)*.46)*spacing;
      const z=(j+(rand(seed,i,j,12)-.5)*.42)*spacing;
      if (radial(x,z)>=0) continue;
      splat([x,height(x,z),z],tNormal(x,z),topMat(x,z),'terrain',spacing*1.17);
      if (water && (island ? height(x,z)<water.level-.016 : aperture(x,z)<0)) {
        const d = island ? shoreDistance(x,z) : 0;
        const shallow = island ? 1-smooth((d-.035)/.44) : 0;
        const tint = island ? pack(rgb(hex(water.dark)).map((v,k)=>mix(v,rgb(hex(water.light))[k],shallow))) : waterTint;
        const bankShallow = water.river ? clamp(1 + aperture(x,z)/.46) : 0;
        const tone = water.river ? pack(rgb(hex(water.dark)).map((v,k)=>mix(v,rgb(hex(water.light))[k],bankShallow*.73))) : tint;
        splat([x,water.level,z],[0,1,0],water.floor,'water',spacing*1.19,1,tone);
        if (island) {
          const a = Math.atan2(z/island.radius[1],x/island.radius[0]);
          const primary = .068+.011*Math.sin(12*a)+.012*Math.sin(21*a);
          const second = .147+.016*Math.cos(13*a+.6);
          const coast = Math.abs(d-primary)<.020 && Math.cos(a*11-.3)+Math.sin(a*4) > -.99;
          const outer = Math.abs(d-second)<.013 && Math.sin(a*12+1.5) > .10;
          const swell = Math.sin(x*5.4+z*8.7+Math.sin(z*3)*.72)>.94 &&
            noise(seed+31,x*1.6,z*1.8)>.74;
          if (coast || outer || swell) {
            const foam = materials[island.foam].ramp;
            splat([x,water.level+.017,z],[0,1,0],island.foam,'surf',
              spacing*(coast?.93:.71),0,pack(rgb(foam[coast?foam.length-1:0])));
          }
        }
      }
    }
  }

  const depth=terrain.depth ?? 1.8;
  function cliffPoint(a,t) {
    const rough=(terrain.edge ?? .09)*(.65*Math.sin(a*3+2*rand(seed,13))+.35*Math.sin(a*7+2.5*rand(seed,15)));
    const rings=1-rough-.22*t**1.2 + .047*Math.sin(20*t)*Math.sin(Math.PI*t);
    const x=rx*rings*Math.cos(a)+t*.22, z=rz*rings*Math.sin(a)-t*.18;
    return [x,mix(height(x,z)-.025,-depth+.12*Math.cos(3*a),t),z];
  }
  const sideRows=Math.ceil(depth/spacing*1.30), sides=Math.ceil(TAU*Math.max(rx,rz)/spacing*.88);
  for (let j=0;j<=sideRows;j++) for(let i=0;i<sides;i++) {
    const a=(i+(j&1)*.5)/sides*TAU;
    const t=j/sideRows;
    const p=cliffPoint(a,t);
    let n=unit(cross(sub(cliffPoint(a+.009,t),p),sub(cliffPoint(a,t+.008),p)));
    if (dot(n,[Math.cos(a),0,Math.sin(a)])<0) n=n.map(x=>-x);
    const cliff=t<.12 && terrain.capCliff ? terrain.capCliff : terrain.cliff;
    splat(p,n,cliff,'cliff',spacing*1.24);
  }
  for (let z=-rz*.75;z<rz*.75;z+=spacing*1.35) for(let x=-rx*.75;x<rx*.75;x+=spacing*1.35) {
    if (radial(x/.75,z/.75)<.02) splat([x,-depth+.06-.04*noise(seed,x,z),z],
      [0,-1,0],terrain.cliff,'cliff',spacing*1.40);
  }

  // Keep animated samples at the end of the authored geometry for partial GPU uploads.
  const ordered=motion?[...shapes].sort((a,b)=>(motion.ids.get(a.motion)??-1)-(motion.ids.get(b.motion)??-1)):shapes;
  let firstMoving=Infinity;
  for (const s of ordered) {
    const group=s.motion===undefined?null:motion.groups[motion.ids.get(s.motion)];
    if(group && group.range[1]===0) group.range[0]=rows.length/12;
    if(group) firstMoving=Math.min(firstMoving,group.range[0]);
    const key=hash(s.id)^seed;
    const density=clamp(s.spacing ?? spacing,.049,.23);
    const yaw=s.yaw ?? 0, tilt=s.tilt ?? 0;
    const cy=Math.cos(yaw), sy=Math.sin(yaw), ct=Math.cos(tilt), st=Math.sin(tilt);
    const turn=([x,y,z])=>[x*cy+(y*st+z*ct)*sy,y*ct-z*st,-x*sy+(y*st+z*ct)*cy];
    function emit(p,n,mat=s.material,gain=1,type=0) {
      const q=turn(p).map((v,i)=>v+s.at[i]);
      splat(q,turn(n),mat,s.id,density*gain,type);
    }
    function triangle(a,b,c,mat) {
      const ab=sub(b,a), ac=sub(c,a);
      const perpendicular=cross(ab,ac);
      if (Math.hypot(...perpendicular)<1e-5) return;
      const n=unit(perpendicular);
      const N=Math.max(1,Math.ceil(Math.max(Math.hypot(...ab),Math.hypot(...ac),Math.hypot(...sub(c,b)))/density));
      for(let i=0;i<=N;i++)for(let j=0;i+j<=N;j++) {
        const u=i/N,v=j/N;
        emit(a.map((p,k)=>p+ab[k]*u+ac[k]*v),n,mat,1.10);
      }
    }
    function plane(c,u,v,length,width,mat) {
      const normal=unit(cross(u,v));
      const N=Math.max(1,Math.ceil(length/density)), M=Math.max(1,Math.ceil(width/density));
      for(let i=0;i<N;i++)for(let j=0;j<M;j++) {
        const a=((i+.5)/N-.5)*length,b=((j+.5)/M-.5)*width;
        emit(c.map((x,k)=>x+u[k]*a+v[k]*b),normal,mat,1.10);
      }
    }
    function box([x,y,z], [w,h,d], mat=s.material) {
      for(const side of [-1,1]){
        plane([x+side*w/2,y,z],[0,0,-side],[0,1,0],d,h,mat);
        plane([x,y+side*h/2,z],[side,0,0],[0,0,-1],w,d,mat);
        plane([x,y,z+side*d/2],[side,0,0],[0,1,0],w,h,mat);
      }
    }
    function radialShape(y0, h, profile, mat, {base=false, top=false, skew=0, detail=1, snow=false}={}) {
      const levels=Math.max(3,Math.ceil(h/density)), widest=Math.max(...profile.map(p=>p[1]));
      const sides=Math.max(9,Math.ceil(TAU*widest/density*.88));
      const bounds=(v)=> {
        for(let i=1;i<profile.length;i++){
          const [max,b]=profile[i], [min,a]=profile[i-1];
          if(v<=max)return mix(a,b,(v-min)/(max-min||1));
        }
        return profile.at(-1)[1];
      };
      function point(a,v) {
        const r=bounds(v)*(1+skew*(.63*Math.sin(a*5+v*3)+.36*Math.cos(a*8-v*7)));
        return [Math.cos(a)*r,h*v+y0,Math.sin(a)*r];
      }
      for(let j=0;j<=levels;j++) {
        const v=j/levels;
        for(let i=0;i<sides;i++) {
          const a=(i+(j&1)*.5)/sides*TAU;
          const p=point(a,v);
          if (j===levels && i && bounds(1)<density*.44) break;
          const dn=sub(point(a+.02,v),p), dy=sub(point(a,Math.min(1,v+.011)),point(a,Math.max(0,v-.011)));
          let n=unit(cross(dy,dn));
          if(dot(n,[Math.cos(a),0,Math.sin(a)])<0)n=n.map(x=>-x);
          const snowBand=noise(key,Math.cos(a)*2.2+v*2.6,Math.sin(a)*2.2-v);
          const layer=snow&&s.accent&&((v>.64&&snowBand>.41)||(v>.22&&n[1]>.32&&snowBand>.47))?s.accent:mat;
          emit(p,n,layer,detail);
        }
      }
      for(const [on,v,n] of [[base,0,-1],[top,1,1]]) if(on) {
        const r=bounds(v);
        for(let x=-r+spacing/2;x<=r;x+=density)for(let z=-r+spacing/2;z<=r;z+=density) {
          if(Math.hypot(x,z)<=r) emit([x,h*v+y0,z],[0,n,0],mat);
        }
      }
    }

    if (s.kind==='tube') {
      const path=s.path;
      const frames=[];
      for(let i=0;i<path.length-1;i++){
        const [a,b,c,d]=[path[Math.max(0,i-1)],path[i],path[i+1],path[Math.min(path.length-1,i+2)]];
        const steps=Math.max(2,Math.ceil(Math.hypot(...sub(c.slice(0,3),b.slice(0,3)))/density));
        const last = i===path.length-2 ? steps+1 : steps;
        for(let k=0;k<last;k++){
          const t=k/steps, t2=t*t,t3=t2*t;
          const p=b.slice(0,3).map((v,j)=>.5*(2*v+(c[j]-a[j])*t+(2*a[j]-5*v+4*c[j]-d[j])*t2+(3*v-a[j]-3*c[j]+d[j])*t3));
          frames.push({p,radX:mix(b[3],c[3],t),radY:mix(b[4],c[4],t),u:i+t});
        }
      }
      for(let i=0;i<frames.length;i++){
        const {p,radX,radY,u}=frames[i];
        const w=unit(sub(frames[Math.min(i+1,frames.length-1)].p,frames[Math.max(0,i-1)].p));
        const horizontal = [-w[2],0,w[0]];
        const a = Math.hypot(...horizontal) > .002 ? unit(horizontal) : [1,0,0];
        const b = unit(cross(a,w));
        const around=Math.max(8,Math.ceil(TAU*(radX+radY)*.49/density));
        for(let j=0;j<around;j++){
          const t=(j+(i&1)*.38)/around*TAU,c=Math.cos(t),h=Math.sin(t);
          const n=unit(a.map((v,k)=>v*c/Math.max(.01,radX)+b[k]*h/Math.max(.01,radY)));
          const r=1 + .038*Math.sin(t*5+u*3.1) + .025*Math.cos(t*9-u*2.3);
          const point=p.map((v,k)=>v+r*(a[k]*radX*c+b[k]*radY*h));
          let mat=s.material;
          if(s.underside && n[1]<-.44-.09*Math.sin(u*5+t*3))mat=s.underside;
          else if(s.accent && (n[1]>.48 || s.banded && n[1]>-.24 &&
            Math.cos(u*8.5+t*t*.09+Math.sin(t*3)*.9)>.66))mat=s.accent;
          emit(point,n,mat,1.07);
        }
      }
    }
    if(s.kind==='sheet'){
      const [width,fall,depth]=s.size;
      const nx=Math.ceil(width/density),ny=Math.ceil((fall+depth)/density);
      const stripes=Math.max(5,Math.round(width*14));
      for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++) {
        const u=i/nx,t=j/ny;
        const edge=.98-.13*Math.sin(t*2.8)+.22*t**5;
        const lane=Math.floor(u*stripes);
        if((i===0||i===nx)&&noise(key+7,u*31,t*21)<.44)continue;
        const wave=.026*Math.sin(t*9+lane*1.3);
        const x=(u-.5)*width*edge + wave + .027*Math.sin(t*7);
        const y=-t*fall;
        const z=depth*(.54*Math.sin(t*Math.PI/2)+1.04*t**3)+.021*Math.sin(t*5+lane*2);
        const light=noise(key,lane*.8,1);
        const mat = light>.58 || t>.94 ? s.accent : s.material;
        const along=unit([0,-fall,depth*(.85*Math.cos(t*Math.PI/2)+3.12*t*t)]);
        emit([x,y,z],[0,along[2],-along[1]],mat,1.17,s.id==='water-lower-fan'?6:5);
      }
    }
    if (s.kind==='box') box([0,0,0],s.size);
    if (s.kind==='gable') {
      const [w,h,d]=s.size;
      const [a,b,c]=[[-w/2,0,-d/2],[w/2,0,-d/2],[s.skew??0,h,-d/2]];
      const [e,f,g]=[[-w/2,0,d/2],[w/2,0,d/2],[s.skew??0,h,d/2]];
      triangle(a,c,b,s.face ?? s.material); triangle(e,f,g,s.face ?? s.material);
      triangle(a,e,c,s.accent ?? s.material); triangle(c,e,g,s.accent ?? s.material);
      triangle(b,c,f,s.accent ?? s.material); triangle(c,g,f,s.accent ?? s.material);
    }
    if (s.kind==='cylinder'||s.kind==='cone') {
      const r=s.radius??.5, h=s.height??1;
      radialShape(0,h,[[0,r],[1,s.topRadius??(s.kind==='cone'?.025:r)]],
        s.material,{base:true,top:true});
    }
    if (s.kind==='dome') {
      const r=s.radius??1,h=s.height??r;
      const profile=Array.from({length:20},(_,i)=>{
        const angle=i*Math.PI/38;
        return [Math.sin(angle),Math.max(.013,r*Math.cos(angle))];
      });
      radialShape(0,h,profile,s.material,{base:true,detail:1.15});
      if (s.accent) for(let j=0;j<3;j++) for(let i=0;i<100;i++){
        const a=i/100*TAU;
        const t=.22+j*.23, r2=r*Math.sqrt(1-t*t)+.009;
        emit([Math.cos(a)*r2,h*t,Math.sin(a)*r2],unit([Math.cos(a),t,Math.sin(a)]),s.accent,.58);
      }
    }
    if (s.kind==='dish') {
      const r=s.radius??.55,h=s.height??.40;
      const count=Math.max(72,Math.ceil(Math.PI*r*r/(density*density)*1.8));
      for(let i=0;i<count;i++) {
        const a=i*2.39996323, t=Math.sqrt((i+.5)/count), x=Math.cos(a)*t*r,z=Math.sin(a)*t*r;
        const y=t*t*h;
        emit([x,y,z],unit([-2*h*x/r**2,1,-2*h*z/r**2]),s.material,1.04);
        emit([x,y-.028,z],unit([2*h*x/r**2,-1,2*h*z/r**2]),s.accent??s.material,1.04);
      }
      for(let i=0;i<Math.ceil(TAU*r/density);i++){
        const a=i*density/r;
        emit([r*Math.cos(a),h,r*Math.sin(a)],[0,1,0],s.accent??s.material,.90);
      }
      box([0,h*.66,0],[.06,h*.96,.06],s.accent??s.material);
    }
    if (s.kind==='fir') {
      const h=s.height??2.1;
      radialShape(0,h*.79,[[0,h*.045],[1,h*.015]],s.trunk??s.material,{base:true});
      for(let i=0;i<4;i++) {
        const radius=h*(.255-i*.045)*(mix(.88,1.11,rand(key,i,5)));
        const y=h*(.19+i*.186), top=h*(.36-i*.016);
        radialShape(y,top,[[0,radius*.87],[.12,radius],[.43,radius*.55],[.76,radius*.27],[1,.013]],
          s.material,{skew:.22,snow:true,base:true,detail:1.11});
      }
    }
    if (s.kind==='rock') {
      const [rx,ry,rz]=(s.size??[.6,.45,.5]).map(v=>v/2);
      const count=Math.max(34,Math.ceil(6.5*(rx*ry+rx*rz+ry*rz)/(density*density)));
      const facets=Array.from({length:9},(_,i)=>{
        const y=(i+.5)/4.5-1,a=i*2.39996323 + rand(key,4,13)*.6;
        return unit([Math.cos(a)*Math.sqrt(1-y*y),y,Math.sin(a)*Math.sqrt(1-y*y)]);
      });
      for(let i=0;i<count;i++){
        const y=1-2*(i+.5)/count,a=i*2.39996323, x=Math.sqrt(1-y*y)*Math.cos(a),z=Math.sqrt(1-y*y)*Math.sin(a);
        const n=facets.reduce((best,d)=>dot(d,[x,y,z])>dot(best,[x,y,z])?d:best,facets[0]);
        const flatten=.81+.19*dot(n,[x,y,z]);
        const irregular=1+.12*Math.sin(x*5+y*3+rand(key,6)*4)*Math.cos(z*4-y*3);
        emit([x*rx*irregular*flatten,y*ry*irregular*flatten,z*rz*irregular*flatten],
          unit([n[0]/rx,n[1]/ry,n[2]/rz]),s.accent&&y>.43?s.accent:s.material,1.05);
      }
    }
    if (s.kind==='reed') {
      const height=s.height??.35;
      for(let k=0;k<5;k++){
        const a=rand(key,k,55)*TAU, h=height*(.38+rand(key,k,13)*.76);
        for(let i=0;i<=Math.ceil(h/density);i++){
          const t=clamp(i*density/h);
          const shift=.08+.11*t*t;
          emit([shift*Math.cos(a),h*t,shift*Math.sin(a)],[Math.cos(a),.15,Math.sin(a)],s.material,.61);
        }
      }
    }
    if (s.kind==='beam') {
      const end=sub(s.to,s.at), u=unit(end), length=Math.hypot(...end);
      const a=unit(cross(u,Math.abs(u[1])>.88?[0,0,1]:[0,1,0])), b=cross(u,a);
      const radius=s.radius??.075, N=Math.max(2,Math.ceil(length/density));
      const tip=s.endRadius??radius;
      const sides=Math.max(7,Math.ceil(TAU*Math.max(radius,tip)/density*.72));
      for(let i=0;i<=N;i++)for(let j=0;j<sides;j++){
        const angle=j*TAU/sides, normal=a.map((n,k)=>n*Math.cos(angle)+b[k]*Math.sin(angle));
        const t=i/N, r=mix(radius,tip,t);
        emit(end.map((v,k)=>v*t+normal[k]*r),normal,s.material,.92);
      }
    }
    if(group) group.range[1]=rows.length/12;
  }

  const background=hex(recipe.background??'#101923');
  const surfaceColors=[background,...(recipe.extraColors??[]).map(hex),
    ...Object.values(materials).flatMap(m=>m.ramp)];
  if(water) surfaceColors.push(hex(water.dark),hex(water.light));
  const palette=[...new Set(surfaceColors)];
  if (palette.length>MAX_SCENE_COLORS) throw new Error('Use at most '+MAX_SCENE_COLORS+' distinct palette colors');
  const avatar=recipe.walk?compileAvatar(recipe.walk.avatar):null;
  if(avatar)for(const color of avatar.colors)if(!palette.includes(color))palette.push(color);
  if (palette.length>MAX_PALETTE_COLORS) {
    throw new Error('Use at most '+MAX_PALETTE_COLORS+' distinct palette colors including the avatar (got '+palette.length+')');
  }
  const waterInfo=water?{
    drink:water.drink, level:water.level,dark:hex(water.dark),light:hex(water.light),reflection:water.reflection??.24,steam:water.steam??false,
    rippleA:water.rippleA??[water.center[0]-water.radius[0]*.36,water.center[1]-.16],
    rippleB:water.rippleB??[water.center[0]+water.radius[0]*.42,water.center[1]+.32],
    steamOrigins:water.steamOrigins??[water.center,[water.center[0]+.42,water.center[1]+.48]]
  }:null;
  const effect=recipe.effect?{...recipe.effect,color:hex(recipe.effect.color??'#9ebbc8')}:null;
  return {
    meta:{camera:recipe.camera??{target:[0,.6,0],dist:16,yaw:-.35,pitch:.60},
      count:rows.length/12,background,palette,water:waterInfo,effect,
      ...(motion?{motion:{first:firstMoving,groups:motion.groups}}:{}),
      ...(recipe.walk ? {walk:walking.bake(recipe.walk,terrain.radius,radial,height,aperture,shapes),avatar:avatar.pixels} : {})},
    rows:Float32Array.from(rows),shapePositions
  };
}
module.exports={generate,MAX_SPLATS,MAX_PALETTE_COLORS};
