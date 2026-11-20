'use strict';

const presets = {
  traveler: require('../assets/avatars/traveler.json'),
  'spring-keeper': require('../assets/avatars/spring-keeper.json')
};
const parts = ['body','head','arm-left','arm-right','leg-left','leg-right'];

function compileAvatar(spec='traveler') {
  const recipe=typeof spec==='string'&&Object.hasOwn(presets,spec)?presets[spec]:spec;
  if(!Array.isArray(recipe?.blocks)||!recipe.blocks.length||recipe.blocks.length>80) {
    throw new Error('walk.avatar needs a known preset or 1–80 blocks');
  }
  const position=p=>Array.isArray(p)&&p.length===3&&p.every((n,i)=>
    Number.isInteger(n)&&n>=(i===1?0:-12)&&n<=(i===1?24:12));
  const parse=color=>{
    if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Avatar colors must be #RRGGBB');
    return parseInt(color.slice(1),16);
  };
  const pixels=new Map();
  for(const b of recipe.blocks) {
    const slot=parts.indexOf(b?.part);
    if(slot<0||!position(b.from)||!position(b.to)||b.from.some((n,i)=>n>b.to[i])) {
      throw new Error('Invalid avatar block part or coordinates');
    }
    const [[x0,y0,z0],[x1,y1,z1]]=[b.from,b.to];
    const color=parse(b.color),top=parse(b.top??b.color),shade=parse(b.shade??b.color);
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++) {
      if(x>x0&&x<x1&&y>y0&&y<y1&&z>z0&&z<z1)continue;
      pixels.set([slot,x,y,z].join(','),[x,y,z,y===y1?top:x===x0||z===z0?shade:color,slot]);
      if(pixels.size>1200)throw new Error('Avatar exceeds 1200 surface pixels');
    }
  }
  const model=[...pixels.values()];
  const colors=[...new Set(model.map(pixel=>pixel[3]))];
  if(colors.length>16)throw new Error('Avatar must use at most 16 colors');
  return {pixels:model,colors};
}

module.exports={compileAvatar};
