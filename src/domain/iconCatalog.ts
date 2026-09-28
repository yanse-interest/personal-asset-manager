import extraThreeDGroups from './extra3DIcons.json';
import additionalLineIcons from './additionalLineIcons.json';
import legacyLineLabels from './legacyLineLabels.json';

export type AssetIconKind = 'line';
export interface AssetIconChoice { id: string; kind: AssetIconKind; category: string; label: string; value: string }

const threeDNames = 'Abacus|Accordion|Airplane|Alarm clock|Ambulance|Anchor|Articulated lorry|Automobile|Axe|Backpack|Badminton|Balance scale|Banjo|Baseball|Basket|Basketball|Bathtub|Battery|Bed|Bicycle|Billed cap|Books|Bottle with popping cork|Bowl with spoon|Bowling|Boxing glove|Brick|Briefcase|Broom|Bucket|Bullet train|Bus|Calendar|Camera with flash|Camera|Camping|Canoe|Card file box|Carpentry saw|Chains|Chair|Chess pawn|Clapper board|Classical building|Computer disk|Computer mouse|Couch and lamp|Desktop computer|Electric plug|Flashlight|Floppy disk|Fountain pen|Framed picture|Game die|Gear|Guitar|Hammer|Headphone|High-heeled shoe|Hiking boot|House|Joystick|Key|Keyboard|Kitchen knife|Ladder|Laptop|Light bulb|Watch|Loudspeaker|Luggage|Magnifying glass tilted left|Microphone|Mobile phone|Money bag|Motor boat|Motor scooter|Musical keyboard|Nut and bolt|Office building|Pager|Paintbrush|Pencil|Pick|Pickup truck|Printer|Radio|Racing car|Roller skate|Safety vest|Satellite antenna|Saxophone|Scissors|Screwdriver|Shopping bags|Shopping cart|Skis|Speaker high volume|Studio microphone|Television'.split('|');
const lineGroups: Record<string, string[]> = {
  数码: 'laptop smartphone tablet monitor keyboard mouse hard-drive cpu memory-stick router wifi printer camera video headphones speaker microphone radio tv watch tablet-smartphone smartphone-charging webcam server usb scan ethernet-port gamepad-2 book-open audio-lines'.split(' '),
  交通: 'car car-front bus truck bike train-front plane ship sailboat fuel navigation gauge'.split(' '),
  家居: 'bed armchair lamp lamp-desk refrigerator cooking-pot air-vent fan lightbulb shower-head toilet house'.split(' '),
  家电: 'robot-vacuum water-purifier washing-machine microwave heater air-purifier humidifier coffee-maker electric-kettle'.split(' '),
  运动: 'dumbbell trophy medal target timer activity heart-pulse footprints mountain waves tent-tree snowflake treadmill'.split(' '),
  工具: 'hammer wrench screwdriver drill axe shovel pickaxe ruler scissors paintbrush flashlight briefcase-business'.split(' '),
  影音: 'aperture image images film clapperboard projector focus scan-line gallery-horizontal album music guitar'.split(' '),
};

const specialLineIcons: { value: string; category: string; label: string }[] = [
  { value: 'desk', category: '家具', label: '书桌 办公桌 桌子' },
  { value: 'gaming-desk', category: '家具', label: '电竞桌 游戏桌' },
  { value: 'side-table', category: '家具', label: '边桌 边几' },
  { value: 'bedside-cabinet', category: '家具', label: '床边柜 床头柜' },
  { value: 'coffee-table', category: '家具', label: '茶几' },
  { value: 'dining-table', category: '家具', label: '餐桌' },
  { value: 'bookshelf', category: '家具', label: '书架' },
  { value: 'wardrobe', category: '家具', label: '衣柜' },
  { value: 'shoe-rack', category: '家具', label: '鞋架' },
  { value: 'display-shelf', category: '家具', label: '置物架 展示架' },
  { value: 'ergonomic-chair', category: '家具', label: '人体工学椅 人体工学办公椅 工学椅' },
  { value: 'monitor-riser', category: '数码', label: '显示器增高架 显示器支架' },
  { value: 'laptop-stand', category: '数码', label: '笔记本支架 电脑支架' },
  { value: 'adjustable-laptop-stand', category: '数码', label: '可调节笔记本支架 升降电脑支架' },
  { value: 'folding-laptop-stand', category: '数码', label: '折叠笔记本支架' },
  { value: 'vertical-laptop-stand', category: '数码', label: '立式笔记本支架 竖放电脑支架' },
  { value: 'microphone-stand', category: '影音', label: '麦克风支架 话筒支架' },
  { value: 'microphone-boom-arm', category: '影音', label: '麦克风悬臂支架 桌面话筒架' },
];

const lineLabels: Record<string, string> = {
  laptop: '笔记本电脑', smartphone: '手机', tablet: '平板电脑', monitor: '显示器', keyboard: '键盘', mouse: '鼠标',
  router: '路由器', wifi: '无线网络', printer: '打印机', camera: '相机', video: '摄像机', headphones: '耳机',
  speaker: '音箱', microphone: '麦克风', radio: '收音机', tv: '电视', watch: '智能手表',
  'tablet-smartphone': '手机与平板', 'smartphone-charging': '充电中的手机', webcam: '网络摄像头', server: '服务器',
  usb: 'USB 设备', scan: '扫描仪', 'ethernet-port': '网络设备', 'gamepad-2': '游戏机', 'book-open': '电子阅读器', 'audio-lines': '无线耳机',
  refrigerator: '冰箱', 'air-vent': '空调', fan: '风扇', lightbulb: '灯具',
  'robot-vacuum': '扫地机器人', 'water-purifier': '净饮水机', 'washing-machine': '洗衣机', microwave: '微波炉',
  heater: '取暖器', 'air-purifier': '空气净化器', humidifier: '加湿器', 'coffee-maker': '咖啡机', 'electric-kettle': '电水壶',
  treadmill: '跑步机',
  bed: '床', armchair: '扶手椅', lamp: '台灯', 'lamp-desk': '书桌台灯', house: '房屋',
  'cooking-pot': '锅具', 'shower-head': '花洒', toilet: '马桶', 'hard-drive': '硬盘', cpu: '处理器',
  'memory-stick': '内存条', car: '汽车', bus: '公交车', truck: '卡车', bike: '自行车', plane: '飞机',
  ship: '轮船', sailboat: '帆船', 'train-front': '火车', fuel: '加油机',
  dumbbell: '哑铃', trophy: '奖杯', medal: '奖牌', hammer: '锤子', wrench: '扳手',
  scissors: '剪刀', flashlight: '手电筒', guitar: '吉他', music: '音乐', film: '电影胶片',
  'car-front': '汽车正面', navigation: '导航设备', gauge: '仪表盘',
  target: '靶子', timer: '计时器', activity: '运动记录', 'heart-pulse': '心率监测',
  footprints: '脚印', mountain: '山地', waves: '水上运动', 'tent-tree': '露营帐篷', snowflake: '雪花',
  screwdriver: '螺丝刀', drill: '电钻', axe: '斧头', shovel: '铲子', pickaxe: '镐', ruler: '尺子',
  paintbrush: '画笔', 'briefcase-business': '工具箱',
  aperture: '相机光圈', image: '照片', images: '相册', clapperboard: '场记板',
  projector: '投影仪', focus: '对焦', 'scan-line': '扫描线',
  'gallery-horizontal': '画廊', album: '影集',
};

function categoryOf3D(name: string): string {
  const value = name.toLowerCase();
  if (/^bed$|^chair$|^couch and lamp$/.test(value)) return '家具';
  if (/computer|laptop|phone|keyboard|pager|printer|battery|plug|disk|television|watch/.test(value)) return '数码';
  if (/airplane|ambulance|lorry|automobile|bicycle|train|bus|boat|scooter|truck|car/.test(value)) return '交通';
  if (/bathtub|bed|basket|broom|bucket|chair|couch|house|building|light bulb/.test(value)) return '家居';
  if (/badminton|baseball|basketball|bowling|boxing|skis|roller/.test(value)) return '运动';
  if (/axe|scale|brick|saw|chains|gear|hammer|key|knife|ladder|bolt|paintbrush|pencil|pick|scissors|screwdriver/.test(value)) return '工具';
  if (/accordion|banjo|camera|clapper|guitar|headphone|microphone|radio|saxophone|speaker/.test(value)) return '影音';
  return '其他';
}
const slug = (name: string) => name.toLowerCase().replaceAll(' ', '_');
const baseLineChoices: AssetIconChoice[] = [
  ...Object.entries(lineGroups).flatMap(([category, values]) => values.map(value => ({ id: `line:${value}`, kind: 'line' as const, category, label: lineLabels[value] ?? `${category} ${value}`, value }))),
  ...specialLineIcons.map(({ value, category, label }) => ({ id: `line:${value}`, kind: 'line' as const, category, label, value })),
];
const convertedChoices: AssetIconChoice[] = [
  ...threeDNames.map(name => ({ id: `line:${slug(name)}`, kind: 'line' as const, category: categoryOf3D(name), label: legacyLineLabels[name as keyof typeof legacyLineLabels] ?? name, value: slug(name) })),
  ...Object.entries(extraThreeDGroups).flatMap(([category, entries]) => entries.map(entry => { const name = entry[0]!; return { id: `line:${slug(name)}`, kind: 'line' as const, category, label: entry[1]!, value: slug(name) }; })),
];
const additionalChoices: AssetIconChoice[] = Object.entries(additionalLineIcons).flatMap(([category, entries]) => entries.map(entry => ({ id: `line:${entry[0]!}`, kind: 'line' as const, category, label: entry[1]!, value: entry[0]! })));
const choices = [...baseLineChoices, ...convertedChoices, ...additionalChoices];
export const assetIcons: AssetIconChoice[] = choices.filter((item, index) => choices.findIndex(other => other.id === item.id) === index);
export const assetIconById = new Map(assetIcons.map(item => [item.id, item]));

// Keep historical selections valid in IndexedDB and imported backups. Their
// stored IDs remain unchanged; every old ID now resolves to a line drawing.
for (const name of threeDNames) assetIconById.set(`3d:${slug(name)}`, assetIconById.get(`line:${slug(name)}`)!);
for (const entries of Object.values(extraThreeDGroups)) for (const [name] of entries) assetIconById.set(`3d:${slug(name!)}`, assetIconById.get(`line:${slug(name!)}`)!);

const legacyEmojiTargets: Record<string, string[]> = {
  数码: 'laptop monitor keyboard mouse printer smartphone telephone tv radio headphones microphone studio_microphone camera video movie_camera battery electric_plug light_bulb watch gamepad-2'.split(' '),
  交通: 'car taxi sport_utility_vehicle bus tram racing_car police_car ambulance fire_engine minibus pickup_truck delivery_truck articulated_lorry tractor motor_scooter motorcycle bicycle kick_scooter locomotive airplane'.split(' '),
  家居: 'bed couch_and_lamp chair door mirror window toilet shower bathtub broom basket bucket soap sponge toothbrush fire_extinguisher refrigerator cooking teapot coffee-maker'.split(' '),
  运动: 'running_shoe dumbbell bicycle waves soccer_ball basketball baseball baseball baseball tennis volleyball goal_net optical_disk bowling ping_pong badminton boxing_glove martial_arts_uniform goal_net skis'.split(' '),
  工具: 'hammer axe pickaxe hammer wrench kitchen_knife wrench screwdriver nut_and_bolt gear clamp balance_scale hiking_boot chains chains anchor toolbox magnet ladder scissors'.split(' '),
  其他: 'musical_keyboard guitar violin trumpet saxophone banjo drum long_drum artist_palette luggage backpack glasses sunglasses crown ring gem_stone handbag running_shoe hiking_boot coat'.split(' '),
};
for (const [category, targets] of Object.entries(legacyEmojiTargets)) {
  for (let index = 0; index < 20; index += 1) {
    const choice = assetIconById.get(`line:${targets[index]}`);
    if (choice) assetIconById.set(`emoji:${category}:${index}`, choice);
  }
}
export function normalizedAssetIconId(id: string | null | undefined): string | null { return assetIconById.get(id ?? '')?.id ?? null; }
export function isAssetIconId(value: unknown): value is string { return typeof value === 'string' && assetIconById.has(value); }

export function automaticAssetIconId(name: string, categoryName?: string | null): string | null {
  const value = `${name} ${categoryName ?? ''}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/麦克风.*(悬臂|桌面).*支架|话筒.*悬臂/, 'microphone-boom-arm'],
    [/麦克风支架|话筒支架|mic(?:rophone)? stand/, 'microphone-stand'],
    [/显示器.*(增高架|支架)|monitor riser/, 'monitor-riser'],
    [/立式.*笔记本.*支架|竖放.*电脑.*支架|vertical laptop stand/, 'vertical-laptop-stand'],
    [/可调.*笔记本.*支架|升降.*电脑.*支架|adjustable laptop stand/, 'adjustable-laptop-stand'],
    [/折叠.*笔记本.*支架|folding laptop stand/, 'folding-laptop-stand'],
    [/笔记本支架|电脑支架|laptop stand/, 'laptop-stand'],
    [/床边柜|床头柜|nightstand|bedside cabinet/, 'bedside-cabinet'],
    [/边桌|边几|side table/, 'side-table'],
    [/电竞桌|游戏桌|gaming desk/, 'gaming-desk'],
    [/书桌|办公桌|desk/, 'desk'],
    [/茶几|coffee table/, 'coffee-table'], [/餐桌|dining table/, 'dining-table'],
    [/书架|bookshelf/, 'bookshelf'], [/衣柜|wardrobe/, 'wardrobe'], [/鞋柜|shoe cabinet/, 'shoe-cabinet'],
    [/沙发|sofa/, 'couch_and_lamp'], [/人体工学(?:办公)?椅|工学(?:办公)?椅|ergonomic chair/, 'ergonomic-chair'],
    [/办公椅|电竞椅|office chair/, 'office-chair'],
    [/轮椅|wheelchair/, 'wheelchair'], [/椅子|chair/, 'chair'],
    [/床垫|mattress/, 'mattress'], [/婴儿床|crib/, 'crib'], [/床|bed/, 'bed'],
    [/扩展坞|docking station/, 'docking-station'], [/移动硬盘|固态硬盘|ssd/, 'external-ssd'],
    [/充电宝|power bank/, 'power-bank'], [/显示器悬臂|monitor arm/, 'monitor-arm'],
    [/无人机|drone/, 'drone'], [/游戏主机|台式电脑|gaming pc/, 'gaming-pc'],
    [/空气炸锅|air fryer/, 'air-fryer'], [/烤箱|oven/, 'oven'], [/电磁炉|induction cooker/, 'induction-cooker'],
    [/吸尘器|vacuum cleaner/, 'vacuum-cleaner'], [/洗碗机|dishwasher/, 'dishwasher'],
    [/烘干机|dryer/, 'clothes-dryer'], [/除湿机|dehumidifier/, 'dehumidifier'],
    [/瑜伽垫|yoga mat/, 'yoga-mat'], [/动感单车|exercise bike/, 'exercise-bike'],
    [/血压计|blood pressure/, 'blood-pressure-monitor'], [/电动牙刷|electric toothbrush/, 'electric-toothbrush'],
    [/宠物窝|猫窝|pet bed/, 'pet-bed'], [/猫砂盆|litter box/, 'litter-box'], [/鱼缸|fish tank/, 'fish-tank'],
    [/相机|camera/, 'camera'], [/耳机|headphones?/, 'headphones'], [/电视|television/, 'tv'],
    [/冰箱|refrigerator/, 'refrigerator'], [/空调|air conditioner/, 'air-vent'], [/风扇|fan/, 'fan'],
    [/键盘|keyboard/, 'keyboard'], [/鼠标|mouse/, 'mouse'], [/台灯|桌灯|desk lamp/, 'lamp-desk'],
    [/扫地机器人|扫地机|robot vacuum/, 'robot-vacuum'], [/净饮水机|净水机|饮水机|净水器|water purifier/, 'water-purifier'],
    [/跑步机|treadmill/, 'treadmill'], [/洗衣机|washing machine/, 'washing-machine'], [/微波炉|microwave/, 'microwave'],
    [/空气净化器|air purifier/, 'air-purifier'], [/加湿器|humidifier/, 'humidifier'], [/取暖器|暖风机|heater/, 'heater'],
    [/咖啡机|coffee maker/, 'coffee-maker'], [/电水壶|热水壶|kettle/, 'electric-kettle'], [/平板|ipad|tablet/, 'tablet'],
    [/手机|phone/, 'smartphone'], [/游戏机|game console/, 'gamepad-2'], [/电子书|阅读器|kindle/, 'book-open'],
  ];
  const icon = rules.find(([pattern]) => pattern.test(value))?.[1];
  return icon ? `line:${icon}` : null;
}
