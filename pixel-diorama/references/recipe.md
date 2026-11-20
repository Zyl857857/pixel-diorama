# 场景配方

`assets/recipes/cedar-spring.json` 示例展示水位、岸边材质和植被联动。`desert-observatory.json` 展示干燥地形、圆顶与卫星天线。`rain-tram-stop.json` 展示人造硬表面、灯光、反光与雨。`bone-dragon.json` 展示用短杆、节点、断环和留白组织抽象雕塑。

## 顶层字段

| 字段 | 用法 |
| --- | --- |
| `title`、`seed` | 可读标题和整数种子。种子控制地形噪声、稳定散布和材质纹理。可另设 `locale` 为 `zh-CN` 或 `en`。 |
| `background`、`sun` | 六位十六进制色值和主光 XYZ 方向。Y 向上，视点在默认的 Z 正侧。 |
| `spacing` | 世界单位的表面采样间距，默认 0.105。缩小会提高样本数量。局部也可给单一物体设置间距。 |
| `camera` | `target` XYZ，`dist`、`yaw`、`pitch`。角度用弧度。8 秒弱环绕自动播放，允许交互转动。 |
| `terrain` | `radius` 为 XZ 半径，`height` 为基准高度，`depth` 为岩基深度，`edge` 为外缘曲折。指定 `surface`、`cliff`、可选 `capCliff` 和 `pathMaterial`。`hills` 各项为 `[x,z,高差,x宽,z宽]`。 |
| `materials` | 按角色命名为对象，每项有暗到亮的 `ramp`。可选 `texture`、`bias`、`glow`、`pattern`。纹理模式有 `strata`、`planks`、`masonry`。阶梯色计入场景调色板。 |
| `shapes` | 带稳定 `id` 的手定部件。每个部件指定 `kind`、`at`、`material`，形体参数见下文。 |
| `clearPaths` | XZ 点列组成的通路，供地表着色与散布留白。 |
| `scatter` | `rock`、`fir` 或 `reed` 的散布规则。每条给定 `id`、`bounds` 为 `[xmin,zmin,xmax,zmax]`、`count`、`material`，可加 `accent`、`trunk`、`minSize`、`maxSize`、`separation`、`clearance`、`waterMin`、`waterMax`。岸线距离是按半径归一化的，水面内为负。 |
| `water` | 可选。设置 `center`、XZ `radius`、`level` 和 `baseLevel`、`shore`、`floor`、`dark`、`light`。可选 `reflection`（0 至 1）、`steam`、`steamOrigins`、`rippleA`、`rippleB`、`rectangular`。水位相对基准变化会移动岸线，影响池岸材质和沿岸散布。 |
| `motion` | 可选。为场景部件添加 8 秒关键帧动作。语法与样例见 [主体动画](motion.md)。 |
| `walk` | 可选的行走模式。配置出生点、主题角色、铺石表面、碰撞障碍和危险区域，详见 [可游玩的像素微缩场景](explore.md)。 |
| `lights`、`effect` | `lights` 项有 `at`、`color`、`radius`、可选 `gain`。`effect` 支持 `snow`、`dust`、`rain`、`mist`。可改 `color`、`count`、XZ `radius`、`opacity`。薄雾用多个 XYZ `origins` 指定区域，适合低坡、码头或无水场景。 |

场景调色板按不同色值去重，背景、所有材质的 `ramp`、水色 `water.dark` 和 `water.light`、`extraColors` 合计最多 56 色。开启 `walk` 时，加入 `avatar` 的色值后总计最多 72 色，场景本身仍遵守 56 色上限。

## 形体字段

所有形体可设置 `yaw`、`tilt`、`spacing`、`shadow`、`keepOut`。角度为弧度。`anchor: "ground"` 会让 Y 值成为离地偏移。希望在水位调整后仍保持绝对高度的核心部件使用固定 XYZ。

| 形体 | 尺寸和起点 |
| --- | --- |
| `box` | `at` 为盒中心，`size` 为完整宽、高、深。 |
| `rock` | `at` 为中心，`size` 为宽、高、深，`accent` 可作浅色或积雪顶。 |
| `cylinder`、`cone` | `at` 为底面中心，`radius`、`height` 和可选 `topRadius`。 |
| `dome`、`dish` | `at` 为底面中心，`radius`、`height`，`accent` 可作接缝或内外反差。使用 `tilt` 摆放天线。 |
| `gable` | `at` 为屋檐中点，`size` 为宽、坡顶高度、深。可用 `face` 和 `accent` 区分山墙和屋面。 |
| `fir`、`reed` | `at` 为根部，`height`。针叶树用 `trunk` 指木材、`accent` 指树冠积雪。 |
| `beam` | 从 `at` 到 `to` 的细杆，`radius` 设置粗细。 |

把密集采样留给主角和入口。只给会跨场景复用的形体和规则增加字段。输出跨版本布局时，以稳定 ID 对齐记录。

## 参数经验值与防坑速查

- 全局 `spacing` 从 `0.09–0.11` 起步，把局部 `0.055–0.07` 留给主体和入口。单个场景最多生成 215,000 个 splats。看 `--review` 的占用率判断余量。如果构建报超限，先调大非主体的局部 `spacing`，再适当调大全局间距或减少散布和重复小件，重建后复查主体细节。
- `camera.dist` 从 `terrain.radius` 最大值的约 `3.2–4.0` 倍起步。结合 `camera.target` 和俯仰角调整，检查两个视角下高物体和远端地形是否出画。
- 让根部贴地的形体使用 `anchor: "ground"`，圆柱或树干的 `at[1]` 从 `0` 起步，按中心定位的盒体可从半高起步。贴地偏移还需结合坡面和视角检查。给大物体设置覆盖其占地的 `keepOut`，为散布留出空间。手动摆放的形体要另外检查相互穿插。
- 优先复用 4–6 组 `materials` 阶梯色。让相近物体共享色阶，用纹理或光照区分细节，为背景、水色和 `extraColors` 留出余量。
- `--review` 按 `terrain.radius` 的基准 XZ 椭圆标出锚点越界的形体。结合两张静态审图核对起伏岸线、大形体边缘和悬挑。
