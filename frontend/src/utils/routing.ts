const rawBaseUrl = import.meta.env.BASE_URL || '/';

const normalizedBasePath = (() => {
  const withLeadingSlash = rawBaseUrl.startsWith('/') ? rawBaseUrl : `/${rawBaseUrl}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
})();

export function getRouterBasename() {
  return normalizedBasePath === '/' ? undefined : normalizedBasePath;
}

export function toAppPath(path: string) {
  if (!path.startsWith('/')) {
    return path;
  }

  if (normalizedBasePath === '/') {
    return path;
  }

  return `${normalizedBasePath}${path}`;
}
