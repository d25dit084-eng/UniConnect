import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Simple manual dotenv loader to avoid package dependencies
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      // Ignore comments and empty lines
      if (line.trim().startsWith('#') || !line.includes('=')) continue;
      const index = line.indexOf('=');
      const key = line.slice(0, index).trim();
      let val = line.slice(index + 1).trim();
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

// Load env files
loadEnvFile('.env');
loadEnvFile('.env.local');

const licenseKey = process.env.REACTBITS_LICENSE_KEY;

const components = [
  {
    name: 'GradientWaves-JS-CSS',
    url: 'https://reactbits.dev/r/GradientWaves-JS-CSS.json',
    isPro: false,
  },
  {
    name: 'authentication-4-css',
    url: 'https://pro.reactbits.dev/api/r/pro/authentication-4-css.json',
    isPro: true,
  },
  {
    name: 'chat-2-css',
    url: 'https://pro.reactbits.dev/api/r/pro/chat-2-css.json',
    isPro: true,
  },
  {
    name: 'comments-1-css',
    url: 'https://pro.reactbits.dev/api/r/pro/comments-1-css.json',
    isPro: true,
  },
  {
    name: 'social-proof-16-css',
    url: 'https://pro.reactbits.dev/api/r/pro/social-proof-16-css.json',
    isPro: true,
  },
  {
    name: 'features-6-css',
    url: 'https://pro.reactbits.dev/api/r/pro/features-6-css.json',
    isPro: true,
  },
  {
    name: 'hero-13-css',
    url: 'https://pro.reactbits.dev/api/r/pro/hero-13-css.json',
    isPro: true,
  },
];

async function install() {
  console.log('Starting automated component installer...');

  const packageJsonPath = path.resolve('package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const installedDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  let depsToInstall = [];

  for (const comp of components) {
    console.log(`\n----------------------------------------`);
    console.log(`Installing component: ${comp.name}`);
    console.log(`Source URL: ${comp.url}`);

    const headers = {};
    if (comp.isPro) {
      if (!licenseKey) {
        console.warn(`[WARNING] Skipping Pro component ${comp.name} because REACTBITS_LICENSE_KEY is not set.`);
        continue;
      }
      headers['Authorization'] = `Bearer ${licenseKey}`;
    }

    try {
      const response = await fetch(comp.url, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // 1. Process files
      if (data.files && Array.isArray(data.files)) {
        for (const file of data.files) {
          const targetPath = path.join('src', 'components', file.path);
          const targetDir = path.dirname(targetPath);

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          console.log(`Writing file: ${targetPath}`);
          fs.writeFileSync(targetPath, file.content, 'utf-8');
        }
      }

      // 2. Collect dependencies
      if (data.dependencies && Array.isArray(data.dependencies)) {
        for (const dep of data.dependencies) {
          const name = dep.split('@')[0];
          if (!installedDeps[name] && !depsToInstall.includes(dep)) {
            console.log(`Found new dependency: ${dep}`);
            depsToInstall.push(dep);
          }
        }
      }

      console.log(`Successfully installed ${comp.name}!`);
    } catch (err) {
      console.error(`[ERROR] Failed to install component ${comp.name}:`, err.message);
    }
  }

  // 3. Install new dependencies
  if (depsToInstall.length > 0) {
    console.log(`\nInstalling new npm dependencies: ${depsToInstall.join(', ')}`);
    try {
      execSync(`npm install ${depsToInstall.join(' ')}`, { stdio: 'inherit' });
      console.log('Dependencies successfully installed.');
    } catch (err) {
      console.error('[ERROR] Failed to install npm dependencies:', err.message);
    }
  } else {
    console.log('\nNo new npm dependencies to install.');
  }

  console.log('\nComponent installation process completed.');
}

install();
