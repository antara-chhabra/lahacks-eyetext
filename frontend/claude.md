# Catalyst for Care — Frontend AI Context

This is the React frontend for Catalyst for Care, an AI-powered AAC (Augmentative and Alternative Communication) system for non-verbal patients. Built with React 19 + Vite 6 + TypeScript 5 using the Cloudinary React AI Starter Kit pattern.

## Cloudinary integration

**SDK:** `@cloudinary/react` + `@cloudinary/url-gen`

**Cloud instance:** `src/cloudinary.ts` exports `cld` (Cloudinary instance) and two helpers:
- `buildTileImage(publicId, theme)` — returns `CloudinaryImage` with accessibility transforms
- `buildAvatarImage(publicId)` — returns face-cropped circular avatar

**Theme transforms applied via `@cloudinary/url-gen`:**
```
standard:     f_auto, q_auto (no resize)
highContrast: adjust(contrast(50)), adjust(brightness(20)), f_auto, q_auto
largeText:    resize(pad().width(400).height(400)), f_auto, q_auto
```

**Key insight:** One uploaded icon serves all accessibility variants through URL transforms — no extra storage, no extra uploads.

## Cloudinary URL patterns

Tile icons: `catalyst-care/{category}/{tile_id_lowercase}`
e.g. `catalyst-care/needs/water`, `catalyst-care/responses/thank_you`

Avatar: any public ID with `g_face,c_thumb,w_200,h_200,r_max`

## Component structure

| Component | Purpose |
|-----------|---------|
| `TileCard` | Single AAC tile — uses `AdvancedImage` with `lazyload` + `placeholder` plugins |
| `TileBoard` | Full 29-tile AAC board grouped by category |
| `ThemeSelector` | Switches between standard/highContrast/largeText — all images update via URL transforms |
| `UploadSection` | Cloudinary Upload Widget — uploads new icons to `catalyst-care/` folder |
| `CaregiverDashboard` | Message history from backend REST API |
| `MessageBanner` | Shows the AI-generated message after tile selection |

## Services

- Agent gateway: `http://localhost:8000` — `POST /intent` with `GazeSequence`, returns `RouteDecision`
- Backend REST: `http://localhost:3001` — `GET /history/:userId`, etc.
- Both configured via `.env` vars: `VITE_AGENT_URL`, `VITE_BACKEND_URL`

## Tile IDs

All 29 canonical IDs are in `src/tileData.ts` under `TILE_CATEGORIES`. Never invent new tile IDs — they must match `../shared/api-contract.md`.

## Adding a new tile

1. Add entry to the correct category in `src/tileData.ts`
2. Drop the icon file into `../cloudinary-assets/source-icons/{category}/{tile_id_lowercase}.png`
3. Run `npm run upload` then `npm run manifest` in `cloudinary-assets/`

## Using AdvancedImage correctly

```tsx
import { AdvancedImage, lazyload, placeholder } from '@cloudinary/react';
import { buildTileImage } from '../cloudinary';

const img = buildTileImage(tile.publicId, theme);
<AdvancedImage cldImg={img} plugins={[lazyload(), placeholder({ mode: 'blur' })]} alt={tile.label} />
```

## Common mistakes to avoid

- Never import from `@cloudinary/url-gen` top-level for actions/qualifiers — always use sub-paths: `@cloudinary/url-gen/actions/adjust`, `@cloudinary/url-gen/qualifiers/format`, etc.
- Never build Cloudinary URLs manually with string concatenation — always use `cld.image(publicId)` and chain transforms
- The Upload Widget requires `VITE_CLOUDINARY_UPLOAD_PRESET` to be an **unsigned** preset; do not use the API secret in frontend code
- `node-fetch` is used in `cloudinary-assets/` (Node.js scripts), NOT in this React frontend — use native `fetch` here
