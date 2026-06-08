const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '../VirtualMenzaSimulator/.env');
const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
const env = { ...process.env };

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key.trim()] = rest.join('=').trim();
}

const result = spawnSync(
  'mvn',
  ['-f', 'VirtualMenzaSimulator/pom.xml', 'compile', 'exec:java', '-Dexec.mainClass=org.redometar.Main'],
  { env, stdio: 'inherit', shell: true }
);

process.exit(result.status ?? 1);
