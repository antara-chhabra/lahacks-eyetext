# Tile Catalog

All 29 tile IDs by category. These are the canonical identifiers used across all four tasks:
- gaze-engine: `dwellTargetId` in `GazeSequence`
- backend: `tile_id` field in Phrase and MessageHistory documents
- cloudinary-assets: manifest keys and Cloudinary public ID suffix
- agents: `tile_id` in `Intent`

Cloudinary public IDs follow the pattern `catalyst-care/{category}/{tile_id_lowercase}`.

---

## needs (8)

| Tile ID    | Cloudinary Public ID               |
|------------|------------------------------------|
| WATER      | `catalyst-care/needs/water`        |
| FOOD       | `catalyst-care/needs/food`         |
| BATHROOM   | `catalyst-care/needs/bathroom`     |
| PAIN       | `catalyst-care/needs/pain`         |
| MEDICATION | `catalyst-care/needs/medication`   |
| HOT        | `catalyst-care/needs/hot`          |
| COLD       | `catalyst-care/needs/cold`         |
| SLEEP      | `catalyst-care/needs/sleep`        |

## people (6)

| Tile ID   | Cloudinary Public ID               |
|-----------|------------------------------------|
| FAMILY    | `catalyst-care/people/family`      |
| CAREGIVER | `catalyst-care/people/caregiver`   |
| DOCTOR    | `catalyst-care/people/doctor`      |
| NURSE     | `catalyst-care/people/nurse`       |
| DAUGHTER  | `catalyst-care/people/daughter`    |
| SON       | `catalyst-care/people/son`         |

## feelings (5)

| Tile ID    | Cloudinary Public ID                |
|------------|-------------------------------------|
| HAPPY      | `catalyst-care/feelings/happy`      |
| SAD        | `catalyst-care/feelings/sad`        |
| TIRED      | `catalyst-care/feelings/tired`      |
| SCARED     | `catalyst-care/feelings/scared`     |
| FRUSTRATED | `catalyst-care/feelings/frustrated` |

## responses (5)

| Tile ID   | Cloudinary Public ID                 |
|-----------|--------------------------------------|
| YES       | `catalyst-care/responses/yes`        |
| NO        | `catalyst-care/responses/no`         |
| MAYBE     | `catalyst-care/responses/maybe`      |
| THANK_YOU | `catalyst-care/responses/thank_you`  |
| PLEASE    | `catalyst-care/responses/please`     |

## actions (5)

| Tile ID | Cloudinary Public ID               |
|---------|------------------------------------|
| HELLO   | `catalyst-care/actions/hello`      |
| GOODBYE | `catalyst-care/actions/goodbye`    |
| HELP    | `catalyst-care/actions/help`       |
| CALL    | `catalyst-care/actions/call`       |
| STOP    | `catalyst-care/actions/stop`       |
