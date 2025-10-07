# Dosha Questionnaire Configuration

This directory contains the Ayurvedic dosha assessment questionnaire configuration.

## Files

### dosha-questions.json
Complete questionnaire configuration with 12 questions across 4 sections.

**Structure:**
```json
{
  "version": "1.0.0",
  "sections": [
    {
      "id": "basic|physical|mental|lifestyle",
      "title": "Section Title",
      "questions": [
        {
          "id": "unique_question_id",
          "text": "Question text",
          "type": "single|multi",
          "options": [
            {
              "text": "Option text",
              "doshaPoints": {
                "vata": 0-2,
                "pitta": 0-2,
                "kapha": 0-2
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Usage

The configuration is loaded automatically by the `DoshaCalculator` service:

```typescript
import { DoshaCalculator } from '../services/dosha-calculator.service';

const calculator = new DoshaCalculator();
const questions = calculator.getQuestions();
```

## Question Types

- **single**: Radio button - only one option can be selected
- **multi**: Checkbox - multiple options can be selected

## Dosha Points

Each option assigns points (0-2) to one or more doshas:
- **2 points**: Strong indicator of that dosha
- **1 point**: Moderate indicator
- **0 points**: Not associated with that dosha

## Modification Guidelines

When modifying questions:
1. Maintain the JSON structure
2. Ensure all question IDs are unique
3. Keep dosha points within 0-2 range
4. Test with the DoshaCalculator validation
5. Update version number

## Validation

Questions are automatically validated when used:
- Unique IDs enforced
- Required fields checked
- Point values validated
- Type consistency verified
