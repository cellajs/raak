import { spawn } from "node:child_process";

export async function runGitCommand({ targetFolder, command }) {
    return new Promise((resolve, reject) => {
      const child = spawn(`git ${command}`, [], { cwd: targetFolder, shell: true, timeout: 60000 });
  
      let output = '';
      let errOutput = '';

      // If the command fails, reject with the error message
      let gitCommand = 'other';
      if (command.startsWith('merge')) {
        gitCommand = 'merge';
      } else if (command.startsWith('diff')) {
        gitCommand = 'diff';
      }

      child.on("error", (error) => {
        reject(error);
      });
  
      child.on("exit", (code) => {
        switch (gitCommand) {
          case 'merge':
            if (code === 0 || (code === 1 && !errOutput)) {
              resolve(output.trim());
            } else {
              reject(`Merge failed with exit code "${code}", stderr "${errOutput}" and output "${output}"`);
            }
            break;

          case 'diff':
            if (code === 0 || (code === 2 && !errOutput)) {
              resolve(output.trim());
            } else {
              reject(`Diff failed with exit code "${code}", stderr "${errOutput}" and output "${output}"`);
            }
            break;

          default:
            if (code === 0) {
              resolve(output.trim());
            } else {
              reject(`Command failed with exit code "${code}", stderr "${errOutput}" and output "${output}"`);
            }
        }
      });
      
      // Collect stdout data
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Swallow stderr
      child.stderr.on("data", (data) => {
        errOutput += data.toString();
      });
    });
  }