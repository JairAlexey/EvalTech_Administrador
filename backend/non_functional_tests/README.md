# Non functional tests (backend)

Response time checks for a single backend endpoint.

Examples (PowerShell)
- `python non_functional_tests\observe_backend_response_time.py`
- `python non_functional_tests\observe_backend_response_time.py --path /events/api/events-status/pending-start/ --bearer <token>`
- `python non_functional_tests\observe_backend_response_time.py --count 10 --pause-ms 200`

Notes
- Default URL: `BASE_URL` + `/events/api/events-status/pending-start/`.
- Use `--url` to pass a full URL if needed.

Async processing stability (Celery + Redis)
Examples (PowerShell)
- `python non_functional_tests\observe_async_processing_stability.py`
- `python non_functional_tests\observe_async_processing_stability.py --count 3 --timeout-seconds 1800`
- `python non_functional_tests\observe_async_processing_stability.py --video media/participant_events/9/2026/01/14/video_20260114_052006_3d69d399.webm`

Notes
- Place a local video file in `non_functional_tests\load` or pass `--video`.
- For production runs, pass the S3 key or URL so the worker can download it.
- Requires running Django, the Celery worker, Redis, and database access.
- The Celery worker must be able to read the same video file path.

JWT access control
Examples (PowerShell)
- `python non_functional_tests\observe_jwt_access_control.py --email admin@example.com --password secret`
- `python non_functional_tests\observe_jwt_access_control.py --token <jwt>`
- `python non_functional_tests\observe_jwt_access_control.py --skip-role-check`

Notes
- Uses `/auth/user-info/` to validate missing/invalid/valid tokens.
- Uses `/auth/verify-token/` to validate a token.
- Uses `/auth/roles/` to validate role enforcement (expects 403 unless role=superadmin).

Processing time vs video duration
Examples (PowerShell)
- `python non_functional_tests\observe_processing_time_report.py --video media/participant_events/9/2026/01/14/video_20260114_052006_3d69d399.webm`
- `python non_functional_tests\observe_processing_time_report.py --video non_functional_tests\load\sample.webm`

Notes
- Use an S3 key in production so the worker downloads the recording.
- The output prints video duration and processing time in minutes.
