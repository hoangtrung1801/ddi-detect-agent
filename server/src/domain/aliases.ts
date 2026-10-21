// Seed alias table: brand names / synonyms / Vietnamese terms -> drug name as spelled in the interaction DB.
// Keys are matched after normName(). Targets are verified against the real DB by test/unit/aliases.test.ts
// when data/ddi.sqlite exists.
const RAW: Record<string, string[]> = {
  Acetaminophen: ['paracetamol', 'tylenol', 'panadol', 'efferalgan', 'hapacol', 'acetaminofen', 'apap', 'dolipran', 'tatanol', 'paracetamol (acetaminophen)'],
  Ibuprofen: ['advil', 'motrin', 'nurofen', 'brufen', 'ibuprofene'],
  'Acetylsalicylic acid': ['aspirin', 'asa', 'aspegic', 'bayer aspirin', 'acid acetylsalicylic', 'acetylsalicylic', 'aspirin 81', 'aspirin cardio'],
  Warfarin: ['coumadin', 'jantoven', 'warfarine'],
  Atorvastatin: ['lipitor'],
  Simvastatin: ['zocor'],
  Rosuvastatin: ['crestor'],
  Clopidogrel: ['plavix'],
  Metformin: ['glucophage', 'metformine'],
  Omeprazole: ['prilosec', 'losec'],
  Esomeprazole: ['nexium'],
  Pantoprazole: ['protonix', 'pantoloc'],
  Cetirizine: ['zyrtec'],
  Loratadine: ['claritin', 'clarityne'],
  Fexofenadine: ['allegra', 'telfast'],
  Sildenafil: ['viagra'],
  Fluoxetine: ['prozac'],
  Sertraline: ['zoloft'],
  Tramadol: ['ultram', 'tramal'],
  Diazepam: ['valium', 'seduxen'],
  Levothyroxine: ['synthroid', 'euthyrox', 'levoxyl'],
  Salbutamol: ['albuterol', 'ventolin'],
  Pseudoephedrine: ['sudafed'],
  Furosemide: ['lasix'],
  Amlodipine: ['norvasc'],
  Lisinopril: ['zestril', 'prinivil'],
  Digoxin: ['lanoxin'],
  Diclofenac: ['voltaren'],
  Naproxen: ['aleve', 'naprosyn'],
  Amoxicillin: ['amoxil', 'moxatag'],
  Azithromycin: ['zithromax', 'zmax'],
  Ciprofloxacin: ['cipro', 'ciprobay'],
  Celecoxib: ['celebrex'],
  Meloxicam: ['mobic'],
  Loperamide: ['imodium'],
  Famotidine: ['pepcid'],
  Ranitidine: ['zantac'],
  Epinephrine: ['adrenaline'],
  'Ascorbic acid': ['vitamin c', 'vit c', 'vitamin c (ascorbic acid)'],
  Cyanocobalamin: ['vitamin b12', 'vit b12', 'b12', 'cobalamin'],
  Pyridoxine: ['vitamin b6', 'vit b6', 'b6'],
  Thiamine: ['vitamin b1', 'vit b1', 'b1'],
  Riboflavin: ['vitamin b2', 'vit b2'],
  Niacin: ['vitamin b3', 'vit b3'],
  'Folic acid': ['vitamin b9', 'folate', 'axit folic'],
  Cholecalciferol: ['vitamin d3', 'vitamin d', 'vit d3', 'vit d'],
  Ergocalciferol: ['vitamin d2'],
  Ethanol: ['alcohol', 'rượu', 'bia', 'beer', 'wine', 'rượu bia', 'ethyl alcohol'],
  Ubidecarenone: ['coenzyme q10', 'coq10', 'co q10'],
  Prednisolone: ['deltasone'],
  Dexamethasone: ['decadron'],
  Sulfamethoxazole: ['bactrim', 'septrin', 'co-trimoxazole', 'cotrimoxazole'],
  Nicotine: ['nicotin', 'thuốc lá'],
};

export function buildAliasMap(raw: Record<string, string[]> = RAW): Map<string, string> {
  const m = new Map<string, string>();
  for (const [target, aliases] of Object.entries(raw)) {
    for (const a of aliases) m.set(a.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '), target);
  }
  return m;
}

export const SEED_ALIASES = RAW;
