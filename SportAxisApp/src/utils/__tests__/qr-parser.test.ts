import { parseQrCode, extractToken } from '../qr-parser';

describe('parseQrCode', () => {
  it('reads a raw 32-char token string', () => {
    const raw = 'a'.repeat(32);
    expect(parseQrCode(raw)).toEqual({ token: raw });
  });

  it('reads a JSON payload with token + eventId (both key styles)', () => {
    expect(parseQrCode('{"eventId":"evt-1","token":"tok-1"}')).toEqual({
      token: 'tok-1',
      eventId: 'evt-1',
    });
    expect(parseQrCode('{"event_id":"evt-2","qr_token":"tok-2"}')).toEqual({
      token: 'tok-2',
      eventId: 'evt-2',
    });
  });

  it('reads a URL with ?token= / ?eventId= params', () => {
    expect(parseQrCode('https://sportaxis.test/event?token=abc123&eventId=e9')).toEqual({
      token: 'abc123',
      eventId: 'e9',
    });
  });

  it('reads a /judge-qr/:eventId/:token path URL', () => {
    expect(parseQrCode('https://sportaxis.test/judge-qr/evt-7/tok-7')).toEqual({
      eventId: 'evt-7',
      token: 'tok-7',
    });
  });

  it('rejects empty / non-string input', () => {
    expect(() => parseQrCode('')).toThrow();
    // @ts-expect-error deliberate bad input
    expect(() => parseQrCode(null)).toThrow();
  });

  it('rejects an unrecognised string', () => {
    expect(() => parseQrCode('hello world !!')).toThrow(/Unrecognised/i);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseQrCode('{not json')).toThrow(/malformed JSON/i);
  });

  it('rejects a JSON object with neither a token nor an event id', () => {
    expect(() => parseQrCode('{"foo":"bar"}')).toThrow(/valid token or event ID/i);
  });
});

describe('extractToken', () => {
  it('prefers `token`, falls back to `qr_token`', () => {
    expect(extractToken({ token: 't1' })).toBe('t1');
    expect(extractToken({ qr_token: 't2' })).toBe('t2');
  });

  it('throws when no token is present', () => {
    expect(() => extractToken({ eventId: 'e1' })).toThrow(/No QR token/i);
  });
});
