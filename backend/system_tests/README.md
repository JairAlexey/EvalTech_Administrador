# System test helpers (manual app)

These scripts help run a full system test against the deployed backend.
They are separate from unit and integration tests.

Prereqs
- backend reachable at https://backend-production-b180.up.railway.app
- you have the superadmin credentials (superadmin is created by default)
- AWS/S3 configured if you want media uploads and behavior analysis

Flow
1) Prepare event and participants
   python system_tests/prepare_system_test.py --superadmin-email SUPER --superadmin-password PASS

2) Get event keys (to use in the desktop app)
   python system_tests/get_event_keys.py --superadmin-email SUPER --superadmin-password PASS --event-id EVENT_ID

3) Run the desktop app manually
   - input event_key
   - start monitoring
   - keep it running until the event finishes

4) Verify system results
   python system_tests/verify_system_test.py --superadmin-email SUPER --superadmin-password PASS

Notes
- prepare_system_test.py writes system_tests/system_run.json
- get_event_keys.py computes keys from event id + participant email and updates system_run.json
- verify_system_test.py reads system_run.json if present
- use --api-base to target a different backend
