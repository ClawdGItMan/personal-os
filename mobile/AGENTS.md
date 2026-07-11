# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Design system (2026-07-08 →)
Locked "ivy/porcelain" spec-sheet design: see `design_handoff_personal_os/README.md` (+ system-tokens.md) at repo root — README governs on conflicts. All colors/typography flow from `src/theme/` via `useTheme()` (light Porcelain / dark Ivy, system-scheme driven); motion from `src/motion/`; shared primitives in `src/components/spec/`. Fonts: Manrope + Geist Mono only. Zero hardcoded colors in screens. Times are 12-hour, ink-colored (exceptions: dark-mode live/focus-band and training-band times are accent, per README §Home/§Body).
