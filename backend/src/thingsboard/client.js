const TB_URL = process.env.TB_URL;
const TB_EMAIL = process.env.TB_EMAIL;
const TB_PASSWORD = process.env.TB_PASSWORD;

async function tbLogin() {
  const res = await fetch(`${TB_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TB_EMAIL, password: TB_PASSWORD }),
  });
  if (!res.ok) throw new Error(`ThingsBoard login failed: ${res.status}`);
  return (await res.json()).token;
}

async function tbGet(path, token) {
  const res = await fetch(`${TB_URL}${path}`, {
    headers: { 'X-Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TB GET ${path} → ${res.status}`);
  return res.json();
}

async function tbPost(path, token, body) {
  const res = await fetch(`${TB_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TB POST ${path} → ${res.status}`);
  return res;
}

module.exports = { TB_URL, tbLogin, tbGet, tbPost };
