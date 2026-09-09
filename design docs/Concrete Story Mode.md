# Magic Finger Algebra: Concrete Story Presentation

## Goal

Make every algebra puzzle begin with a simple situation that gives the unknown and every number a concrete meaning.

Instead of showing `3 × Y − 1 = 11`, first show a story about buying three identical magical objects with a one-gold discount. The object icon then remains in the equation as the unknown:

```text
3 × [wand icon] − 1 gold = 11 gold
```

The learner is answering a meaningful question: **How much did one wand cost?**

This is a presentation layer over the existing equation generator and solving logic. It must work with both Move Across and Balance Both Sides modes without changing their underlying mathematics.

## Core principles

1. Every puzzle starts with a concrete story before the interactive equation appears.
2. The story is no longer than four short sentences.
3. Every number in the equation has an obvious meaning in the story.
4. The unknown is always the gold price of one magical object.
5. The object icon is the variable. Never replace it with `Y`, `W`, or another letter.
6. Identical objects always have the same unknown price.
7. The story, concrete objects, and equation should feel like one continuous representation, not three separate exercises.
8. All content is generated locally from fixed templates. No backend or generative API is required.

## Initial Magic Shop objects

```ts
interface MagicItem {
  id: 'wand' | 'broomstick' | 'cauldron' | 'spell';
  singular: string;
  plural: string;
  iconAsset: string;
}

const MAGIC_ITEMS: MagicItem[] = [
  { id: 'wand', singular: 'wand', plural: 'wands', iconAsset: 'wand' },
  { id: 'broomstick', singular: 'broomstick', plural: 'broomsticks', iconAsset: 'broomstick' },
  { id: 'cauldron', singular: 'cauldron', plural: 'cauldrons', iconAsset: 'cauldron' },
  { id: 'spell', singular: 'spell', plural: 'spells', iconAsset: 'spell' }
];
```

Use a clear, readable icon for each object. Emoji are acceptable as temporary placeholders, but the icon must be treated as part of the equation rather than as decoration.

Choose the item deterministically from the puzzle ID or from a separate story seed. Do not consume the existing puzzle-generation RNG, since doing so could change the equation values.

## Player flow

### 1. Introduce the story

Show a small Magic Shop story card above the camera. Reveal the sentences one at a time, adding the corresponding visual elements as they appear.

Example for `3Y − 1 = 11`:

> I bought 3 identical wands. They all cost the same. I got a discount of 1 gold and paid 11 gold altogether. How much did each wand cost before the discount?

Build the concrete scene:

```text
[wand]  [wand]  [wand]     − 1 gold discount     =     11 gold paid
```

The story should be visible text. Do not implement speech synthesis in this version.

### 2. Condense the story into an equation

After the story is revealed, animate the repeated objects into a coefficient and one persistent object icon:

```text
[wand] [wand] [wand] − 1 gold = 11 gold
                 ↓
       3 × [wand] − 1 gold = 11 gold
```

Use a short transition of roughly 500 to 800 ms. The learner should be able to see that `3 × [wand]` represents the combined price of three identical wands.

The question remains visible in compact form:

**How much did each wand cost?**

### 3. Solve normally

The existing Move Across or Balance Both Sides interaction begins. Do not repeat those interaction instructions in this feature.

The object icon remains wherever the variable would normally appear:

```text
3 × [wand] − 1 = 11
3 × [wand]     = 12
    [wand]     = 4 gold
```

### 4. Complete the story

When solved, reveal the price on the object and verify it against the original situation:

```text
Each wand costs 4 gold.

3 wands at 4 gold each = 12 gold
12 gold − 1 gold discount = 11 gold paid
```

Also show the numeric check:

```text
3 × 4 − 1 = 11
```

Pulse both sides together when they match.

## Screen layout

During the story introduction:

```text
                 ┌─────────────────────────────────────┐
                 │ MAGIC SHOP STORY                    │
                 │ I bought 3 identical wands...       │
                 │                                     │
                 │ 🪄  🪄  🪄   − 1 gold   = 11 gold   │
                 │ How much did each wand cost?        │
                 └─────────────────────────────────────┘

                 ┌─────────────────────────────────────┐
                 │                CAMERA               │
                 └─────────────────────────────────────┘
```

During solving, use the existing three-zone layout:

```text
                 ┌─────────────────────────────────────┐
                 │       3 × 🪄 − 1 = 11              │
                 └─────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐
│ Forge controls   │  │                          │  │ Arithmetic       │
│ when required    │  │          CAMERA          │  │ choices when     │
│                  │  │                          │  │ required         │
└──────────────────┘  └──────────────────────────┘  └──────────────────┘
```

## Authored story templates

Generate story content from `LinearEquationDef`. These templates exactly cover the five current equation families.

```ts
interface StoryBeat {
  type: 'objects' | 'same_price' | 'modifier' | 'total' | 'question';
  text: string;
}

interface ConcreteStory {
  item: MagicItem;
  beats: StoryBeat[];
  shortQuestion: string;
  modifierType: 'extra_charge' | 'discount' | 'none';
  modifierAmount: number;
}

function buildConcreteStory(
  equation: LinearEquationDef,
  item: MagicItem
): ConcreteStory {
  const { family, a, b, c } = equation;
  const itemName = a === 1 ? item.singular : item.plural;
  const shortQuestion = `How much did each ${item.singular} cost?`;

  switch (family) {
    case 'x_plus_b':
      return {
        item,
        modifierType: 'extra_charge',
        modifierAmount: b,
        shortQuestion: `How much did the ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought a ${item.singular}.` },
          { type: 'modifier', text: `There was an extra charge of ${b} gold.` },
          { type: 'total', text: `I paid ${c} gold altogether.` },
          { type: 'question', text: `How much did the ${item.singular} cost before the extra charge?` }
        ]
      };

    case 'x_minus_b': {
      const discount = Math.abs(b);
      return {
        item,
        modifierType: 'discount',
        modifierAmount: discount,
        shortQuestion: `How much did the ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought a ${item.singular}.` },
          { type: 'modifier', text: `I got a discount of ${discount} gold.` },
          { type: 'total', text: `I paid ${c} gold.` },
          { type: 'question', text: `How much did the ${item.singular} cost before the discount?` }
        ]
      };
    }

    case 'ax':
      return {
        item,
        modifierType: 'none',
        modifierAmount: 0,
        shortQuestion,
        beats: [
          { type: 'objects', text: `I bought ${a} identical ${itemName}.` },
          { type: 'same_price', text: `They all cost the same amount.` },
          { type: 'total', text: `I paid ${c} gold altogether.` },
          { type: 'question', text: `How much did each ${item.singular} cost?` }
        ]
      };

    case 'ax_plus_b':
      return {
        item,
        modifierType: 'extra_charge',
        modifierAmount: b,
        shortQuestion,
        beats: [
          { type: 'objects', text: `I bought ${a} identical ${itemName}.` },
          { type: 'same_price', text: `They all cost the same amount.` },
          { type: 'modifier', text: `There was an extra charge of ${b} gold.` },
          { type: 'total', text: `I paid ${c} gold altogether.` },
          { type: 'question', text: `How much did each ${item.singular} cost before the extra charge?` }
        ]
      };

    case 'ax_minus_b': {
      const discount = Math.abs(b);
      return {
        item,
        modifierType: 'discount',
        modifierAmount: discount,
        shortQuestion,
        beats: [
          { type: 'objects', text: `I bought ${a} identical ${itemName}.` },
          { type: 'same_price', text: `They all cost the same amount.` },
          { type: 'modifier', text: `I got a discount of ${discount} gold.` },
          { type: 'total', text: `I paid ${c} gold altogether.` },
          { type: 'question', text: `How much did each ${item.singular} cost before the discount?` }
        ]
      };
    }
  }
}
```

## Concrete rendering by equation family

| Family | Story scene | Interactive equation |
| --- | --- | --- |
| `x_plus_b` | One object, plus an extra charge, equals total paid | `[icon] + b gold = c gold` |
| `x_minus_b` | One object, minus a discount, equals total paid | `[icon] − abs(b) gold = c gold` |
| `ax` | `a` identical objects equal total paid | `a × [icon] = c gold` |
| `ax_plus_b` | `a` identical objects, plus an extra charge, equal total paid | `a × [icon] + b gold = c gold` |
| `ax_minus_b` | `a` identical objects, minus a discount, equal total paid | `a × [icon] − abs(b) gold = c gold` |

## Equation interaction requirements

- Internally, the object icon retains the same identity and value as the existing `Y` token.
- The object icon uses the existing variable hitbox and behaviour.
- For `a × [icon]`, the coefficient operation target is the `a ×` portion. The object icon itself remains the unknown.
- Keep enough horizontal spacing around `a ×`, the modifier, the equals sign, and the total for reliable laser targeting.
- Highlight the corresponding concrete element when an equation component is targeted.
- Arithmetic prompts may omit the word `gold` inside calculations, but the story display and final answer should retain it.
- When the variable is isolated, render `[icon] = solution gold`.
- Switching between Move Across and Balance Both Sides resets only the in-progress equation manipulation. It must retain the same story and object.

## Deterministic item selection

Use a separate deterministic function so the same puzzle always receives the same object without affecting equation generation.

```ts
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getMagicItemForPuzzle(puzzleId: string): MagicItem {
  return MAGIC_ITEMS[hashString(puzzleId) % MAGIC_ITEMS.length];
}
```

If the curated level sequence produces the same item twice consecutively, it is acceptable to rotate the second item to the next entry. This should be based on level order, not additional random calls.

## Scope

### Included now

- Story text generated locally from fixed templates
- Wand, broomstick, cauldron, and spell themes
- Concrete object scene before every equation
- Transition from repeated objects to coefficient notation
- Persistent object icon replacing `Y`
- Integration with all five existing equation families
- Final substitution and story verification
- Compatibility with both existing interaction modes

### Possible later additions

- Browser speech synthesis for reading story beats aloud
- Additional magical objects and shop characters
- More varied authored story settings
- Optional conventional-letter view showing that the icon can also be written as `Y`

### Explicitly out of scope

- Speech synthesis or recorded narration
- Backend services or API calls
- Multiple different unknown objects in one equation
- Generating story prose dynamically with AI
- Fractions, negative prices, taxes, percentages, or currency conversion
- Changes to the existing puzzle-generation ranges or solving rules

## Acceptance criteria

1. Every current puzzle family begins with a grammatically correct story using its actual `a`, `b`, and `c` values.
2. The concrete scene accurately matches the generated equation.
3. The story always asks for the price of one object.
4. Negative `b` values are presented as positive discount amounts.
5. Repeated objects visibly condense into `a × [icon]` before solving begins.
6. No variable letter appears in the player-facing equation.
7. The same object icon remains visible throughout every algebraic step.
8. Both interaction modes continue to work without mathematical or input changes.
9. Completing a puzzle reveals the object price in gold and verifies it against the original story.
10. Reloading the same puzzle produces the same equation, story values, and object theme.
11. The feature works entirely client-side with no backend, API, audio, or network dependency.

