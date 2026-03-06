export interface Token {
  id: string;
  text: string;
  furigana?: string;
  meaning?: string;
}

export interface JapaneseSentence {
  original: string; // Korean
  translated: string; // Japanese
  tokens: Token[];
}

export interface ReviewItem {
  id: number | string;
  korean: string;
  japanese: string;
  tokens: Token[];
  addedAt: string;
}

export enum GameStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
