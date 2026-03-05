import type { PlatformType } from "./common.js";

export interface GameInfoImages {
  baseURL: string;
  square: string;
  horizontal: string;
  widescreen: string;
  vertical: string;
}

export interface BetLineValue {
  maxBet: string;
  maxCoeff: string;
}

export interface BetLineInfo {
  currency: string;
  values: BetLineValue[];
}

export interface GameInfo {
  id: string;
  title: string;
  locales: string[];
  currencies: string[];
  platforms: PlatformType[];
  images: GameInfoImages;
  hasFreeSpins: boolean;
  rtp: number;
  betLines?: BetLineInfo[];
}
