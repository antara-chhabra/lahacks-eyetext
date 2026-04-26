# Theme Presets

Three accessibility-focused transformation chains are available for all tile icons.
Implemented in `src/theme-presets.js`.

---

## standard

No transformation. Raw delivery from Cloudinary CDN at the source asset's native dimensions.

**Transformation string:** _(none)_

**URL pattern:**
```
https://res.cloudinary.com/{cloud}/image/upload/{public_id}
```

**Example:**
```
https://res.cloudinary.com/mycloud/image/upload/catalyst-care/needs/water
```

---

## highContrast

Increases contrast by 50 units and brightness by 20 units. Intended for users with low vision,
colour-perception differences, or photosensitivity. Improves icon legibility under variable
lighting conditions without altering the icon's shape or meaning.

**Transformation string:** `e_contrast:50,e_brightness:20`

**URL pattern:**
```
https://res.cloudinary.com/{cloud}/image/upload/e_contrast:50,e_brightness:20/{public_id}
```

**Example:**
```
https://res.cloudinary.com/mycloud/image/upload/e_contrast:50,e_brightness:20/catalyst-care/needs/water
```

---

## largeText

Pads and scales the icon to 400×400 px, preserving the original aspect ratio with neutral padding.
`c_pad` is used instead of `c_scale` to avoid distorting SVG/PNG icons that have non-square
natural dimensions.

**Transformation string:** `c_pad,w_400,h_400`

**URL pattern:**
```
https://res.cloudinary.com/{cloud}/image/upload/c_pad,w_400,h_400/{public_id}
```

**Example:**
```
https://res.cloudinary.com/mycloud/image/upload/c_pad,w_400,h_400/catalyst-care/needs/water
```

---

## Avatar transform (not a tile theme)

Face-crops a caregiver or patient photo to a 200×200 circular avatar. Uses Cloudinary's
automatic face-detection gravity. Implemented in `src/avatar-transform.js`.

**Transformation string:** `g_face,c_thumb,w_200,h_200,r_max`

**Example:**
```
https://res.cloudinary.com/mycloud/image/upload/g_face,c_thumb,w_200,h_200,r_max/caregivers/mary-davis
```
