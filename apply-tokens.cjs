const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Hardcoded colors in CSS
  // Grays/Blues to bg-card or border
  content = content.replace(/#1f2937/gi, "var(--color-bg-card)");
  content = content.replace(/#374151/gi, "var(--color-bg-card)");
  content = content.replace(/#4b5563/gi, "var(--color-text-muted)");
  content = content.replace(/#6b7280/gi, "var(--color-text-muted)");
  content = content.replace(/#9ca3af/gi, "var(--color-text-muted)");
  content = content.replace(/#d1d5db/gi, "var(--color-border)");
  content = content.replace(/#e5e7eb/gi, "var(--color-border)");
  content = content.replace(/#f3f4f6/gi, "var(--color-bg-input)");
  content = content.replace(/#f9fafb/gi, "var(--color-bg-main)");
  
  // Primary (Old Teal to Cyan)
  content = content.replace(/#0d9488/gi, "var(--color-primary)");
  content = content.replace(/#0f766e/gi, "var(--color-primary-hover)");
  content = content.replace(/#14b8a6/gi, "var(--color-accent)");
  
  // Borders
  content = content.replace(/border(-color)?:\s*#e5e7eb/gi, "border$1: var(--color-border)");
  content = content.replace(/border(-color)?:\s*#d1d5db/gi, "border$1: var(--color-border)");

  // 2. Inline Styles in TSX
  if (file.endsWith('.tsx')) {
    // Replace hex codes in inline styles
    content = content.replace(/'#1f2937'/gi, "'var(--color-bg-card)'");
    content = content.replace(/'#374151'/gi, "'var(--color-bg-card)'");
    content = content.replace(/'#4b5563'/gi, "'var(--color-text-muted)'");
    content = content.replace(/'#6b7280'/gi, "'var(--color-text-muted)'");
    content = content.replace(/'#9ca3af'/gi, "'var(--color-text-muted)'");
    content = content.replace(/'#d1d5db'/gi, "'var(--color-border)'");
    content = content.replace(/'#e5e7eb'/gi, "'var(--color-border)'");
    content = content.replace(/'#f3f4f6'/gi, "'var(--color-bg-input)'");
    content = content.replace(/'#f9fafb'/gi, "'var(--color-bg-main)'");
    
    // Status colors
    content = content.replace(/'#10B981'/gi, "'var(--color-success)'");
    content = content.replace(/'#F59E0B'/gi, "'var(--color-warning)'");
    content = content.replace(/'#EF4444'/gi, "'var(--color-danger)'");
    
    // Button variants that might be hardcoded
    content = content.replace(/backgroundColor:\s*'#0d9488'/gi, "backgroundColor: 'var(--color-primary)'");
    content = content.replace(/background:\s*'#0d9488'/gi, "background: 'var(--color-primary)'");
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
