# Pixel Diorama

把一个主题做成可以旋转、缩放和离线打开的 3D 像素微缩场景。场景由配方和 JavaScript 生成，可以加入云雾、流水、关节动画和可操控的探索角色。

[看《方寸之间》宣传片](media/pixel-diorama-nine-worlds.mp4) · [打开离线作品集](showcase/index.html) · [查看 Skill](pixel-diorama/SKILL.md)

## 安装与使用

将 `pixel-diorama/` 整个文件夹导入支持 Agent Skills 的客户端，保留内部目录结构。调用 **pixel-diorama** 后，可以输入这样的主题。

> 做一个雨后的像素山谷。瀑布落在两级岩台上，河边只留一只恐龙，让它俯身饮水，碰到水时再荡开涟漪。交付可旋转的离线 HTML。

## 本地生成

需要 Node.js 18 或更新版本。生成器只用 Node.js 标准库。

```sh
node pixel-diorama/scripts/build.js pixel-diorama/assets/recipes/cedar-spring.json build/cedar-spring.html --review
node examples/build.cjs --all build/showcase
```

第一条命令从 Skill 自带配方生成一个场景。第二条重建九个展示场景，也可以把 `--all` 换成单个场景的目录名。输出包括离线 HTML、两张实际渲染图和场景位置数据。

下载仓库后，在支持 WebGL 2 的浏览器中打开 `showcase/index.html`，即可浏览已生成的作品。

## 九个场景

| 作品 | 画面 | 配方与源码 |
| --- | --- | --- |
| 余烬火山 | 熔岩、灰烬与烟柱 | [emberfall-volcano](examples/emberfall-volcano) |
| 金字塔遗迹 | 石阶、狮身人面像与绿洲 | [pyramid-ruins](examples/pyramid-ruins) |
| 马丘比丘 | 山脊、梯田与山雾 | [machu-picchu](examples/machu-picchu) |
| 雪松温泉 | 雪松、泉雾与可操控角色 | [cedar-spring-explore](examples/cedar-spring-explore) |
| 侏罗纪河谷 | 异特龙饮水、两级瀑布与涟漪 | [dinosaur-valley](examples/dinosaur-valley) |
| 断潮岛 | 巨蟹、潮涌与挑战者 | [crab-island](examples/crab-island) |
| 巴黎夜色 | 铁塔、河岸与夜间照明 | [eiffel-paris](examples/eiffel-paris) |
| 灰钟关 | 灰钟、火光与可操控的守关人 | [ash-gate](examples/ash-gate) |
| 骨龙苏醒 | 骨架关节与展翼动画 | [bone-dragon-awakens](examples/bone-dragon-awakens) |

`pixel-diorama/` 包含通用生成器、播放器、角色素材和创作参考。`examples/` 包含九个场景的配方及其专用渲染模块。`showcase/` 包含已生成的 HTML 和预览图，`media/` 包含 1080p 宣传片。
