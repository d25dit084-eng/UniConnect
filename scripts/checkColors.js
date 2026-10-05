#!/usr/bin/env node
/**
 * scripts/checkColors.js
 *
 * Lint check script to prevent hardcoded color literals outside the design token block.
 * Single source of truth is :root in frontend/src/index.css.
 *
 * Usage:
 *   node scripts/checkColors.js           (Reports all color offenders; fails if > allowed baseline)
 *   node scripts/checkColors.js --strict  (Fails if ANY color literal exists outside :root)
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const cssPath = path.join(rootDir, 'frontend', 'src', 'index.css');

if (!fs.existsSync(cssPath)) {
  console.error(`[checkColors] Error: ${cssPath} does not exist.`);
  process.exit(1);
}

const cssContent = fs.readFileSync(cssPath, 'utf8');
const lines = cssContent.split('\n');

// Detect :root block boundaries
let insideRoot = false;
let rootBraceDepth = 0;
const rootLineRanges = [];
let currentRootStart = -1;

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  if (!insideRoot && line.includes(':root') && line.includes('{')) {
    insideRoot = true;
    rootBraceDepth = 1;
    currentRootStart = lineNum;
  } else if (insideRoot) {
    for (const ch of line) {
      if (ch === '{') rootBraceDepth++;
      if (ch === '}') rootBraceDepth--;
    }
    if (rootBraceDepth <= 0) {
      insideRoot = false;
      rootLineRanges.push({ start: currentRootStart, end: lineNum });
    }
  }
});

function isInsideRoot(lineNum) {
  return rootLineRanges.some(r => lineNum >= r.start && lineNum <= r.end);
}

// Regex matching color literals
// Matches #hex, rgb(...), rgba(...), hsl(...), hsla(...), and plain 'white'/'black' values
const colorLiteralRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|:\s*(white|black)\b)/;

const cssOffenders = [];

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  const trimmed = line.trim();

  // Skip comments and lines inside :root
  if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.endsWith('*/')) return;
  if (isInsideRoot(lineNum)) return;

  // Check if line contains property with color literal
  if (colorLiteralRegex.test(trimmed)) {
    // Exclude CSS url(), data:image, and comment lines
    if (trimmed.includes('url(') || trimmed.includes('data:image')) return;
    cssOffenders.push({
      file: 'frontend/src/index.css',
      line: lineNum,
      snippet: trimmed,
    });
  }
});

// Check JSX inline styles
function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (entry.endsWith('.jsx') || entry.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const jsxOffenders = [];
const srcDir = path.join(rootDir, 'frontend', 'src');
const sourceFiles = walkDir(srcDir);

sourceFiles.forEach(filePath => {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const code = fs.readFileSync(filePath, 'utf8');
  const fileLines = code.split('\n');

  fileLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if ((trimmed.includes('style={{') || trimmed.includes('style={')) && colorLiteralRegex.test(trimmed)) {
      jsxOffenders.push({
        file: relPath,
        line: idx + 1,
        snippet: trimmed,
      });
    }
  });
});

const totalOffenders = cssOffenders.length + jsxOffenders.length;
const isStrict = process.argv.includes('--strict');

console.log('================================================================');
console.log('🎨 UniConnect Color Token Architecture Audit');
console.log('================================================================');
console.log(`Single Source of Truth: :root in frontend/src/index.css`);
console.log(`- CSS Color Literal Violations (outside :root): ${cssOffenders.length}`);
console.log(`- JSX Inline Style Color Violations:           ${jsxOffenders.length}`);
console.log(`- Total Hardcoded Color Violations:             ${totalOffenders}`);
console.log('================================================================');

if (totalOffenders > 0) {
  console.log('\nTop CSS Violations (outside token block):');
  cssOffenders.slice(0, 15).forEach(o => {
    console.log(`  ${o.file}:${o.line} -> ${o.snippet}`);
  });
  if (cssOffenders.length > 15) {
    console.log(`  ... and ${cssOffenders.length - 15} more CSS violations`);
  }

  console.log('\nTop JSX Violations:');
  jsxOffenders.slice(0, 10).forEach(o => {
    console.log(`  ${o.file}:${o.line} -> ${o.snippet}`);
  });
  if (jsxOffenders.length > 10) {
    console.log(`  ... and ${jsxOffenders.length - 10} more JSX violations`);
  }
}

// During progressive migration:
// In strict mode, fail on any violation.
// In baseline mode, baseline is tracked and fails if new violations exceed current cap.
const MAX_ALLOWED_BASELINE = 435; // Starting diagnosed baseline; will burn down to 0 across V2-V6

if (isStrict && totalOffenders > 0) {
  console.error(`\n❌ Strict check failed: Found ${totalOffenders} color literals outside :root!`);
  process.exit(1);
} else if (totalOffenders > MAX_ALLOWED_BASELINE) {
  console.error(`\n❌ Quality gate failed: Total color literals (${totalOffenders}) exceeded baseline cap (${MAX_ALLOWED_BASELINE})!`);
  process.exit(1);
} else {
  console.log(`\n✅ Color check passed within transition budget (Current: ${totalOffenders}, Cap: ${MAX_ALLOWED_BASELINE}).`);
  process.exit(0);
}
