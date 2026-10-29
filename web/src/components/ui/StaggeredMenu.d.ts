import type { ComponentType, ReactNode } from "react";

// Types for the vendored React Bits StaggeredMenu.jsx (plan 07-02). Every prop is optional because the
// component supplies defaults in its JS destructuring.
export type StaggeredMenuItem = { label: string; ariaLabel?: string; link: string; current?: boolean };
export type StaggeredMenuSocialItem = { label: string; link: string };

export type StaggeredMenuProps = {
  position?: "left" | "right";
  colors?: string[];
  items?: StaggeredMenuItem[];
  socialItems?: StaggeredMenuSocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  className?: string;
  logoUrl?: string;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  accentColor?: string;
  changeMenuColorOnOpen?: boolean;
  isFixed?: boolean;
  closeOnClickAway?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  showLogo?: boolean;
  footerNote?: ReactNode;
};

export declare const StaggeredMenu: ComponentType<StaggeredMenuProps>;
declare const StaggeredMenuDefault: ComponentType<StaggeredMenuProps>;
export default StaggeredMenuDefault;
