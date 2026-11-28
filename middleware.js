import { NextResponse } from 'next/server';
import { splitPath } from './lib/i18n';

// /en/... מוצג מאותם עמודים כמו העברית: מסירים את הקידומת, ומעבירים לעמוד את השפה בכותרת x-kanaf-lang
export function middleware(request) {
  const url = request.nextUrl;
  const { lang, path } = splitPath(url.pathname);
  const headers = new Headers(request.headers);
  headers.set('x-kanaf-lang', lang);
  if (lang === 'he') return NextResponse.next({ request: { headers } });
  const to = url.clone();
  to.pathname = path;
  return NextResponse.rewrite(to, { request: { headers } });
}

export const config = {
  // רק עמודים: בלי API, קבצים סטטיים ותמונות
  matcher: ['/((?!api|_next|flags|favicon|icon|apple-icon|manifest|robots|sitemap|google|.*\\.[a-z0-9]+$).*)']
};
