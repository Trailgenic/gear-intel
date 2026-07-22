import type { RubricDefinition } from '../domain/rubric.js';
import type { CategoryKey } from '../domain/schemas.js';

const version = '2.0.0';
const defaults = { minimumCoverage: 0.7, minimumSourceDiversity: 2 };

export const rubrics: Record<CategoryKey, RubricDefinition> = {
  backpacks: {
    ...defaults,
    categoryKey: 'backpacks', version, label: 'Backpacks',
    useCase: 'Fasted mountain sessions, sustained climbing, and alpine loads generally between 10 and 35 pounds.',
    dimensions: [
      { key: 'carry-efficiency', label: 'Carry Efficiency', weight: 0.25, minimumEvidence: 2, description: 'Metabolic cost, pack weight, and efficiency under the intended load.' },
      { key: 'load-stability', label: 'Load Stability', weight: 0.20, minimumEvidence: 2, description: 'Control during climbing, descending, scrambling, and fatigue.' },
      { key: 'body-impact', label: 'Body and Recovery Impact', weight: 0.15, minimumEvidence: 1, description: 'Pressure, circulation, chafing, and post-session recovery consequences.' },
      { key: 'thermal-management', label: 'Thermal Management', weight: 0.10, minimumEvidence: 1, description: 'Ventilation and sweat management under sustained exertion.' },
      { key: 'durability', label: 'Field Durability', weight: 0.15, minimumEvidence: 2, description: 'Repeat-use reliability in abrasive and alpine conditions.' },
      { key: 'protocol-fit', label: 'Protocol Fit', weight: 0.15, minimumEvidence: 1, description: 'Compatibility with TrailGenic fasted, altitude, cold, and recovery practices.' }
    ]
  },
  'trail-shoes': {
    ...defaults,
    categoryKey: 'trail-shoes', version, label: 'Trail Shoes',
    useCase: 'Fasted hiking and trail movement on steep, variable terrain where fatigue magnifies stability and foot-management demands.',
    dimensions: [
      { key: 'traction', label: 'Traction', weight: 0.22, minimumEvidence: 2, description: 'Grip across dry, wet, loose, and technical surfaces.' },
      { key: 'fatigue-stability', label: 'Fatigue Stability', weight: 0.20, minimumEvidence: 2, description: 'Control and predictable mechanics late in a session.' },
      { key: 'protection', label: 'Foot Protection', weight: 0.14, minimumEvidence: 1, description: 'Underfoot, toe, and lateral protection without excessive penalty.' },
      { key: 'metabolic-weight', label: 'Metabolic Weight', weight: 0.14, minimumEvidence: 1, description: 'Shoe mass and efficiency over repeated steps.' },
      { key: 'moisture-thermal', label: 'Moisture and Thermal Control', weight: 0.12, minimumEvidence: 1, description: 'Drainage, breathability, and temperature behavior.' },
      { key: 'durability', label: 'Field Durability', weight: 0.10, minimumEvidence: 2, description: 'Outsole, upper, and cushioning lifespan.' },
      { key: 'recovery-impact', label: 'Recovery Impact', weight: 0.08, minimumEvidence: 1, description: 'Pressure, soreness, and recovery implications.' }
    ]
  },
  insulation: {
    ...defaults,
    categoryKey: 'insulation', version, label: 'Insulation',
    useCase: 'Temperature management during alpine transitions, cold exposure, and recovery after high-output fasted sessions.',
    dimensions: [
      { key: 'warmth-weight', label: 'Warmth-to-Weight', weight: 0.25, minimumEvidence: 2, description: 'Thermal benefit relative to carried mass and volume.' },
      { key: 'moisture-control', label: 'Moisture Control', weight: 0.18, minimumEvidence: 2, description: 'Behavior with sweat, humidity, and light precipitation.' },
      { key: 'active-thermal-range', label: 'Active Thermal Range', weight: 0.17, minimumEvidence: 1, description: 'Usability across exertion and rest transitions.' },
      { key: 'packability', label: 'Packability', weight: 0.12, minimumEvidence: 1, description: 'Carried volume and deployment speed.' },
      { key: 'durability', label: 'Field Durability', weight: 0.13, minimumEvidence: 2, description: 'Shell, insulation, and construction longevity.' },
      { key: 'cold-protocol-fit', label: 'Cold Protocol Fit', weight: 0.15, minimumEvidence: 1, description: 'Compatibility with intentional cold exposure and safe rewarming.' }
    ]
  },
  'trekking-poles': {
    ...defaults,
    categoryKey: 'trekking-poles', version, label: 'Trekking Poles',
    useCase: 'Climbing and descending efficiency, stability under fatigue, and lower-body load management in alpine terrain.',
    dimensions: [
      { key: 'load-transfer', label: 'Load Transfer', weight: 0.24, minimumEvidence: 2, description: 'Useful redistribution of climbing and descending load.' },
      { key: 'stability', label: 'Fatigue Stability', weight: 0.20, minimumEvidence: 2, description: 'Predictable support on irregular terrain.' },
      { key: 'swing-weight', label: 'Swing Weight', weight: 0.15, minimumEvidence: 1, description: 'Upper-body metabolic cost over repeated cycles.' },
      { key: 'adjustability', label: 'Adjustment and Fit', weight: 0.12, minimumEvidence: 1, description: 'Range, locking, grip, and deployment usability.' },
      { key: 'durability', label: 'Field Durability', weight: 0.19, minimumEvidence: 2, description: 'Shaft, lock, tip, and joint reliability.' },
      { key: 'packability', label: 'Packability', weight: 0.10, minimumEvidence: 1, description: 'Collapsed size and carry integration.' }
    ]
  },
  electrolytes: {
    ...defaults,
    minimumCoverage: 0.8,
    categoryKey: 'electrolytes', version, label: 'Electrolytes',
    useCase: 'Hydration support during fasted, high-output, altitude, and heat-exposed TrailGenic sessions.',
    dimensions: [
      { key: 'sodium-delivery', label: 'Sodium Delivery', weight: 0.25, minimumEvidence: 2, description: 'Transparent, useful sodium dose and serving flexibility.' },
      { key: 'mineral-context', label: 'Mineral Context', weight: 0.12, minimumEvidence: 1, description: 'Potassium, magnesium, and formula balance without unsupported claims.' },
      { key: 'fasted-compatibility', label: 'Fasted Compatibility', weight: 0.20, minimumEvidence: 2, description: 'Carbohydrate, sweetener, calorie, and protocol implications.' },
      { key: 'gi-tolerance', label: 'GI Tolerance Evidence', weight: 0.18, minimumEvidence: 2, description: 'Reported gastrointestinal response at useful dosing.' },
      { key: 'dose-flexibility', label: 'Dose Flexibility', weight: 0.12, minimumEvidence: 1, description: 'Ability to match duration, sweat rate, altitude, and heat.' },
      { key: 'field-usability', label: 'Field Usability', weight: 0.08, minimumEvidence: 1, description: 'Mixing, packaging, and carry practicality.' },
      { key: 'evidence-quality', label: 'Evidence Quality', weight: 0.05, minimumEvidence: 2, description: 'Specificity and independence of formula and tolerance evidence.' }
    ]
  },
  hydration: {
    ...defaults,
    categoryKey: 'hydration', version, label: 'Hydration',
    useCase: 'Reliable fluid access, treatment, and carrying during long fasted mountain sessions.',
    dimensions: [
      { key: 'access-efficiency', label: 'Access Efficiency', weight: 0.22, minimumEvidence: 2, description: 'Ease and speed of drinking, filling, and stowing.' },
      { key: 'mass-volume', label: 'Mass-to-Volume Efficiency', weight: 0.16, minimumEvidence: 1, description: 'Carried weight and collapsed volume for delivered capacity.' },
      { key: 'reliability', label: 'Leak and Failure Reliability', weight: 0.22, minimumEvidence: 2, description: 'Resistance to leaks, clogging, puncture, and connection failure.' },
      { key: 'cold-altitude', label: 'Cold and Altitude Behavior', weight: 0.12, minimumEvidence: 1, description: 'Function in freezing, pressure, and exposure conditions.' },
      { key: 'cleaning', label: 'Cleaning and Recovery', weight: 0.10, minimumEvidence: 1, description: 'Drying, sanitation, and repeat-session readiness.' },
      { key: 'durability', label: 'Field Durability', weight: 0.18, minimumEvidence: 2, description: 'Long-term material and component reliability.' }
    ]
  },
  'shell-rain': {
    ...defaults,
    categoryKey: 'shell-rain', version, label: 'Shells and Rain Protection',
    useCase: 'Protection during exposed alpine movement where precipitation, wind, and exertion must be balanced.',
    dimensions: [
      { key: 'weather-protection', label: 'Weather Protection', weight: 0.24, minimumEvidence: 2, description: 'Rain and wind protection appropriate to the claimed product class.' },
      { key: 'breathability', label: 'Exertion Breathability', weight: 0.22, minimumEvidence: 2, description: 'Moisture and heat release under sustained climbing.' },
      { key: 'weight-packability', label: 'Weight and Packability', weight: 0.14, minimumEvidence: 1, description: 'Carry penalty when protection is not worn.' },
      { key: 'mobility', label: 'Movement and Fit', weight: 0.12, minimumEvidence: 1, description: 'Mobility with packs, poles, and layered systems.' },
      { key: 'durability', label: 'Field Durability', weight: 0.16, minimumEvidence: 2, description: 'Fabric, membrane, zipper, and coating lifespan.' },
      { key: 'thermal-protocol-fit', label: 'Thermal Protocol Fit', weight: 0.12, minimumEvidence: 1, description: 'Compatibility with heat management and safe cold exposure.' }
    ]
  },
  headlamps: {
    ...defaults,
    categoryKey: 'headlamps', version, label: 'Headlamps',
    useCase: 'Reliable predawn, night, and emergency movement during mountain protocols.',
    dimensions: [
      { key: 'usable-output', label: 'Usable Output', weight: 0.18, minimumEvidence: 2, description: 'Practical beam and illumination rather than headline lumens alone.' },
      { key: 'runtime', label: 'Runtime Reliability', weight: 0.22, minimumEvidence: 2, description: 'Sustained useful output and battery behavior.' },
      { key: 'cold-performance', label: 'Cold Performance', weight: 0.14, minimumEvidence: 1, description: 'Battery and control behavior in low temperatures.' },
      { key: 'stability-comfort', label: 'Stability and Comfort', weight: 0.13, minimumEvidence: 1, description: 'Bounce, fit, and pressure during prolonged movement.' },
      { key: 'controls', label: 'Controls and Lockout', weight: 0.10, minimumEvidence: 1, description: 'Gloved use, mode access, and accidental activation prevention.' },
      { key: 'weather-durability', label: 'Weather and Durability', weight: 0.13, minimumEvidence: 2, description: 'Water resistance and repeat-use reliability.' },
      { key: 'mass', label: 'Carried Mass', weight: 0.10, minimumEvidence: 1, description: 'Head and pack weight relative to function.' }
    ]
  }
};

export function getRubric(categoryKey: CategoryKey): RubricDefinition {
  return rubrics[categoryKey];
}

export function validateRubrics(): void {
  for (const rubric of Object.values(rubrics)) {
    const total = rubric.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
    if (Math.abs(total - 1) > 0.0001) throw new Error(`${rubric.categoryKey} rubric weights total ${total}`);
    const keys = new Set(rubric.dimensions.map((dimension) => dimension.key));
    if (keys.size !== rubric.dimensions.length) throw new Error(`${rubric.categoryKey} contains duplicate dimensions`);
  }
}
