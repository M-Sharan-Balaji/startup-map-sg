import { normalizeWebsiteUrl, getHostnameKey } from '../startup';

describe('normalizeWebsiteUrl', () => {
  it('should normalize URLs to lowercase origin', () => {
    expect(normalizeWebsiteUrl('https://Example.COM')).toBe('https://example.com');
    expect(normalizeWebsiteUrl('HTTPS://EXAMPLE.COM/path')).toBe('https://example.com');
  });

  it('should remove hash and set default pathname', () => {
    expect(normalizeWebsiteUrl('https://example.com#section')).toBe('https://example.com');
    expect(normalizeWebsiteUrl('https://example.com')).toBe('https://example.com');
  });

  it('should handle invalid URLs gracefully', () => {
    expect(normalizeWebsiteUrl('not-a-url')).toBe('not-a-url');
    expect(normalizeWebsiteUrl('')).toBe('');
  });

  it('should handle URLs with paths', () => {
    expect(normalizeWebsiteUrl('https://example.com/path/to/page')).toBe('https://example.com');
  });
});

describe('getHostnameKey', () => {
  it('should extract hostname from full URL', () => {
    expect(getHostnameKey('https://example.com')).toBe('example.com');
    expect(getHostnameKey('https://www.example.com')).toBe('example.com');
  });

  it('should handle URLs without protocol', () => {
    expect(getHostnameKey('example.com')).toBe('example.com');
    expect(getHostnameKey('www.example.com')).toBe('example.com');
  });

  it('should convert to lowercase', () => {
    expect(getHostnameKey('HTTPS://EXAMPLE.COM')).toBe('example.com');
  });

  it('should handle invalid URLs gracefully', () => {
    expect(getHostnameKey('not-a-url')).toBe('not-a-url');
  });
});
