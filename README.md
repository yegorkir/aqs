# Adaptive Questionnaire System

## Bundle validation

Run the validator after any change to `content/bundle.json`:

```bash
node scripts/validate_bundle.js
```

To validate a specific file:

```bash
node scripts/validate_bundle.js content/bundle.json
```

## Prototype server (app)

Serve the static prototype from the repo root so it can fetch `content/bundle.json` and `schema/quiz.schema.json`:

```bash
python3 -m http.server
```

Then open `http://localhost:8000/app/` in your browser.

If you have a local file server already, ensure it serves the repo root and open the same URL.
