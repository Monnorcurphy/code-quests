import { useEffect, useRef } from 'react';
import { AUDIO_CREDITS } from '../audio/credits-data';

interface CreditsProps {
  onBack: () => void;
}

export default function Credits({ onBack }: CreditsProps) {
  const backRef = useRef<HTMLButtonElement>(null);

  // Move focus to Back button when credits view mounts so keyboard users have a sensible target
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div data-testid="credits-screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button ref={backRef} className="btn-secondary" onClick={onBack} aria-label="Back to settings">
          ← Back
        </button>
        <h3
          id="credits-title"
          style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#2c2416' }}
        >
          Audio Credits
        </h3>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#5c4a2a', marginBottom: '0.75rem' }}>
        All audio is CC0 (public domain). No attribution required. Replace placeholders with real
        tracks using the same filenames — no code changes needed.
      </p>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}
        aria-label="Audio file credits"
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #c8a87a' }}>
            <th
              scope="col"
              style={{ textAlign: 'left', padding: '0.25rem 0.4rem', color: '#2c2416' }}
            >
              File
            </th>
            <th
              scope="col"
              style={{ textAlign: 'left', padding: '0.25rem 0.4rem', color: '#2c2416' }}
            >
              Author
            </th>
            <th
              scope="col"
              style={{ textAlign: 'left', padding: '0.25rem 0.4rem', color: '#2c2416' }}
            >
              License
            </th>
          </tr>
        </thead>
        <tbody>
          {AUDIO_CREDITS.map((entry) => (
            <tr
              key={entry.file}
              data-testid={`credit-row-${entry.file}`}
              style={{ borderBottom: '1px solid rgba(200,168,122,0.3)' }}
            >
              <td style={{ padding: '0.3rem 0.4rem', color: '#2c2416', fontFamily: 'monospace' }}>
                {entry.file}
              </td>
              <td style={{ padding: '0.3rem 0.4rem', color: '#5c4a2a' }}>{entry.author}</td>
              <td style={{ padding: '0.3rem 0.4rem', color: '#5c4a2a' }}>{entry.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
