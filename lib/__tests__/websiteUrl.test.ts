import { parsePublicWebsiteUrl } from '../websiteUrl';

describe('parsePublicWebsiteUrl', () => {
  it('should accept valid https URLs', () => {
    expect(parsePublicWebsiteUrl('https://example.com')).toBe('https://example.com');
    expect(parsePublicWebsiteUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('should reject http URLs', () => {
    expect(() => parsePublicWebsiteUrl('http://example.com')).toThrow();
  });

  it('should reject non-HTTPS URLs', () => {
    expect(() => parsePublicWebsiteUrl('ftp://example.com')).toThrow();
  });

  it('should reject invalid URLs', () => {
    expect(() => parsePublicWebsiteUrl('not-a-url')).toThrow();
    expect(() => parsePublicWebsiteUrl('')).toThrow();
  });

  it('should reject localhost', () => {
    expect(() => parsePublicWebsiteUrl('https://localhost')).toThrow();
    expect(() => parsePublicWebsiteUrl('https://127.0.0.1')).toThrow();
  });
});
