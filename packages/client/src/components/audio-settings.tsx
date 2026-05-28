import { useAudioStore } from '../stores/audio-store';

export function AudioSettings() {
  const muted = useAudioStore((s) => s.muted);
  const silentMode = useAudioStore((s) => s.silentMode);
  const masterVolume = useAudioStore((s) => s.masterVolume);
  const setMuted = useAudioStore((s) => s.setMuted);
  const setSilentMode = useAudioStore((s) => s.setSilentMode);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);

  const displayVolume = Math.round(masterVolume * 100);

  return (
    <div>
      <div className="settings-row">
        <div className="settings-row-text">
          <span id="mute-label" className="settings-row-label">
            Mute
          </span>
        </div>
        <button
          role="switch"
          aria-checked={muted}
          aria-labelledby="mute-label"
          className={`settings-switch${muted ? ' settings-switch--on' : ''}`}
          onClick={() => setMuted(!muted)}
        >
          {muted ? 'On' : 'Off'}
        </button>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <span id="silent-mode-label" className="settings-row-label">
            Silent Mode
          </span>
          <span className="settings-row-hint">
            Disables all sound and replaces audio cues with visual indicators.
          </span>
        </div>
        <button
          role="switch"
          aria-checked={silentMode}
          aria-labelledby="silent-mode-label"
          className={`settings-switch${silentMode ? ' settings-switch--on' : ''}`}
          onClick={() => setSilentMode(!silentMode)}
        >
          {silentMode ? 'On' : 'Off'}
        </button>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <label htmlFor="master-volume-slider" className="settings-row-label">
            Master Volume
          </label>
        </div>
        <div className="settings-volume-wrap">
          <input
            id="master-volume-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={displayVolume}
            aria-valuetext={`${displayVolume} percent`}
            onChange={(e) => setMasterVolume(e.target.valueAsNumber / 100)}
          />
          <span className="settings-volume-label" aria-hidden="true">
            {displayVolume}%
          </span>
        </div>
      </div>
    </div>
  );
}
