import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const config: NextConfig = { reactStrictMode: true, poweredByHeader: false, outputFileTracingRoot: resolve(__dirname, '../..'), async headers() {return [{source:'/(.*)',headers:[
{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},
{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
{key:'Content-Security-Policy',value:"base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'"}]}]}};
export default config;
