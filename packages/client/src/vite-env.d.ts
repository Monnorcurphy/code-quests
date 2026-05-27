/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PHASER_TOWN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
