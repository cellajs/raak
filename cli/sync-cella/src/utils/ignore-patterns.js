import { access, readFile } from 'node:fs/promises';

// Helper function to check if a file exists
async function fileExists(filePath) {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

// Extract patterns from the ignore file
async function extractFromIgnoreFile(ignoreFile) {
    const content = await readFile(ignoreFile, 'utf-8');
    return content.split(/\r?\n/).filter(Boolean);
  }

// Extract patterns from the ignore list
function extractFromIgnoreList(ignoreList) {
    return Array.isArray(ignoreList)
      ? ignoreList
      : ignoreList ? ignoreList.split(',') : [];
  }

// Extract ignore patterns based on provided list or file
export async function extractIgnorePatterns({ ignoreList, ignoreFile }) {
    if (ignoreList && ignoreList.length > 0) {
      return extractFromIgnoreList(ignoreList);
    } else if (ignoreFile && (await fileExists(ignoreFile))) {
      return await extractFromIgnoreFile(ignoreFile);
    }
    return [];
  }

// Helper function to convert ignore patterns to regular expressions
function patternToRegex(pattern) {
    // Escape special regex characters and convert wildcards
    const escapedPattern = pattern
      .replace(/([.*+?^${}()|[\]\\])/g, '\\$1') // Escape special characters
      .replace(/\\\*/g, '.*')                   // Convert '*' to '.*'
      .replace(/\\\?/g, '.');                   // Convert '?' to '.'
    
    return new RegExp(`^${escapedPattern}$`);
  }

// Helper function to pick files that match ignore patterns
export function pickByIgnorePatterns(files, ignorePatterns) {
  return files.filter((file) => {
    return ignorePatterns.some((pattern) => {
      const regex = patternToRegex(pattern);
      return regex.test(file);
    });
  });
}

// Helper function to exclude files that match ignore patterns
export function excludeByIgnorePatterns(files, ignorePatterns) {
  return files.filter((file) => {
    return !ignorePatterns.some((pattern) => {
      const regex = patternToRegex(pattern);
      return regex.test(file);
    });
  });
}