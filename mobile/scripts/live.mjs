// Watch development live on your iPhone.
// Starts the Expo dev server and pulls new commits from GitHub every 30 seconds.
// Expo Go reloads the app on your phone by itself whenever the code changes.
//
//   npm run live            (phone and laptop on the same Wi-Fi)
//   npm run live -- --tunnel (if the QR code doesn't connect)
import { execSync, spawn } from 'node:child_process';

const extra = process.argv.slice(2);
const expo = spawn('npx', ['expo', 'start', ...extra], { stdio: 'inherit', shell: true });
expo.on('exit', (code) => process.exit(code ?? 0));

const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
setInterval(() => {
  try {
    execSync(`git fetch -q origin ${branch}`, { stdio: 'ignore' });
    const local = execSync('git rev-parse HEAD').toString().trim();
    const remote = execSync(`git rev-parse origin/${branch}`).toString().trim();
    if (local !== remote) {
      const log = execSync(`git log --oneline HEAD..origin/${branch}`).toString().trim();
      execSync(`git pull -q --ff-only origin ${branch}`, { stdio: 'ignore' });
      console.log(`\n[live] Pulled new changes:\n${log}\n`);
    }
  } catch {
    // Offline or local edits in the way; try again next round.
  }
}, 30_000);
