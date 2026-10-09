/** Controlled, revisioned metadata. Canonicals always use the current route. */
export interface ContentSeo {
  title?: string;
  description?: string;
  socialTitle?: string;
  socialType?: "website"|"article";
  socialDescription?: string;
  /** Managed image identity, never an arbitrary remote URL. */
  image?: string;
  imageAlt?: string;
  /** Restricts an otherwise public page; it cannot make private content public. */
  noindex?: boolean;
  /** Explicit editorial choice to replace, rather than retain, verified original copy. */
  replaceSourceContent?: boolean;
}
