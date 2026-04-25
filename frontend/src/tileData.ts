import type { TileMeta } from './types';

// Canonical tile definitions — IDs match shared/api-contract.md exactly.
// publicId follows the convention: catalyst-care/{category}/{tile_id_lowercase}

export const TILE_CATEGORIES: Record<string, TileMeta[]> = {
  needs: [
    { id: 'WATER',      label: 'Water',      category: 'needs', publicId: 'catalyst-care/needs/water',      emoji: '💧' },
    { id: 'FOOD',       label: 'Food',        category: 'needs', publicId: 'catalyst-care/needs/food',       emoji: '🍽️' },
    { id: 'BATHROOM',   label: 'Bathroom',    category: 'needs', publicId: 'catalyst-care/needs/bathroom',   emoji: '🚽' },
    { id: 'PAIN',       label: 'Pain',        category: 'needs', publicId: 'catalyst-care/needs/pain',       emoji: '😣' },
    { id: 'MEDICATION', label: 'Medication',  category: 'needs', publicId: 'catalyst-care/needs/medication', emoji: '💊' },
    { id: 'HOT',        label: 'Too Hot',     category: 'needs', publicId: 'catalyst-care/needs/hot',        emoji: '🔥' },
    { id: 'COLD',       label: 'Too Cold',    category: 'needs', publicId: 'catalyst-care/needs/cold',       emoji: '🥶' },
    { id: 'SLEEP',      label: 'Sleep',       category: 'needs', publicId: 'catalyst-care/needs/sleep',      emoji: '😴' },
  ],
  people: [
    { id: 'FAMILY',    label: 'Family',    category: 'people', publicId: 'catalyst-care/people/family',    emoji: '👨‍👩‍👧' },
    { id: 'CAREGIVER', label: 'Caregiver', category: 'people', publicId: 'catalyst-care/people/caregiver', emoji: '🧑‍⚕️' },
    { id: 'DOCTOR',    label: 'Doctor',    category: 'people', publicId: 'catalyst-care/people/doctor',    emoji: '👨‍⚕️' },
    { id: 'NURSE',     label: 'Nurse',     category: 'people', publicId: 'catalyst-care/people/nurse',     emoji: '👩‍⚕️' },
    { id: 'DAUGHTER',  label: 'Daughter',  category: 'people', publicId: 'catalyst-care/people/daughter',  emoji: '👧' },
    { id: 'SON',       label: 'Son',       category: 'people', publicId: 'catalyst-care/people/son',       emoji: '👦' },
  ],
  feelings: [
    { id: 'HAPPY',      label: 'Happy',      category: 'feelings', publicId: 'catalyst-care/feelings/happy',      emoji: '😊' },
    { id: 'SAD',        label: 'Sad',        category: 'feelings', publicId: 'catalyst-care/feelings/sad',        emoji: '😢' },
    { id: 'TIRED',      label: 'Tired',      category: 'feelings', publicId: 'catalyst-care/feelings/tired',      emoji: '😩' },
    { id: 'SCARED',     label: 'Scared',     category: 'feelings', publicId: 'catalyst-care/feelings/scared',     emoji: '😨' },
    { id: 'FRUSTRATED', label: 'Frustrated', category: 'feelings', publicId: 'catalyst-care/feelings/frustrated', emoji: '😤' },
  ],
  responses: [
    { id: 'YES',      label: 'Yes',      category: 'responses', publicId: 'catalyst-care/responses/yes',       emoji: '✅' },
    { id: 'NO',       label: 'No',       category: 'responses', publicId: 'catalyst-care/responses/no',        emoji: '❌' },
    { id: 'MAYBE',    label: 'Maybe',    category: 'responses', publicId: 'catalyst-care/responses/maybe',     emoji: '🤔' },
    { id: 'THANK_YOU',label: 'Thank You',category: 'responses', publicId: 'catalyst-care/responses/thank_you', emoji: '🙏' },
    { id: 'PLEASE',   label: 'Please',   category: 'responses', publicId: 'catalyst-care/responses/please',    emoji: '🫶' },
  ],
  actions: [
    { id: 'HELLO',   label: 'Hello',    category: 'actions', publicId: 'catalyst-care/actions/hello',   emoji: '👋' },
    { id: 'GOODBYE', label: 'Goodbye',  category: 'actions', publicId: 'catalyst-care/actions/goodbye', emoji: '👋' },
    { id: 'HELP',    label: 'Help',     category: 'actions', publicId: 'catalyst-care/actions/help',    emoji: '🆘' },
    { id: 'CALL',    label: 'Call',     category: 'actions', publicId: 'catalyst-care/actions/call',    emoji: '📞' },
    { id: 'STOP',    label: 'Stop',     category: 'actions', publicId: 'catalyst-care/actions/stop',    emoji: '🛑' },
  ],
};

export const ALL_TILES: TileMeta[] = Object.values(TILE_CATEGORIES).flat();

export const TILE_BY_ID = Object.fromEntries(ALL_TILES.map(t => [t.id, t]));

export const CATEGORY_LABELS: Record<string, string> = {
  needs:     'Needs',
  people:    'People',
  feelings:  'Feelings',
  responses: 'Responses',
  actions:   'Actions',
};
