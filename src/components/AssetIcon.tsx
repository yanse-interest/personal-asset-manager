import type { ComponentType } from 'react';
import {
  Activity, AirVent, Album, Aperture, Armchair, AudioLines, Axe, Bed, Bike, BookOpen, BriefcaseBusiness, Bus, Camera, Car, CarFront,
  Clapperboard, CookingPot, Cpu, Drill, Dumbbell, Fan, Film, Flashlight, Focus, Footprints, Fuel, GalleryHorizontal,
  Gamepad2, Guitar, Hammer, HardDrive, Headphones, HeartPulse, Heater, House, Image, Images, Keyboard, Lamp, LampDesk, Laptop,
  Lightbulb, MemoryStick, Medal, Mic, Microwave, Monitor, Mountain, Mouse, Music, Navigation, Paintbrush, Pickaxe,
  Plane, Printer, Projector, Radio, Refrigerator, Router, Ruler, Sailboat, ScanLine, Scissors, PenTool,
  Scan, Server, Ship, ShowerHead, Shovel, Smartphone, SmartphoneCharging, Snowflake, Speaker, Tablet, TabletSmartphone,
  Target, TentTree, Timer, Toilet, TrainFront, Trophy, Truck, Tv, Usb, Video, Watch, Waves, Webcam, Wifi,
  Wind, WashingMachine, Wrench, Gauge, CloudFog, Coffee, CupSoda, EthernetPort,
} from 'lucide-react';
import { assetIconById, automaticAssetIconId } from '../domain/iconCatalog';
import { assetEmoji } from './AppIcon';

const lineIcons: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  laptop: Laptop, smartphone: Smartphone, tablet: Tablet, monitor: Monitor, keyboard: Keyboard, mouse: Mouse,
  'hard-drive': HardDrive, cpu: Cpu, 'memory-stick': MemoryStick, router: Router, wifi: Wifi, printer: Printer,
  camera: Camera, video: Video, headphones: Headphones, speaker: Speaker, microphone: Mic, radio: Radio,
  tv: Tv, watch: Watch, car: Car, 'car-front': CarFront, bus: Bus, truck: Truck, bike: Bike,
  'train-front': TrainFront, plane: Plane, ship: Ship, sailboat: Sailboat, fuel: Fuel, navigation: Navigation, gauge: Gauge,
  bed: Bed, armchair: Armchair, lamp: Lamp, 'lamp-desk': LampDesk, refrigerator: Refrigerator, 'cooking-pot': CookingPot,
  'air-vent': AirVent, fan: Fan, lightbulb: Lightbulb, 'shower-head': ShowerHead, toilet: Toilet, house: House,
  dumbbell: Dumbbell, trophy: Trophy, medal: Medal, target: Target, timer: Timer, activity: Activity,
  'heart-pulse': HeartPulse, footprints: Footprints, mountain: Mountain, waves: Waves, 'tent-tree': TentTree,
  snowflake: Snowflake, hammer: Hammer, wrench: Wrench, screwdriver: PenTool, drill: Drill, axe: Axe,
  shovel: Shovel, pickaxe: Pickaxe, ruler: Ruler, scissors: Scissors, paintbrush: Paintbrush, flashlight: Flashlight,
  'briefcase-business': BriefcaseBusiness, aperture: Aperture, image: Image, images: Images, film: Film,
  clapperboard: Clapperboard, projector: Projector, focus: Focus, 'scan-line': ScanLine,
  'gallery-horizontal': GalleryHorizontal, album: Album, music: Music, guitar: Guitar,
  'tablet-smartphone': TabletSmartphone, 'smartphone-charging': SmartphoneCharging, webcam: Webcam, server: Server,
  usb: Usb, scan: Scan, 'ethernet-port': EthernetPort, 'gamepad-2': Gamepad2, 'book-open': BookOpen, 'audio-lines': AudioLines,
  'robot-vacuum': RobotVacuumIcon, 'water-purifier': WaterPurifierIcon, 'washing-machine': WashingMachine,
  microwave: Microwave, heater: Heater, 'air-purifier': Wind, humidifier: CloudFog, 'coffee-maker': Coffee,
  'electric-kettle': CupSoda, treadmill: TreadmillIcon,
};

function RobotVacuumIcon({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="9" r="1.5"/><path d="M8 16h8M12 4V2M18.5 17.5 21 20M5.5 17.5 3 20"/></svg>;
}

function WaterPurifierIcon({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M14 10h3v3h-3M10 17c0 1.2.9 2 2 2s2-.8 2-2c0-1.3-2-3.5-2-3.5S10 15.7 10 17Z"/></svg>;
}

function TreadmillIcon({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="15" cy="4" r="2"/><path d="m13 8-2 4 4 2 2 4M13 8l4 3 2-2M11 12l-3 4M4 20h15l2-7M6 20l-2-2"/></svg>;
}

export function AssetIcon({ id, name = '', categoryName, size = 52 }: { id?: string | null; name?: string; categoryName?: string | null; size?: number }) {
  const automaticId = id ? null : automaticAssetIconId(name, categoryName);
  const item = assetIconById.get(id ?? automaticId ?? '');
  if (item?.kind === '3d') return <img className="chosen-asset-icon" src={`${import.meta.env.BASE_URL}asset-icons/fluent-3d/${item.value}.png`} alt="" width={size} height={size} loading="lazy" />;
  if (item?.kind === 'line') {
    const Icon = lineIcons[item.value];
    if (Icon) return <Icon size={Math.round(size * .68)} strokeWidth={1.8} />;
  }
  return <span className="chosen-asset-emoji" aria-hidden="true" style={{ fontSize: size * .9 }}>{item?.kind === 'emoji' ? item.value : assetEmoji(name, categoryName)}</span>;
}
