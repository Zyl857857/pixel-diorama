'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {deflateSync}=require('node:zlib');
const {generate}=require('./geometry');
const {renderPreview}=require('./preview');

const labels={
  'zh-CN':{
    canvas:'可旋转的三维像素场景',poster:'场景静态预览',loading:'正在读取场景…',pause:'暂停',play:'播放',reset:'重置视角',
    controls:'拖动旋转 · 滚轮缩放',fallback:'当前浏览器无法开启 3D，已显示静态预览。',lost:'图形上下文已中断，刷新页面可重试。'
  },
  en:{
    canvas:'Interactive 3D pixel scene',poster:'Static scene preview',loading:'Loading scene…',pause:'Pause',play:'Play',reset:'Reset view',
    controls:'Drag to orbit · Scroll to zoom',fallback:'3D is unavailable in this browser. Showing the static preview.',lost:'Graphics paused. Refresh to try again.'
  }
};
const esc=s=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function build(recipePath,outputPath,review=false) {
  const recipe=JSON.parse(fs.readFileSync(recipePath,'utf8'));
  const world=generate(recipe);
  const locale=recipe.locale??(/[\u3400-\u9fff]/u.test(recipe.title)?'zh-CN':'en');
  if (!Object.hasOwn(labels,locale)) throw new Error('Use zh-CN or en for locale');
  const copy=labels[locale];
  const scene={...world.meta,labels:copy,
    data:deflateSync(Buffer.from(world.rows.buffer),{level:7}).toString('base64')};
  const poster=renderPreview(world);
  const player=fs.readFileSync(path.join(__dirname,'../assets/player.html'),'utf8');
  const background='#'+world.meta.background.toString(16).padStart(6,'0');
  const replacements={BACKGROUND:background,TITLE:esc(recipe.title),LANG:locale,
    CANVAS_LABEL:copy.canvas,POSTER_LABEL:copy.poster,LOADING:copy.loading,PAUSE:copy.pause,RESET:copy.reset,
    POSTER:poster.toString('base64'),SCENE:JSON.stringify(scene).replace(/</g,'\\u003c')};
  const page=player.replace(/__([A-Z_]+)__/g,(marker,key)=>{
    if(!Object.hasOwn(replacements,key)) throw new Error('Unknown player placeholder '+marker);
    return replacements[key];
  });
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,page);
  if(review) {
    const base=outputPath.replace(/\.html$/i,'');
    fs.writeFileSync(base+'-front.png',poster);
    fs.writeFileSync(base+'-side.png',renderPreview(world,.78));
    fs.writeFileSync(base+'-layout.json',JSON.stringify(world.shapePositions,null,2));
  }
  return {count:scene.count,bytes:Buffer.byteLength(page)};
}
if(require.main===module) {
  const [recipe,output,review]=process.argv.slice(2);
  if(!recipe||!output||review&&review!=='--review') {
    console.error('Usage: node scripts/build.js scene.json output.html [--review]');
    process.exitCode=2;
  } else {
    try {
      const result=build(path.resolve(recipe),path.resolve(output),review==='--review');
      console.log('Generated '+result.count+' splats and '+result.bytes+' bytes');
    } catch(error) {
      console.error(error.message);
      process.exitCode=1;
    }
  }
}
module.exports={build};
