# Color themes

The Theme button appears in the staff/admin sidebar, the student navigation, and public authentication pages. It offers ParSU Blue (default), Pink, Lime Green, and the previous Purple. Preferences are stored under `parsu-color-theme` in browser local storage and synchronize across tabs. Invalid or unavailable storage falls back to blue. Storage failures do not prevent changing the current page's palette.

The blue is `#06345c`, taken from ParSU's live website stylesheet:
https://parsu.edu.ph/templates/shaper_helixultimate/css/presets/preset1.css

This matches the website's interface blue; the university seal page confirms blue as a dominant official color but does not publish a hex specification:
https://parsu.edu.ph/index.php/about/university-seal

Shared CSS variables recolor navigation, cards, primary actions, links, selected states, and charts. Each color has both a light and a dark palette. Pink and lime use pale accents in light mode and brighter text/action colors on tinted surfaces in dark mode. Status/error meanings retain consistent labels and semantic colors.

`BrandLogo` reuses the original JPG without changing it. An SVG color filter maps its white mark to opacity and removes the baked-in purple backdrop at render time. The resulting white mark sits on `--navigation`, following the chosen theme and mode. All five logo placements use this shared component and retain their previous sizes.

`src/lib/themes.test.ts` verifies normal text/button pairs at a minimum contrast ratio of 4.5:1, input and focus indicators at 3:1, navigation overlays, tinted badges, chart legend colors, and startup fallback behavior across all eight combinations (20 tests). Browser checks cover theme/mode switching, persistence after reload and login, cross-tab changes, keyboard controls, and mobile bounds.

The root layout initializes the saved palette before body rendering to avoid showing the wrong palette on page load. The picker uses native grouped radio controls with visible keyboard focus.

## Light and dark mode

The separate Dark mode switch is available alongside the theme picker. Light remains the default. The `parsu-color-mode` browser preference is independent of the color theme and synchronizes across tabs. Choosing another theme keeps the selected mode. Invalid or inaccessible mode storage falls back to light without resetting the color preference.

Dark palettes use their own background, card, popover, accent, and navigation colors. Brighter primary colors pair with dark button text; navigation keeps white text on a dark surface. Semantic status colors and native form-control color schemes adapt too. Both preferences initialize before the body paints.

During implementation, the local C: drive filled up. The conflicting CommonJS export in `next.config.ts` was merged into the typed default export so the development cache-disable setting is actually applied. Existing allowed development origins and the `pdfkit` external package configuration are preserved.
