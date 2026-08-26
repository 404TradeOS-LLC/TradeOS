import { Trade } from "./types";

export interface ClassificationResult {
  trade: Trade | null;
  projectType: string;
  category: string;
}

// Ordered by trade name only for readability — matching itself is score-based, not order-based,
// so overlapping vocabulary (e.g. "replace" appearing under multiple trades) can't cause an
// earlier rule to shadow a better-fitting later one.
const TRADE_RULES: Array<{ trade: Trade; keywords: string[] }> = [
  {
    trade: "Deck",
    keywords: [
      "deck", "decking", "ledger", "joist", "guard rail", "deck stairs",
      "pt deck", "treated deck", "composite deck", "cedar deck",
    ],
  },
  {
    trade: "Roofing",
    keywords: [
      "roof", "roofing", "shingle", "reroof", "re-roof", "tear off", "tear-off",
      "resheet", "re-sheet", "standing seam", "flashing", "ridge vent",
      "square of shingles", "architectural shingle",
    ],
  },
  {
    trade: "Bathroom Remodel",
    keywords: ["bathroom", "bath remodel", "shower", "bathtub", "vanity", "toilet", "master bath"],
  },
  {
    trade: "Kitchen Remodel",
    keywords: ["kitchen", "custom cabinet", "cabinet", "countertop", "backsplash", "kitchen remodel"],
  },
  {
    trade: "Whole Home Remodel",
    keywords: [
      "whole home remodel", "whole house remodel", "full home renovation",
      "entire home", "gut the house", "whole house reno",
    ],
  },
  {
    trade: "Fence",
    keywords: ["fence", "fencing", "privacy fence", "chain link", "picket fence", "fence gate"],
  },
  {
    trade: "Concrete",
    keywords: [
      "concrete", "slab", "patio pour", "driveway", "footing", "sidewalk",
      "pour a", "pour concrete", "flatwork", "stamped concrete",
    ],
  },
  {
    trade: "Tree Service",
    keywords: [
      "tree", "stump", "stump grind", "arborist", "maple", "oak tree", "pine tree",
      "remove tree", "trim tree", "brush hog",
    ],
  },
  {
    trade: "Excavation",
    keywords: ["excavate", "excavation", "grade the lot", "grading", "dig out", "brush hog", "clear the lot", "site grading"],
  },
  {
    trade: "Landscaping",
    keywords: [
      "landscap", "sod", "mulch", "retaining wall", "irrigation", "planting bed",
      "hardscape", "paver patio",
    ],
  },
  {
    trade: "Flooring",
    keywords: ["floor", "flooring", "hardwood floor", "lvp", "laminate floor", "carpet", "vinyl plank"],
  },
  {
    trade: "Painting",
    keywords: ["paint", "painting", "repaint", "interior paint", "exterior paint", "primer coat"],
  },
  {
    trade: "Drywall",
    keywords: ["drywall", "sheetrock", "gypsum board", "tape and mud", "drywall texture"],
  },
  {
    trade: "Electrical",
    keywords: ["electrical", "rewire", "circuit breaker", "panel upgrade", "outlet", "wiring", "electrician"],
  },
  {
    trade: "HVAC",
    keywords: ["hvac", "furnace", "heat pump", "mini split", "ductwork", "air conditioner", "ac unit", "boiler"],
  },
  {
    trade: "Plumbing",
    keywords: ["plumbing", "repipe", "water heater", "sewer line", "drain line", "supply line", "plumber"],
  },
  {
    trade: "Siding",
    keywords: [
      "siding", "hardie", "lp smartside", "vinyl siding", "fiber cement siding",
      "soffit", "fascia", "residing",
    ],
  },
  {
    trade: "Windows",
    keywords: ["window", "vinyl window", "replacement window", "window install"],
  },
  {
    trade: "Doors",
    keywords: ["entry door", "sliding door", "french door", "interior door", "exterior door", "door install"],
  },
  {
    trade: "Garage",
    keywords: ["garage", "attached garage", "detached garage", "garage bay", "car garage"],
  },
  {
    trade: "Pole Barn",
    keywords: ["pole barn", "metal barn", "pole building", "post frame building"],
  },
  {
    trade: "Addition",
    keywords: ["home addition", "room addition", "bump out", "add a room", "second story addition"],
  },
  {
    trade: "Demolition",
    keywords: ["demo", "demolition", "tear down", "haul away", "gut demo", "selective demo"],
  },
];

const TRADE_METADATA: Record<Trade, { projectType: string; category: string }> = {
  "Deck":               { projectType: "Outdoor Structure",             category: "Exterior Improvements" },
  "Roofing":            { projectType: "Roof Replacement / Repair",     category: "Exterior Improvements" },
  "Bathroom Remodel":   { projectType: "Interior Renovation",           category: "Interior Improvements" },
  "Kitchen Remodel":    { projectType: "Interior Renovation",           category: "Interior Improvements" },
  "Whole Home Remodel": { projectType: "Full-Property Renovation",      category: "Interior Improvements" },
  "Fence":              { projectType: "Site Enclosure",                category: "Site Work" },
  "Concrete":           { projectType: "Flatwork / Foundation",         category: "Site Work" },
  "Tree Service":       { projectType: "Tree Removal / Trimming",       category: "Site Work" },
  "Excavation":         { projectType: "Earthwork / Site Prep",         category: "Site Work" },
  "Landscaping":        { projectType: "Landscape Installation",        category: "Site Work" },
  "Flooring":           { projectType: "Flooring Installation",         category: "Interior Improvements" },
  "Painting":           { projectType: "Interior / Exterior Painting",  category: "Finish Work" },
  "Drywall":            { projectType: "Drywall Installation / Repair", category: "Interior Improvements" },
  "Electrical":         { projectType: "Electrical Installation / Repair", category: "Mechanical Systems" },
  "HVAC":               { projectType: "HVAC Installation / Repair",    category: "Mechanical Systems" },
  "Plumbing":           { projectType: "Plumbing Installation / Repair", category: "Mechanical Systems" },
  "Siding":             { projectType: "Siding Installation",           category: "Exterior Improvements" },
  "Windows":            { projectType: "Window Replacement",            category: "Exterior Improvements" },
  "Doors":              { projectType: "Door Replacement",              category: "Exterior Improvements" },
  "Garage":             { projectType: "Garage Construction",           category: "Outdoor Structure" },
  "Pole Barn":          { projectType: "Pole Barn Construction",        category: "Outdoor Structure" },
  "Addition":           { projectType: "Home Addition",                 category: "Structural Expansion" },
  "Demolition":         { projectType: "Selective Demo / Removal",      category: "Site Work" },
};

export function classifyScope(scope: string): ClassificationResult {
  const normalized = scope.toLowerCase();

  let bestTrade: Trade | null = null;
  let bestScore = 0;

  for (const rule of TRADE_RULES) {
    const score = rule.keywords.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);
    if (score > bestScore) {
      bestScore = score;
      bestTrade = rule.trade;
    }
  }

  if (!bestTrade) {
    return { trade: null, projectType: "General Contracting", category: "Uncategorized" };
  }

  return { trade: bestTrade, ...TRADE_METADATA[bestTrade] };
}
