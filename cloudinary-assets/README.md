# cloudinary-assets

Cloudinary tooling for Catalyst for Care — icon upload, accessibility theme transforms, and the tile manifest consumed by the frontend.

## Setup

```bash
cp .env.example .env
# Fill in your Cloudinary credentials from https://console.cloudinary.com/
npm install
```

## Commands

| Command             | What it does                                                          |
|---------------------|-----------------------------------------------------------------------|
| `npm run upload`    | Upload all icons from `source-icons/` to Cloudinary (idempotent)     |
| `npm run manifest`  | Read Cloudinary tag listing → write `output/tile-manifest.json`       |
| `npm run verify`    | Fetch every URL in the manifest and assert HTTP 200 + image type      |

## Typical workflow

```bash
# 1. Drop icon files into source-icons/{category}/ named {tile_id_lowercase}.png
# 2. Upload them
npm run upload

# 3. Regenerate the manifest with real Cloudinary URLs
npm run manifest

# 4. Confirm all URLs resolve
npm run verify
```

## Day-1 stub

`output/tile-manifest.json` is pre-committed with demo URLs pointing to `res.cloudinary.com/demo`.
This lets all team members code against the manifest format immediately — `npm run verify` passes
on day 1 before any real icons are uploaded.

After uploading real icons, run `npm run manifest` to overwrite it with production URLs.
The stub commit uses `git add -f` because this file is listed in `.gitignore` as a generated artifact.

## Source icon naming

Drop files into `source-icons/{category}/` using the filename `{tile_id_lowercase}.png` (or `.svg`).

Examples:
- `source-icons/needs/water.png` → public ID `catalyst-care/needs/water`
- `source-icons/responses/thank_you.svg` → public ID `catalyst-care/responses/thank_you`

## Theme transformation chains

| Theme         | Cloudinary transform string       | Use case                          |
|---------------|-----------------------------------|-----------------------------------|
| standard      | _(none)_                          | Default                           |
| highContrast  | `e_contrast:50,e_brightness:20`   | Low vision / photosensitivity     |
| largeText     | `c_pad,w_400,h_400`               | Larger visual targets             |

See `docs/theme-presets.md` for full details and example URLs.

## Output

`output/tile-manifest.json` — a `TileManifest` (see `../shared/models.ts`) mapping all 29 tile IDs
to three theme URL variants each.
