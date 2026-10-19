/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Web3Forms access key (public by design). Without it the contact form opens the visitor's email app. */
  readonly PUBLIC_WEB3FORMS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
