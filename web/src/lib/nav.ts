/** The four Primary nav sections, in header order. Shared by the header nav and the menu. */
export const NAV = [
  { label: "Upload", href: "/upload" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "My Datasets", href: "/my-datasets" },
  { label: "My Account", href: "/account" },
] as const;

export type NavItem = (typeof NAV)[number];

/**
 * Index of the NAV item that owns `path`: an exact match or a prefix followed by "/"
 * (so /marketplace/listing-x is Marketplace). -1 on "/", "/dev/fhe" and unknown paths.
 */
export function activeIndex(path: string): number {
  return NAV.findIndex((item) => path === item.href || path.startsWith(item.href + "/"));
}

/** The header menu panel: Home, the four sections, and the transactions list on My Account. */
export const MENU_ITEMS = [
  { label: "Home", href: "/" },
  ...NAV,
  { label: "Transactions", href: "/account#transactions" },
] as const;

export const SOCIAL_ITEMS = [{ label: "GitHub", href: "https://github.com/mohit230723/Opaquely" }] as const;
