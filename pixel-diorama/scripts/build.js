'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {deflateSync,inflateSync}=require('node:zlib');
const {generate, MAX_SPLATS, MAX_PALETTE_COLORS}=require('./geometry');
const {ground}=require('./walking');
const {apply}=require('./motion');
const {renderPreview, FRAME_WIDTH, FRAME_HEIGHT}=require('./preview');

const labels={
  'zh-CN':{
    enter:'开始探索',leave:'退出探索',walking:'WASD / 方向键移动 · 拖动转视角',touchWalk:'用画面上的方向键移动 · 拖动转视角',
    canvas:'可旋转的三维像素场景',poster:'场景静态预览',loading:'正在读取场景…',pause:'暂停',play:'播放',reset:'重置视角',
    controls:'拖动旋转 · 滚轮缩放',fallback:'当前浏览器无法开启 3D，已显示静态预览。',lost:'图形上下文已中断，刷新页面可重试。'
  },
  en:{
    enter:'Explore',leave:'Stop exploring',walking:'WASD / arrows to walk · Drag to orbit',touchWalk:'Use the on-screen arrows to walk · Drag to orbit',
    canvas:'Interactive 3D pixel scene',poster:'Static scene preview',loading:'Loading scene…',pause:'Pause',play:'Play',reset:'Reset view',
    controls:'Drag to orbit · Scroll to zoom',fallback:'3D is unavailable in this browser. Showing the static preview.',lost:'Graphics paused. Refresh to try again.'
  }
};
const esc=s=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function build(recipePath,outputPath,options={}) {
  // Keep the boolean form used by existing callers for full review.
  const {preview=false,review=false}=typeof options==='boolean'?{review:options}:options;
  const source=fs.readFileSync(recipePath,'utf8');
  const recipe=JSON.parse(source);
  const world=generate(recipe);
  const locale=recipe.locale??(/[\u3400-\u9fff]/u.test(recipe.title)?'zh-CN':'en');
  if (!Object.hasOwn(labels,locale)) throw new Error('Use zh-CN or en for locale');
  const copy=labels[locale];
  const scene={...world.meta,labels:copy,
    data:deflateSync(Buffer.from(world.rows.buffer),{level:7}).toString('base64')};
  const posed=world.meta.motion?{...world,rows:world.rows.slice()}:world;
  if(world.meta.motion)apply(world.meta.motion.groups,0,world.rows,posed.rows);
  const width=recipe.resolution??FRAME_WIDTH;
  const height=recipe.resolution?width*3/4:FRAME_HEIGHT;
  const poster=renderPreview(posed,0,width,height);
  const player=fs.readFileSync(path.join(__dirname,'../assets/player.html'),'utf8');
  const background='#'+world.meta.background.toString(16).padStart(6,'0');
  const replacements={MOTION:world.meta.motion?fs.readFileSync(path.join(__dirname,'motion.js'),'utf8'):'const sceneMotion=null;',
    FLUID:world.meta.fluid?fs.readFileSync(path.join(__dirname,'fluid.js'),'utf8'):'const sceneFluid=null;',
    WALKING:world.meta.walk?fs.readFileSync(path.join(__dirname,'walking.js'),'utf8'):'const walking=null;',
    RECIPE_SOURCE:deflateSync(source).toString('base64'),
    BACKGROUND:background,TITLE:esc(recipe.title),LANG:locale,
    CANVAS_LABEL:copy.canvas,POSTER_LABEL:copy.poster,LOADING:copy.loading,PAUSE:copy.pause,RESET:copy.reset,
    FRAME_WIDTH:width,FRAME_HEIGHT:height,POSTER:poster.toString('base64'),SCENE:JSON.stringify(scene).replace(/</g,'\\u003c')};
  const page=player.replace(/__([A-Z_]+)__/g,(marker,key)=>{
    if(!Object.hasOwn(replacements,key)) throw new Error('Unknown player placeholder '+marker);
    return replacements[key];
  });
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,page);
  const result={count:scene.count,bytes:Buffer.byteLength(page)};
  const base=outputPath.replace(/\.html$/i,'');
  if(preview||review) fs.writeFileSync(base+'-front.png',poster);
  if(review) {
    fs.writeFileSync(base+'-side.png',renderPreview(posed,.78,width,height));
    fs.writeFileSync(base+'-layout.json',JSON.stringify(world.shapePositions,null,2));

    const [rx,rz]=recipe.terrain.radius;
    const warnings=Object.entries(world.shapePositions)
      .filter(([, [x,,z]])=>Math.hypot(x/rx,z/rz)>1)
      .map(([id,[x,,z]])=>({code:'SHAPE_OUTSIDE_TERRAIN_RADIUS',id,x,z}));
    result.review={
      splats:{count:scene.count,limit:MAX_SPLATS,percent:Number((scene.count/MAX_SPLATS*100).toFixed(2))},
      palette:scene.palette.length+'/'+MAX_PALETTE_COLORS,
      warnings,
    };
    if(scene.walk){
      const [x,z]=scene.walk.spawn;
      result.review.walk={spawn:{x,z,height:ground(scene.walk,x,z)}};
    }
  }
  return result;
}

function extractRecipe(inputPath,outputPath) {
  if(path.resolve(inputPath)===path.resolve(outputPath)) {
    throw new Error('Choose a separate JSON output path');
  }
  const html=fs.readFileSync(inputPath,'utf8');
  const source=html.match(/<script id="recipe-source" type="application\/octet-stream">([A-Za-z0-9+/=]+)<\/script>/);
  if(!source) throw new Error('This HTML has no embedded recipe. Use the original scene JSON if available.');
  const recipe=inflateSync(Buffer.from(source[1],'base64')).toString('utf8');
  JSON.parse(recipe);
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,recipe);
}

if(require.main===module) {
  const args=process.argv.slice(2);
  const extracting=args[0]==='--extract-recipe';
  const [input,output,flag]=extracting?args.slice(1):args;
  const invalidFlag=flag!==undefined&&!['--preview','--review'].includes(flag);
  if(!input||!output||args.length>3||invalidFlag) {
    console.error('Usage: node scripts/build.js scene.json output.html [--preview | --review]');
    console.error('       node scripts/build.js --extract-recipe scene.html scene.json');
    process.exitCode=2;
  } else {
    try {
      if(extracting) {
        extractRecipe(input,output);
        console.log('Extracted recipe to '+output);
      } else {
        const result=build(input,output,{preview:flag==='--preview',review:flag==='--review'});
        console.log('Generated '+result.count+' splats and '+result.bytes+' bytes');
        if(result.review) console.log(JSON.stringify(result.review,null,2));
      }
    } catch(error) {
      console.error(error.message);
      process.exitCode=1;
    }
  }
}
module.exports={build};
