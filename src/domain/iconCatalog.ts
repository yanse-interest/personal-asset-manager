export type AssetIconKind = '3d' | 'emoji' | 'line';
export interface AssetIconChoice { id: string; kind: AssetIconKind; category: string; label: string; value: string }

const threeDNames = 'Abacus|Accordion|Airplane|Alarm clock|Ambulance|Anchor|Articulated lorry|Automobile|Axe|Backpack|Badminton|Balance scale|Banjo|Baseball|Basket|Basketball|Bathtub|Battery|Bed|Bicycle|Billed cap|Books|Bottle with popping cork|Bowl with spoon|Bowling|Boxing glove|Brick|Briefcase|Broom|Bucket|Bullet train|Bus|Calendar|Camera with flash|Camera|Camping|Canoe|Card file box|Carpentry saw|Chains|Chair|Chess pawn|Clapper board|Classical building|Computer disk|Computer mouse|Couch and lamp|Desktop computer|Electric plug|Flashlight|Floppy disk|Fountain pen|Framed picture|Game die|Gear|Guitar|Hammer|Headphone|High-heeled shoe|Hiking boot|House|Joystick|Key|Keyboard|Kitchen knife|Ladder|Laptop|Light bulb|Watch|Loudspeaker|Luggage|Magnifying glass tilted left|Microphone|Mobile phone|Money bag|Motor boat|Motor scooter|Musical keyboard|Nut and bolt|Office building|Pager|Paintbrush|Pencil|Pick|Pickup truck|Printer|Radio|Racing car|Roller skate|Safety vest|Satellite antenna|Saxophone|Scissors|Screwdriver|Shopping bags|Shopping cart|Skis|Speaker high volume|Studio microphone|Television'.split('|');
const emojiGroups: Record<string, string[]> = {
  数码: '💻 🖥️ ⌨️ 🖱️ 🖨️ 📱 ☎️ 📺 📻 🎧 🎤 🎙️ 📷 📹 🎥 🔋 🔌 💡 ⌚ 🎮'.split(' '),
  交通: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚂 ✈️'.split(' '),
  家居: '🛏️ 🛋️ 🪑 🚪 🪞 🪟 🚽 🚿 🛁 🧹 🧺 🪣 🧼 🧽 🪥 🧯 🧊 🍳 🫖 ☕'.split(' '),
  运动: '🏃 🏋️ 🚴 🏊 ⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎳 🏓 🏸 🥊 🥋 ⛳ 🎿'.split(' '),
  工具: '🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🦯 🔗 ⛓️ 🪝 🧰 🧲 🪜 ✂️'.split(' '),
  其他: '🎹 🎸 🎻 🎺 🎷 🪕 🥁 🪘 🎨 🧳 🎒 👓 🕶️ 👑 💍 💎 👜 👟 🥾 🧥'.split(' '),
};
const lineGroups: Record<string, string[]> = {
  数码: 'laptop smartphone tablet monitor keyboard mouse hard-drive cpu memory-stick router wifi printer camera video headphones speaker microphone radio tv watch tablet-smartphone smartphone-charging webcam server usb scan ethernet-port gamepad-2 book-open audio-lines'.split(' '),
  交通: 'car car-front bus truck bike train-front plane ship sailboat fuel navigation gauge'.split(' '),
  家居: 'bed armchair lamp lamp-desk refrigerator cooking-pot air-vent fan lightbulb shower-head toilet house'.split(' '),
  家电: 'robot-vacuum water-purifier washing-machine microwave heater air-purifier humidifier coffee-maker electric-kettle'.split(' '),
  运动: 'dumbbell trophy medal target timer activity heart-pulse footprints mountain waves tent-tree snowflake treadmill'.split(' '),
  工具: 'hammer wrench screwdriver drill axe shovel pickaxe ruler scissors paintbrush flashlight briefcase-business'.split(' '),
  影音: 'aperture image images film clapperboard projector focus scan-line gallery-horizontal album music guitar'.split(' '),
};

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
};

function categoryOf3D(name: string): string {
  const value = name.toLowerCase();
  if (/computer|laptop|phone|keyboard|pager|printer|battery|plug|disk|television|watch/.test(value)) return '数码';
  if (/airplane|ambulance|lorry|automobile|bicycle|train|bus|boat|scooter|truck|car/.test(value)) return '交通';
  if (/bathtub|bed|basket|broom|bucket|chair|couch|house|building|light bulb/.test(value)) return '家居';
  if (/badminton|baseball|basketball|bowling|boxing|skis|roller/.test(value)) return '运动';
  if (/axe|scale|brick|saw|chains|gear|hammer|key|knife|ladder|bolt|paintbrush|pencil|pick|scissors|screwdriver/.test(value)) return '工具';
  if (/accordion|banjo|camera|clapper|guitar|headphone|microphone|radio|saxophone|speaker/.test(value)) return '影音';
  return '其他';
}
export const assetIcons: AssetIconChoice[] = [
  ...threeDNames.map(name => ({ id: `3d:${name.toLowerCase().replaceAll(' ', '_')}`, kind: '3d' as const, category: categoryOf3D(name), label: name, value: name.toLowerCase().replaceAll(' ', '_') })),
  ...Object.entries(emojiGroups).flatMap(([category, values]) => values.map((value, index) => ({ id: `emoji:${category}:${index}`, kind: 'emoji' as const, category, label: `${category} ${value}`, value }))),
  ...Object.entries(lineGroups).flatMap(([category, values]) => values.map(value => ({ id: `line:${value}`, kind: 'line' as const, category, label: lineLabels[value] ?? `${category} ${value}`, value }))),
];
export const assetIconById = new Map(assetIcons.map(item => [item.id, item]));
export function isAssetIconId(value: unknown): value is string { return typeof value === 'string' && assetIconById.has(value); }

export function automaticAssetIconId(name: string, categoryName?: string | null): string | null {
  const value = `${name} ${categoryName ?? ''}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/扫地机器人|扫地机|robot vacuum/, 'robot-vacuum'], [/净饮水机|净水机|饮水机|净水器|water purifier/, 'water-purifier'],
    [/跑步机|treadmill/, 'treadmill'], [/洗衣机|washing machine/, 'washing-machine'], [/微波炉|microwave/, 'microwave'],
    [/空气净化器|air purifier/, 'air-purifier'], [/加湿器|humidifier/, 'humidifier'], [/取暖器|暖风机|heater/, 'heater'],
    [/咖啡机|coffee maker/, 'coffee-maker'], [/电水壶|热水壶|kettle/, 'electric-kettle'], [/平板|ipad|tablet/, 'tablet'],
    [/手机|phone/, 'smartphone'], [/游戏机|game console/, 'gamepad-2'], [/电子书|阅读器|kindle/, 'book-open'],
  ];
  const icon = rules.find(([pattern]) => pattern.test(value))?.[1];
  return icon ? `line:${icon}` : null;
}
