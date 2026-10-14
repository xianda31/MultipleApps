const { spawn } = require('child_process');

const angularCli = require.resolve('@angular/cli/bin/ng.js');
const serverPath = require.resolve('./changelog-editor-server.cjs');
const angularArgs = ['serve', 'admin', ...process.argv.slice(2)];
const editorServer = spawn(process.execPath, ['--watch', serverPath], { stdio: 'inherit' });
const angularServer = spawn(process.execPath, [angularCli, ...angularArgs], { stdio: 'inherit' });
let shuttingDown = false;

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!editorServer.killed) editorServer.kill();
  if (!angularServer.killed) angularServer.kill();
  setTimeout(() => process.exit(exitCode), 100);
}

editorServer.on('exit', (code) => {
  if (!shuttingDown) shutdown(code ?? 1);
});
angularServer.on('exit', (code) => {
  if (!shuttingDown) shutdown(code ?? 0);
});
editorServer.on('error', (error) => {
  console.error('[Change log] Service local interrompu:', error.message);
  shutdown(1);
});
angularServer.on('error', (error) => {
  console.error('[Angular] Serveur interrompu:', error.message);
  shutdown(1);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
