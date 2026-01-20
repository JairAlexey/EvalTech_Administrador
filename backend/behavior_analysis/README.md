# Behavior Analysis Module

This module provides automated behavior analysis for evaluation sessions.

## Features

- **External Voice Detection**: Analyzes audio for high energy levels indicating speech.
- **Lip Sync Analysis**: Checks consistency between lip movements and audio energy.
- **Gesture Identification**: Detects head poses (looking away).
- **Lighting Change Detection**: Detects sudden changes in brightness.
- **Multiple Faces**: Detects if more than one person is in the frame.
- **Absence Detection**: Detects if the candidate is missing from the frame.

## Testing

You can test each feature individually using the `test_behavior` management command. This uses your local camera and microphone.

### Usage

Run the following command from the project root (ensure your virtual environment is active):

```bash
python backend/manage.py test_behavior --feature <feature_name>
```

### Available Features

- `voice`: Records 5 seconds of audio and checks energy levels.
- `lipsync`: Opens camera and microphone to visualize lip sync.
- `gestures`: Opens camera to detect head orientation (Left, Right, Up, Down).
- `lighting`: Opens camera to detect sudden brightness changes.
- `multiple_faces`: Opens camera to count detected faces.
- `absence`: Opens camera to track candidate presence/absence.

### Controls

- Press `q` to quit any of the video-based tests.
