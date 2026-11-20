'use strict';

// Local axes: +Y up, +Z forward. Each piece is shaped on a common pixel grid.
const traveler = (() => {
  const colors=[0x263247,0x374559,0x34485c,0x466680,0x658599,0xa27147,
    0xbd8b66,0xe8ba92,0x958570,0xc2b59b,0xe9dfc7,0xc39966,0x513e41];
  const [boot,hair,coatDark,coat,coatLight,woodDark,skinShade,skin,towelDark,towel,towelLight,wood,band]=colors;
  const parts=new Map();
  function block(part,x0,x1,y0,y1,z0,z1,tint,bright=tint,dark=tint){
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++){
      if(x>x0&&x<x1&&y>y0&&y<y1&&z>z0&&z<z1)continue;
      parts.set([x,y,z,part].join(','),[x,y,z,y===y1?bright:x===x0||z===z0?dark:tint,part]);
    }
  }
  // Padded indigo jacket, crossed collar and cedar-colored sash.
  block('body',-2,2,4,8,-1,1,coat,coatLight,coatDark);
  block('body',-2,2,6,6,2,2,woodDark);
  for(let k=0;k<3;k++)block('body',k-1,k-1,9-k,9-k,2,2,towel);
  block('body',-1,1,8,9,-2,-2,coatDark,coatLight);
  // The headwrap sits above a warm face and ties behind the head.
  block('head',-2,2,10,13,-2,1,skin,skin,skinShade);
  block('head',-2,2,10,12,-2,-1,hair);
  block('head',-2,2,11,12,2,2,skin,skin,skinShade);
  for(const x of [-1,1])block('head',x,x,11,11,2,2,boot);
  block('head',-2,2,13,14,-2,2,towel,towelLight,towelDark);
  block('head',-1,1,15,15,-1,1,towelLight);
  block('head',0,1,12,13,-3,-3,towel,towelLight,towelDark);
  block('head',1,1,11,12,-4,-3,towelDark);
  for(const [side,x] of [['left',-1],['right',1]]){
    const arm='arm-'+side,leg='leg-'+side;
    block(arm,x*3,x*3,6,8,-1,1,coat,coatLight,coatDark);
    block(arm,x*3,x*3,5,5,0,1,skin);
    block(leg,x,x,1,3,-1,0,coatDark,coat,boot);
    block(leg,x,x,0,1,0,2,boot,coatDark,boot);
  }
  // Cedar wash bucket, with dark bands and an open lip, follows the right hand.
  const bucket='arm-right';
  block(bucket,4,6,1,1,0,2,woodDark);
  block(bucket,4,6,2,3,0,0,wood,wood,woodDark);
  block(bucket,4,6,2,3,2,2,wood,wood,woodDark);
  block(bucket,4,4,2,3,1,1,wood);
  block(bucket,6,6,2,3,1,1,woodDark);
  block(bucket,4,6,4,4,0,0,towelDark);
  block(bucket,4,6,4,4,2,2,wood);
  block(bucket,4,4,4,4,1,1,wood);
  block(bucket,6,6,4,4,1,1,wood);
  block(bucket,4,4,5,5,1,1,band);
  block(bucket,6,6,5,5,1,1,band);
  block(bucket,4,6,6,6,1,1,band);
  return {colors,pixels:[...parts.values()]};
})();
