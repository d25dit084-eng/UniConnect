const { execSync, spawn } = require('child_process');

const envs = [
  { key: 'MONGO_URI', value: 'mongodb+srv://d25dit084_db_user:KUNJ124@cluster0.qfizpja.mongodb.net/uniconnect?retryWrites=true&w=majority&appName=Cluster0' },
  { key: 'JWT_SECRET', value: 'uniconnect_super_secret_jwt_prod_2026_xyz99' },
  { key: 'JWT_REFRESH_SECRET', value: 'uniconnect_super_refresh_jwt_prod_2026_xyz99' },
  { key: 'JWT_EXPIRE', value: '15m' },
  { key: 'JWT_REFRESH_EXPIRE', value: '7d' },
  { key: 'CLIENT_URL', value: 'https://uni-connect-amber-seven.vercel.app' },
  { key: 'VITE_API_URL', value: '/api' },
  { key: 'NODE_ENV', value: 'production' }
];

function addEnv(key, value) {
  return new Promise((resolve) => {
    console.log(`Setting ${key}...`);
    // First try removing existing key if any
    try {
      execSync(`npx vercel env rm ${key} production -y`, { stdio: 'ignore' });
    } catch (e) {}

    const child = spawn('npx.cmd', ['vercel', 'env', 'add', key, 'production'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    child.stdin.write(value + '\n');
    child.stdin.end();

    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.on('close', (code) => {
      console.log(`[${key}] exit code ${code}`);
      console.log(output.trim());
      resolve();
    });
  });
}

async function main() {
  for (const env of envs) {
    await addEnv(env.key, env.value);
  }
  console.log('All Vercel environment variables configured!');
}

main();
