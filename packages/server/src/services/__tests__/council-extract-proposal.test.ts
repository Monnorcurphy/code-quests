import { describe, it, expect } from 'vitest';
import { extractProposal } from '../council';

describe('extractProposal', () => {
  it('returns the prose unchanged when no proposal block is present', () => {
    const r = extractProposal('Just a chat reply with no JSON.');
    expect(r.prose).toBe('Just a chat reply with no JSON.');
    expect(r.proposal).toBeUndefined();
  });

  it('extracts a well-formed proposal and strips it from prose', () => {
    const raw = `Here are some thoughts.

[[PROPOSAL]]
{"title":"Sharper Title","description":"A clearer desc.","acceptanceCriteria":["First AC","Second AC"]}
[[/PROPOSAL]]`;
    const r = extractProposal(raw);
    expect(r.prose).toBe('Here are some thoughts.');
    expect(r.proposal).toEqual({
      title: 'Sharper Title',
      description: 'A clearer desc.',
      acceptanceCriteria: ['First AC', 'Second AC'],
    });
  });

  it('extracts a proposal with only a subset of fields', () => {
    const raw = `Just the title.\n[[PROPOSAL]]{"title":"X"}[[/PROPOSAL]]`;
    const r = extractProposal(raw);
    expect(r.proposal).toEqual({ title: 'X' });
    expect(r.proposal?.description).toBeUndefined();
  });

  it('drops empty AC items and caps the list at 15', () => {
    // Mix valid + empty strings + 18 real items; expect dedup-of-empties and
    // a cap at 15.
    const items = ['', '   ', ...Array.from({ length: 18 }, (_, i) => `AC ${i + 1}`)];
    const raw = `[[PROPOSAL]]
{"acceptanceCriteria":${JSON.stringify(items)}}
[[/PROPOSAL]]`;
    const r = extractProposal(raw);
    expect(r.proposal?.acceptanceCriteria).toHaveLength(15);
    expect(r.proposal?.acceptanceCriteria?.[0]).toBe('AC 1');
  });

  it('swallows malformed JSON instead of crashing', () => {
    const raw = `Some prose.\n\n[[PROPOSAL]]\n{ not valid json\n[[/PROPOSAL]]`;
    const r = extractProposal(raw);
    expect(r.prose).toBe('Some prose.');
    expect(r.proposal).toBeUndefined();
  });

  it('drops a proposal that contains only unknown fields', () => {
    const raw = `Prose.\n[[PROPOSAL]]{"foo":"bar","baz":42}[[/PROPOSAL]]`;
    const r = extractProposal(raw);
    expect(r.proposal).toBeUndefined();
  });

  it('ignores non-string AC items defensively', () => {
    const raw = `[[PROPOSAL]]{"acceptanceCriteria":["valid",123,null,"alsovalid"]}[[/PROPOSAL]]`;
    const r = extractProposal(raw);
    expect(r.proposal?.acceptanceCriteria).toEqual(['valid', 'alsovalid']);
  });
});
