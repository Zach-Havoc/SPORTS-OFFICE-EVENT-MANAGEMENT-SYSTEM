/**
 * Talking to the local backend from a test, for the parts a browser can't:
 *
 *  - reading what the system emailed (mail only goes to the log in the
 *    throwaway setup), e.g. a tryout verification code;
 *  - doing what the mobile app does, i.e. the committee scoring a game,
 *    through the same API the app calls.
 *
 * Only ever pointed at this machine.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(here, '../../../backend');
export const API_URL = (process.env.E2E_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');

/** Run a PHP snippet in the app (`artisan tinker`) and return its last output line. */
export function php(code) {
  const out = execFileSync('php', ['artisan', 'tinker', '--execute', code], {
    cwd: API_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return out.trim().split('\n').pop().trim();
}

/** A value from the database, as JSON-encoded by PHP. */
export function query(expression) {
  return JSON.parse(php(`echo json_encode(${expression});`));
}

/** The database the app (and so these tests) is writing to. */
export function databaseName() {
  return php('echo config("database.connections.".config("database.default").".database");');
}

export async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(API_URL + pathname, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
  return data;
}

/** Sign in through the API (as the mobile app does) and return the token. */
export async function apiToken(email, password) {
  return (await api('/login', { method: 'POST', body: { email, password } })).token;
}

/**
 * Call the API and return { status, data } without throwing, for checking
 * how it answers bad input. `files` are { field: { name, type, bytes } }.
 */
export async function attempt(pathname, { method = 'POST', token, body, files } = {}) {
  let payload;
  const headers = { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (files) {
    payload = new FormData();
    for (const [k, v] of Object.entries(body ?? {})) {
      if (Array.isArray(v)) v.forEach((x) => payload.append(`${k}[]`, x));
      else if (v !== undefined && v !== null) payload.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    for (const [k, f] of Object.entries(files)) payload.append(k, new Blob([f.bytes], { type: f.type }), f.name);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(API_URL + pathname, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text.slice(0, 300);
  }
  return { status: res.status, data };
}
