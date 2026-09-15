import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const names = 'Abacus|Accordion|Airplane|Alarm clock|Ambulance|Anchor|Articulated lorry|Automobile|Axe|Backpack|Badminton|Balance scale|Banjo|Baseball|Basket|Basketball|Bathtub|Battery|Bed|Bicycle|Billed cap|Books|Bottle with popping cork|Bowl with spoon|Bowling|Boxing glove|Brick|Briefcase|Broom|Bucket|Bullet train|Bus|Calendar|Camera with flash|Camera|Camping|Canoe|Card file box|Carpentry saw|Chains|Chair|Chess pawn|Clapper board|Classical building|Computer disk|Computer mouse|Couch and lamp|Desktop computer|Electric plug|Flashlight|Floppy disk|Fountain pen|Framed picture|Game die|Gear|Guitar|Hammer|Headphone|High-heeled shoe|Hiking boot|House|Joystick|Key|Keyboard|Kitchen knife|Ladder|Laptop|Light bulb|Watch|Loudspeaker|Luggage|Magnifying glass tilted left|Microphone|Mobile phone|Money bag|Motor boat|Motor scooter|Musical keyboard|Nut and bolt|Office building|Pager|Paintbrush|Pencil|Pick|Pickup truck|Printer|Radio|Racing car|Roller skate|Safety vest|Satellite antenna|Saxophone|Scissors|Screwdriver|Shopping bags|Shopping cart|Skis|Speaker high volume|Studio microphone|Television'.split('|');
const root = resolve('public/asset-icons/fluent-3d');
await mkdir(root, { recursive: true });
const failed = [];
let index = 0;
async function worker() {
  while (index < names.length) {
    const name = names[index++];
    const slug = name.toLowerCase().replaceAll(' ', '_');
    const url = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/${encodeURIComponent(name)}/3D/${slug}_3d.png`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 100 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new Error('不是 PNG');
      await writeFile(resolve(root, `${slug}.png`), bytes);
    } catch (error) { failed.push(`${name}: ${error}`); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const licenseResponse = await fetch('https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/LICENSE');
if (licenseResponse.ok) await writeFile(resolve('public/asset-icons/LICENSE-fluentui-emoji.txt'), await licenseResponse.text());
if (failed.length) { console.error(failed.join('\n')); process.exitCode = 1; }
console.log(`${names.length - failed.length}/${names.length} 个 Fluent 3D 图标已保存`);
