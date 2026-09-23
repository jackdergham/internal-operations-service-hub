# Scope

This slice adds AI-assisted request creation to the existing Internal Operations Service Hub. An employee describes what they need in free text; the system returns a structured candidate containing a request type and form values. The employee reviews and edits the existing form before submitting it.

AI assistance is advisory. It never creates a Request, bypasses authorization, or bypasses the normal Intake validation and routing path.

# Request Flow

1. The frontend opens the normal request creator.
2. The employee enters a natural-language description.
3. The frontend calls `POST /requests/assist`.
4. The backend validates the requester identity using `x-actor-id`.
5. The configured assistance provider returns a structured suggestion.
6. The frontend fills the schema-driven request form with the suggestion.
7. The employee reviews or changes the values.
8. The existing `POST /requests` endpoint validates, persists, and routes the request.

The assistance endpoint does not persist data or trigger routing.

# Provider Boundary

The intake module uses the `RequestAssistProvider` interface:

```text
RequestAssistProvider
	-> LocalRequestAssistProvider
	-> GeminiRequestAssistProvider
```

The provider returns:

```json
{
	"requestTypeId": "new-laptop",
	"formData": { "department": "Engineering" },
	"missingFields": [],
	"warnings": [],
	"confidence": "high",
	"source": "gemini"
}
```

Supported request types are currently `new-laptop`, `pto-request`, and `desk-relocation`. Form fields are loaded from the request type schema rather than duplicated in the AI endpoint.

# Gemini Provider

Gemini is called only by the NestJS backend. The frontend never receives the API key. The provider requests JSON output and validates the response shape before returning it.

Configure the backend environment locally:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=<replace-with-a-rotated-key>
GEMINI_MODEL=<supported-gemini-model>
```

`backend/.env` is ignored by Git. A missing key selects the local provider, and Gemini HTTP failures or malformed output fall back to the local provider with a warning.

# Local Fallback

The local provider requires no API key and is deterministic. It recognizes:

- Laptop, workstation, equipment, and monitor requests
- PTO, leave, vacation, and annual leave requests
- Desk relocation and workspace requests
- Single- and multi-word departments
- PTO dates in `YYYY-MM-DD` and `DD/MM/YYYY` formats
- Relocation destinations when stated explicitly

It never invents missing values. Required fields remain in `missingFields` so the employee can complete them manually.

# Failure Handling

- Invalid requester identity returns `403 Forbidden`.
- Descriptions shorter than 10 characters return `400 Bad Request`.
- Gemini authentication, model, network, availability, or parsing failures use the local provider fallback.
- The final request still passes the normal request-type schema validation.
- A provider failure cannot submit or persist a request by itself.

The fallback is intentionally user-safe, but production observability should eventually record provider failure status and latency without recording API keys or sensitive request text.

# Evaluation

Run the deterministic evaluation suite without a Gemini key:

```bash
cd backend
npm run eval:ai
```

The suite currently covers nine cases:

- New laptop with a department
- Workstation with team wording
- PTO with missing dates
- PTO with ISO dates
- PTO with slash dates
- Desk relocation with a destination
- Ambiguous equipment and desk wording
- Unknown request type
- Desk relocation without a destination

The Gemini adapter also has mocked tests for valid structured output, malformed output, HTTP failure, and missing-key fallback.

# Verification Evidence

The current backend verification passes:

```text
27 tests passed
npm run build passed
npm run lint passed
```

The frontend build also passes after connecting the unified request creator to the assistance endpoint.

# Known Limitations

- The Gemini model name must be configured to a model available to the account.
- The local fallback uses bounded extraction rather than general language understanding.
- The current UI displays warnings and confidence but does not yet provide a detailed field-by-field provenance view.
- Provider failures currently fall back without sanitized structured logging; production should add provider failure metrics and diagnostics.
