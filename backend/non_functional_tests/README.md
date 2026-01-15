# Non functional tests (backend)

Simple response time checks for a single backend endpoint.

Examples (PowerShell)
- `python non_functional_tests\observe_backend_response_time.py`
- `python non_functional_tests\observe_backend_response_time.py --path /events/api/events-status/pending-start/ --bearer <token>`
- `python non_functional_tests\observe_backend_response_time.py --count 10 --pause-ms 200`

Notes
- Default URL: `BASE_URL` + `/events/api/events-status/pending-start/`.
- Use `--url` to pass a full URL if needed.
