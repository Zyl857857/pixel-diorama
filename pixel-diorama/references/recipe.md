# 场景配方

`assets/recipes/cedar-spring.json` 示例展示水位、岸边材质和植被联动。`desert-observatory.json` 展示干燥地形、圆顶与卫星天线。`rain-tram-stop.json` 展示人造硬表面、灯光、反光与雨。`bone-dragon.json` 展示用短杆、节点、断环和留白组织抽象雕塑。`snowfall-cascade.json` 展示分层岩台、积雪和两级落水。

## 起步

从这个可构建骨架出发，按主题改主体、地势、材质和镜头。只查本次要用的字段。

```json
{
  "title": "山顶信标",
  "seed": 2176,
  "background": "#202938",
  "camera": {"target": [0, 0.8, 0], "dist": 10, "yaw": -0.35, "pitch": 0.6},
  "terrain": {"radius": [3, 2.4], "surface": "stone", "cliff": "stone"},
  "materials": {
    "stone": {"ramp": ["#303743", "#566375", "#88969f"], "pattern": "strata"},
    "lamp": {"ramp": ["#b8603c", "#ffd893"], "glow": true}
  },
  "shapes": [
    {"id": "tower", "kind": "cylinder", "at": [0, 0, 0], "anchor": "ground", "material": "stone", "radius": 0.45, "height": 1.7},
    {"id": "beacon", "kind": "dome", "at": [0, 1.7, 0], "anchor": "ground", "material": "lamp", "radius": 0.37, "height": 0.34}
  ]
}
```

## 顶层字段

| 字段 | 用法 |
| --- | --- |
| `title`、`seed` | 可读标题和整数种子。种子控制地形噪声、稳定散布和材质纹理。可另设 `locale` 为 `zh-CN` 或 `en`。 |
| `background`、`sun` | 六位十六进制色值和主光 XYZ 方向。Y 向上，视点在默认的 Z 正侧。 |
| `spacing` | 世界单位的表面采样间距，默认 0.105。缩小会提高样本数量。局部也可给单一物体设置间距。 |
| `resolution` | 内部渲染宽度，支持 384（默认）、480 或 576。画面始终为 4:3。 |
| `camera` | `target` XYZ，`dist`、`yaw`、`pitch`。角度用弧度。8 秒弱环绕自动播放，允许交互转动。 |
| `terrain` | `radius` 为 XZ 半径，`height` 为基准高度，`depth` 为岩基深度，`edge` 为外缘曲折。指定 `surface`、`cliff`、可选 `capCliff` 和 `pathMaterial`。`hills` 各项为 `[x,z,高差,x宽,z宽]`。 |
| `materials` | 按角色命名为对象，每项有暗到亮的 `ramp`。可选 `texture`、`bias`、`glow`、`pattern`。纹理模式有 `strata`、`planks`、`masonry` 和 `fracture`（带错缝的断裂岩层）。阶梯色计入场景调色板。 |
| `shapes` | 带稳定 `id` 的手定部件。每个部件指定 `kind`、`at`、`material`，形体参数见下文。 |
| `clearPaths` | XZ 点列组成的通路，供地表着色与散布留白。 |
| `scatter` | `rock`、`fir`、`maple`、`broadleaf` 或 `reed` 的散布规则。每条给定 `id`、`bounds` 为 `[xmin,zmin,xmax,zmax]`、`count`、`material`，可加 `accent`、`trunk`、`minSize`、`maxSize`、`separation`、`clearance`、`waterMin`、`waterMax`。岸线距离是按半径归一化的，水面内为负。 |
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
| `ledge` | `at` 为中心，`size` 为宽、高、深。`accent` 在顶面和上缘形成零散覆盖层，`moss` 在部分岩缝着色。 |
| `cascade` | 从崖沿的 XYZ `at` 落到 `to`，终点必须低于起点。用 `width` 与 `endWidth` 控制水幅。`thickness` 指水股前后的标称厚度，缺省按宽度计算。`strands` 控制水体横截面的卷曲数量（1 到 8），缺省随宽度变化。`accent` 用于水丝与落点泡沫，`splash` 控制溅水和泡沫向下游延展的长度。 |
| `stream` | 从 `at` 流向 `to`，两点的 XZ 位置需分开。用 `width`、可选的 `endWidth` 和 `accent` 控制水带和水纹。 |
| `dragon` | 伏在平台上的有翼龙，`at` 为足底高度，`yaw` 控制朝向，头默认朝 −X。用 `radius` 整体缩放，`material` 为鳞皮，`accent` 为腹甲和爪，`face` 为翼膜，可用深色 `recess` 画眼窝和颌线。 |
| `rock` | `at` 为中心，`size` 为宽、高、深，`accent` 可作浅色或积雪顶。 |
| `cylinder`、`cone` | `at` 为底面中心，`radius`、`height` 和可选 `topRadius`。 |
| `dome`、`dish` | `at` 为底面中心，`radius`、`height`，`accent` 可作接缝或内外反差。使用 `tilt` 摆放天线。 |
| `gable` | `at` 为屋檐中点，`size` 为宽、坡顶高度、深。可用 `face` 和 `accent` 区分山墙和屋面。 |
| `fir` | `at` 为根部，`height` 控制高度，`radius` 控制横展，默认取高度的约 0.27 倍。用 `trunk` 指木材，`accent` 指伸展枝片上侧的积雪。 |
| `maple` | `at` 为根部，`height` 控制高度，`radius` 控制横展，默认取高度的 0.42 倍。用 `trunk` 指木材，`accent` 指靠上的叶团。 |
| `broadleaf` | 高干、板根和外展枝冠，适合榕树、木棉等场景化阔叶树。 `at` 为根部，`height` 控制高度，`radius` 控制横展，默认取高度的 0.49 倍。`trunk` 指木材，`accent` 指靠上的叶团。 |
| `reed` | `at` 为根部，`height` 控制高度。 |
| `beam` | 从 `at` 到 `to` 的细杆，`radius` 设置粗细。 |

把密集采样留给主角和入口。只给会跨场景复用的形体和规则增加字段。输出跨版本布局时，以稳定 ID 对齐记录。

把上游水带终点接到瀑布起点，再把瀑布落点接到下一段水带或池面。两段在接缝处应有相近的高度和宽度。`cascade` 和 `stream` 的方向由端点决定，落水以近似抛物线离开崖沿，水丝沿路径加速拉长，边缘水滴从主水体分离。落点生成向外扩散的泡沫和抛起的水花。下方有池水时，把落点 Y 对齐池面以生成向外传播的波纹。固定镜头检查流向和速度，从近侧确认落点接到池面。设置 `anchor: "ground"` 时两个端点使用相同的起点地面偏移。探索模式中的高台和水道需要单独配置行走面和碰撞区。

## 参数经验值与防坑速查

- 全局 `spacing` 从 `0.09–0.11` 起步，把局部 `0.055–0.07` 留给主体和入口。单个场景最多生成 215,000 个 splats。构建会报告数量，`--review` 另报占用率。如果构建报超限，先调大非主体的局部 `spacing`，再适当调大全局间距或减少散布和重复小件，重建后复查主体细节。
- `camera.dist` 从 `terrain.radius` 最大值的约 `3.2–4.0` 倍起步。结合 `camera.target` 和俯仰角调整，检查两个视角下高物体和远端地形是否出画。
- 让根部贴地的形体使用 `anchor: "ground"`，圆柱或树干的 `at[1]` 从 `0` 起步，按中心定位的盒体可从半高起步。贴地偏移还需结合坡面和视角检查。给大物体设置覆盖其占地的 `keepOut`，为散布留出空间。手动摆放的形体要另外检查相互穿插。
- 优先复用 4–6 组 `materials` 阶梯色。让相近物体共享色阶，用纹理或光照区分细节，为背景、水色和 `extraColors` 留出余量。
- `--review` 按 `terrain.radius` 的基准 XZ 椭圆标出锚点越界的形体。结合两张静态审图核对起伏岸线、大形体边缘和悬挑。
