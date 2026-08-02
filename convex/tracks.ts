export type Track = {
  id: string;
  name: string;
  sdg: string;
};

export const TRACKS: Track[] = [
  {
    id: "agriculture",
    name: "Agriculture and Food Security",
    sdg: "SDG 2 - Zero Hunger",
  },
  {
    id: "health",
    name: "Health and Well-Being",
    sdg: "SDG 3 - Good Health and Well-Being",
  },
  {
    id: "energy",
    name: "Clean Energy Forecasting",
    sdg: "SDG 7 - Affordable and Clean Energy",
  },
  {
    id: "cities",
    name: "Smart and Sustainable Cities",
    sdg: "SDG 11 - Sustainable Cities and Communities",
  },
  {
    id: "climate",
    name: "Climate and Environment",
    sdg: "SDG 13 - Climate Action",
  },
  {
    id: "wildlife",
    name: "Wildlife and Biodiversity",
    sdg: "SDG 15 - Life on Land",
  },
];

export const TRACK_IDS = TRACKS.map((t) => t.id);

export function trackById(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}
