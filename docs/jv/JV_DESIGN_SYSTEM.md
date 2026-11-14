# Precision Workspace design system — PR_15C

## Tokens

`src/index.css` defines light defaults and `.dark` semantic tokens: background, foreground, card/surface, primary, secondary, muted, accent, destructive, border/input and focus ring, plus success/warning. Primary uses muted teal. Components should use Tailwind semantic classes (`bg-background`, `bg-card`, `text-foreground`, `border-border`) instead of fixed theme colors. Focus-visible has a high contrast outline; disabled buttons communicate state.

## Theme behavior

Preference `bms-theme` is local to this browser: `light`, `dark` or `system`. Missing/invalid means system. A small inline bootstrap in index.html applies dark class before React mounts; initializeTheme subscribes to system media changes only while system mode is selected. Settings exposes the selector. Theme is global, so it also applies on login. No server settings or DB migration.

## Current audit findings and limits

Layout sidebar and mobile navigation now use semantic surfaces instead of their unconditional dark gradients/blur. Many existing pages still contain fixed color utility classes, translucent status badges and gradients; theme coverage is therefore partial and needs page-by-page visual review. This PR does not claim complete visual normalization.
