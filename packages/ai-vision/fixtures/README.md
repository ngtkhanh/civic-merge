# Real Vision evaluation images

The repository currently contains only synthetic upload fixtures under `mocks/images/`; they are not evidence that Vision classifies real incidents correctly. Supply six permitted JPEG photographs before running the real-provider check: two potholes, two trash incidents, and two flood incidents.

Set `OPENAI_API_KEY` and `OPENAI_MODEL`, then set these environment variables to the six image paths:

- `CIVICMERGE_VISION_POTHOLE_1`, `CIVICMERGE_VISION_POTHOLE_2`
- `CIVICMERGE_VISION_TRASH_1`, `CIVICMERGE_VISION_TRASH_2`
- `CIVICMERGE_VISION_FLOOD_1`, `CIVICMERGE_VISION_FLOOD_2`

Run `npm.cmd run test --workspace=@civicmerge/ai-vision`. The provider check is skipped unless every variable is set. When enabled, it makes six real API requests and checks both the schema and expected incident type; normal API usage charges may apply. Keep private or identifying photos outside Git and do not commit API keys.
