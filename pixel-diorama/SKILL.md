---
name: pixel-diorama
description: 创作或修改原创 3D 像素微缩场景、体素箱庭、像素高斯泼溅和抽象像素雕塑。适用于延续雪松温泉、雨夜电车站、骨龙或雪脊瀑布的画风，也适用于让主体动起来或控制小人探索。默认交付可离线旋转的单文件 HTML 与实渲染预览。
---

# 3D 像素微缩艺术创作

导入客户端之后，这个 Skill 只有本目录。新场景从 `assets/recipes/` 里的配方和 `references/` 里的说明起步。仓库根目录下的 `examples/` 和 `showcase/` 不在导入后的包里；只有当前工作区是本仓库的完整 git 检出时，才去打开它们。

1. 从主题选一个有辨识度的主角和一处能讲清主题的细节。先做大体块、剪影和光色，再把更密的像素纹理、材质层次和更小的部件留给焦点。用 `scatter` 或短脚本铺排重复部件，保留手调的位置和主题细节。
2. 新场景先看 [配方起步](references/recipe.md#起步)，按需查字段或样例片段。沿用自己的构图和配方，只检索相关材质、形体或动效。修订作品优先用已有 JSON，或从新版 HTML 取回配方。按字段或形体 ID 读取和修改相关部分，保留其他设置。旧版 HTML 先找原配方。
3. 从本目录用 Node.js 18+ 构建。从其他目录运行时改用 `scripts/build.js` 的绝对路径。
   ```sh
   node scripts/build.js scene.json scene.html --preview
   node scripts/build.js --extract-recipe scene.html scene.json
   ```
4. 查看 `scene-front.png`，检查主体轮廓、层次、接触和构图。修订时复查受影响的部分。用 `--review` 加做侧视、布局和体检，适用于接缝、遮挡、落水和空间关系需要复核的场景。合并同一轮改动后再构建。用生成器完成渲染和封装，无需展开成品 HTML 或读取生成器源码。
5. 交付可离线旋转的 HTML 和一张实渲染预览。用户指定静帧、动图、视频或其他格式时按需求输出。动态 HTML 可直接播放，视频导出按需执行。回复简短，优先呈现作品。

按场景选用参考：

- 延续深色舞台、局部发光、微缩箱庭的影片风格时，查[暗场像素微缩](references/night-miniatures.md)。
- 刻画树木时，按树种选[枝干与冠层](references/art-direction.md#树木的枝干与冠层)。
- 动物造型先看[头骨、关节与承重](references/art-direction.md#动物与生物造型)，近景验收眼、颌线、足部和附肢的连接。
- 复杂造型、抽象雕塑、积雪岩层和瀑布看 [造型与画面审查](references/art-direction.md)。瀑布在固定镜头检查崖口、水流加速和落点外溅，再转侧面确认水股厚度。
- 主体动画看 [动作编排](references/motion.md)。检查关键姿态和完整循环。
- 控制小人看 [可游玩的像素微缩场景](references/explore.md)。实际走一遍出生点至首个地标。
