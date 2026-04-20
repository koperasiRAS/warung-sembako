# Design System: Editorial Efficiency

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Efficient Atelier."** 

We are transforming the humble 'Warung Sembako' into a high-end, high-velocity retail environment. This system rejects the cluttered, "spreadsheet-style" density typical of grocery POS systems. Instead, it adopts a sophisticated, editorial layout—utilizing intentional asymmetry, generous white space, and a hyper-clear hierarchy. By blending the warmth of a modern restaurant aesthetic with the rigorous utility of a grocery inventory, we create a tool that feels premium yet remains invisible during high-speed transactions.

We break the "template" look by treating the interface as a physical workspace: layers are stacked, primary actions are elevated through tonal depth, and data is presented with the clarity of a boutique menu.

---

## 2. Colors & Surface Philosophy
This system relies on a "tonal-first" approach. We move away from the harshness of high-contrast grids and toward a fluid, organic environment.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts. To separate a sidebar from a main feed, place a `surface-container-low` (#f3f3f4) section against the main `background` (#f9f9fa). 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface-container tiers to define importance:
- **Base Layer:** `background` (#f9f9fa) – The canvas.
- **Section Layer:** `surface-container-low` (#f3f3f4) – Large layout blocks (e.g., the product grid area).
- **Interactive Layer:** `surface-container-lowest` (#ffffff) – Individual cards and action items. This creates a "soft lift" that guides the eye naturally.

### The "Glass & Gradient" Rule
To elevate the POS from "software" to "experience":
- **Floating Elements:** Use `surface-container-lowest` at 80% opacity with a `24px` backdrop blur for modals or floating cart summaries.
- **Signature Textures:** Main CTAs should not be flat. Apply a subtle linear gradient from `primary` (#1c4ed8) to `primary_container` (#4069f2) to provide a tactile, "clickable" soul.

---

## 3. Typography: The Editorial Voice
We use a dual-font strategy to balance character with readability.

- **Display & Headlines (Plus Jakarta Sans):** These are your "Brand Anchors." Use `display-lg` and `headline-md` for large price displays and category titles. The wide aperture of Jakarta Sans conveys modernity and authority.
- **Interface & Body (Inter):** For everything functional—product names, SKU numbers, and quantities—use Inter. It is engineered for legibility at small sizes (`label-sm`) and high-density lists.

**Hierarchy Note:** Use `tertiary` (#9d3e00) sparingly for "Sale" or "Low Stock" alerts. This provides a high-contrast editorial "ping" against the cool blue and gray palette.

---

## 4. Elevation & Depth
Depth is a functional tool, not a stylistic flourish.

- **The Layering Principle:** Avoid shadows for static elements. A `surface-container-lowest` card sitting on a `surface-container-low` background provides enough contrast for the user to understand the object's boundaries.
- **Ambient Shadows:** For active "Floating" states (like a dragged item), use a custom shadow: `0px 20px 40px rgba(13, 12, 34, 0.06)`. The tint is derived from our `on-surface` color, creating a natural, ambient lift.
- **The Ghost Border:** If accessibility requires a border (e.g., in high-glare environments), use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
- **Primary:** Gradient from `primary` to `primary_container`, `xl` (3rem) corner radius. Use `title-md` for the label.
- **Secondary:** `surface-container-highest` background with `on-surface` text. No border.
- **Tertiary/Ghost:** No background. Use `primary` text and a `0.5rem` (sm) corner radius for the hover state.

### Input Fields
- **Search & Entry:** Use `surface-container-lowest` (#ffffff) with an `xl` corner radius. The focus state should never be a thick border; instead, transition the background to `surface-bright` and apply the Ambient Shadow.

### Cards & Lists
- **The Grocery Item Card:** A `surface-container-lowest` container with `lg` (2rem) corners. 
- **The Forfeit of Dividers:** Prohibit the use of divider lines in lists. Use `1.5rem` (md) vertical white space to separate line items in the cart. Let the typography do the work.

### Chips
- **Category Filters:** Use `secondary_container` with `on_secondary_container` text. When active, transition to `primary` with `on_primary` text. Use `full` (9999px) roundedness.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use `xl` (3rem) rounded corners for main structural elements to maintain the "soft" restaurant vibe.
- **Do** leverage `primary_fixed` (#dce1ff) for "Selected" states in the product grid; it provides a sophisticated, low-contrast highlight.
- **Do** prioritize "Breathing Room." A POS for a grocery store is stressful; the UI should be the antidote.

### Don’t:
- **Don’t** use pure black (#000000) for text. Use `on_surface` (#1a1c1d) to maintain the premium, soft-gray aesthetic.
- **Don’t** use standard Material Design "elevated" buttons with heavy shadows. Stick to tonal layering.
- **Don’t** use 1px dividers between items in the checkout list. If the items feel "bleeded" together, increase the `spacing` scale between them.