// A question at the terminal, for the one script that needs a person's
// credentials (import.mjs). The password is typed unseen, so it never sits
// on the command line — PowerShell writes every command line to a history
// file on disk, and a password given as `$env:…='…'` would be there in
// clear text for good.
import readline from 'node:readline';

/** When stdin is a pipe, its whole content is read once and handed out a line at a time. */
let pipedLines = null;

async function nextPipedLine() {
  if (!pipedLines) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    pipedLines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
  }
  return (pipedLines.shift() ?? '').trim();
}

/**
 * Ask on the terminal. With `hidden`, nothing is echoed while typing. When
 * stdin is not a terminal (a pipe, a CI job), the answer is the next line of
 * it, so the script can still be driven by another program.
 * @param {string} question
 * @param {{ hidden?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function ask(question, { hidden = false } = {}) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    stdout.write(question);
    const answer = await nextPipedLine();
    stdout.write('\n');
    return answer;
  }
  if (!hidden) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          // Ctrl+C: leave the terminal as it was found.
          finish();
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}
