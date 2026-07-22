import type { CategoryKey } from '../domain/schemas.js';

export interface SeedProduct {
  categoryKey: CategoryKey;
  brand: string;
  name: string;
}

const category = (categoryKey: CategoryKey, entries: Array<[string, string]>): SeedProduct[] =>
  entries.map(([brand, name]) => ({ categoryKey, brand, name }));

export const seedProducts: SeedProduct[] = [
  ...category('backpacks', [
    ['Salomon', 'ADV Skin 12 Hydration Vest'], ['Salomon', 'ADV Skin 5 Hydration Vest'],
    ['Osprey', 'Talon 22'], ['Osprey', 'Stratos 36'], ['Hyperlite Mountain Gear', '3400 Southwest'],
    ['Gossamer Gear', 'Mariposa 60'], ['Zpacks', 'Arc Haul Ultra 60L'], ['Nathan', 'Pinnacle 12L Race Vest']
  ]),
  ...category('trail-shoes', [
    ['New Balance', 'Fresh Foam X Hierro v8'], ['Salomon', 'Sense Ride 5'], ['Altra', 'Lone Peak 8'],
    ['Hoka', 'Speedgoat 6'], ['Brooks', 'Cascadia 17'], ['La Sportiva', 'Bushido III'],
    ['Saucony', 'Peregrine 14'], ['Topo Athletic', 'MTN Racer 3']
  ]),
  ...category('insulation', [
    ["Arc'teryx", 'Cerium SL Hoody'], ['Patagonia', 'Micro Puff Hoody'], ['Patagonia', 'Nano Puff Hoody'],
    ['Outdoor Research', 'Helium Down Hoody'], ['Montbell', 'Plasma 1000 Down Jacket'],
    ['Western Mountaineering', 'Flash Jacket']
  ]),
  ...category('trekking-poles', [
    ['Black Diamond', 'Distance Carbon Z Poles'], ['Black Diamond', 'Distance FLZ Carbon Poles'],
    ['Leki', 'Micro Vario Carbon Poles'], ['Gossamer Gear', 'LT5 Carbon Poles'],
    ['REI Co-op', 'Flash Carbon Trekking Poles']
  ]),
  ...category('electrolytes', [
    ['LMNT', 'Electrolyte Packets'], ['ReLyte', 'Electrolyte Mix'], ['Precision Hydration', 'PH 1000'],
    ['Precision Hydration', 'PH 1500'], ['Nuun', 'Sport Tablets'], ['SaltStick', 'Fastchews']
  ]),
  ...category('hydration', [
    ['Salomon', 'Soft Flask 500ml'], ['Salomon', 'Soft Flask 250ml'], ['HydraPak', 'SoftFlask 500ml'],
    ['Platypus', 'SoftBottle 1L'], ['Sawyer', 'Squeeze Water Filter System']
  ]),
  ...category('shell-rain', [
    ["Arc'teryx", 'Norvan SL Hoody'], ["Arc'teryx", 'Wind Jacket'], ['Patagonia', 'Houdini Jacket'],
    ['Outdoor Research', 'Helium Rain Jacket'], ['Black Diamond', 'Liquid Point Shell'],
    ['Montbell', 'Versalite Rain Jacket']
  ]),
  ...category('headlamps', [
    ['Black Diamond', 'Spot 400'], ['Black Diamond', 'Storm 500'], ['Petzl', 'Actik Core'],
    ['Petzl', 'Swift RL'], ['Fenix', 'HM65R-T']
  ])
];
