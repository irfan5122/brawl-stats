export interface OwnedCount {
  owned: number | null;
  available: number | null;
  label: string;
}

export interface Brawler {
  id: number | string | null;
  name: string;
  className: string;
  trophies: number;
  highestTrophies: number | null;
  power: number | null;
  rank: number | null;
  imageUrl: string | null;
  starPowers: OwnedCount;
  gadgets: OwnedCount;
  gears: string[] | null;
}

export interface Player {
  name: string;
  tag: string;
  trophies: number | null;
  highestTrophies: number | null;
  expLevel: number | null;
  iconUrl: string | null;
}

export interface Summary {
  totalBrawlers: number;
  qualifiedCount: number;
  belowCount: number;
  power11Count: number;
  highestBrawlerTrophies: number;
}

export interface PlayerResponse {
  player: Player;
  summary: Summary;
  brawlers: Brawler[];
}
