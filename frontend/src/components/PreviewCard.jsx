import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, Plus, X } from 'lucide-react';

function Section({ title, children, defaultOpen = true, innerRef }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div ref = {innerRef} className="border border-gray-200 rounded-lg mb-4 transition-colors duration-500">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {open ? <ChevronDown className="h-5 w-5 text-gray-500"/> : <ChevronRight className="h-5 w-5 text-gray-500"/>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

const PreviewCard = forwardRef(({ solution, editable = false, onChange }, ref) => {

  // Refs for chatbot navigation
  const sectionRefs = {
    'problem-statement': useRef(null),
    'key-challenges': useRef(null),
    'solution-approach': useRef(null),
    'architecture-diagram': useRef(null),
    'milestones': useRef(null),
    'technical-stack': useRef(null),
    'objectives': useRef(null),
    'acceptance-criteria': useRef(null),
    'resources': useRef(null),
    'cost-analysis': useRef(null),
    'key-performance-indicators': useRef(null),
  };

  // Mermaid rendering refs and state
  const mermaidContainerRef = useRef(null);
  const lastRenderRef = useRef(0);
  const [showMermaidCode, setShowMermaidCode] = useState(false);
  const [mermaidImgError, setMermaidImgError] = useState(false);

  useEffect(() => {
    setMermaidImgError(false);
  }, [solution?.architecture_diagram]);

  useEffect(() => {
    setShowMermaidCode(false);
  }, [solution?.architecture_diagram]);

  // Load Mermaid library dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.mermaid) return; // Already loaded
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      try {
        window.mermaid?.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'default'
        });
        window.mermaid?.mermaidAPI?.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'default'
        });
      } catch (e) {
        console.error('Mermaid initialization error:', e);
      }
    };
    document.body.appendChild(script);
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Helper functions for Mermaid diagram handling
  function hasBalancedSubgraphs(diagram) {
    if (!diagram) return true;
    const lines = String(diagram).split(/\n/);
    let balance = 0;
    for (const ln of lines) {
      if (/^\s*subgraph\b/i.test(ln)) balance++;
      if (/^\s*end\b/i.test(ln)) balance--;
    }
    return balance === 0;
  }

  function fixUnbalancedSubgraphs(code) {
    const lines = String(code).split(/\n/);
    let balance = 0;
    for (const ln of lines) {
      if (/^\s*subgraph\b/i.test(ln)) balance++;
      if (/^\s*end\b/i.test(ln)) balance--;
    }
    if (balance > 0) {
      // Add missing 'end' statements
      return code.trim() + '\n' + 'end\n'.repeat(balance);
    }
    return code;
  }

  // Convert crow's foot notation to erDiagram format
  function crowFootToErDiagram(src) {
    if (!src) return src;
    let s = String(src).trim();
    
    // Check if already erDiagram
    if (/^erDiagram\b/i.test(s)) return s;
    
    // Check for ER-style patterns (entity relationships, cardinality markers)
    const hasErMarkers = /(one|many|zero|one-or-many|zero-or-one|one-to-many|many-to-many|zero-to-many)/i.test(s) ||
                         /(\|\||o\{|\{o|o\||\|o)/.test(s) ||
                         /entity|relationship|cardinality/i.test(s);
    
    if (hasErMarkers && !/^(flowchart|graph|sequenceDiagram|classDiagram)/i.test(s)) {
      // Convert to erDiagram format
      if (!s.startsWith('erDiagram')) {
        s = 'erDiagram\n' + s;
      }
    }
    
    return s;
  }

  // Check if code is ER diagram
  function isErDiagramCode(src) {
    return /^erDiagram\b/.test(crowFootToErDiagram(src).trim());
  }

  // Remove code fences/BOM and HTML wrappers
  function stripMermaidFences(s) {
    if (!s) return '';
    let t = s.replace(/^[\uFEFF\u200B\u200C\u200D]+/, '');
    // Remove ```mermaid ... ``` or generic ``` blocks (start/end on own lines)
    t = t.replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/i, '');
    // Remove duplicated fences if present within
    t = t.replace(/^```[\s\S]*?\n/, (m) => m.replace(/^```.*?\n/, ''));
    t = t.replace(/\n```\s*$/, '');
    // Remove <pre><code> wrappers
    t = t.replace(/<pre[^>]*><code[^>]*>/gi, '').replace(/<\/code><\/pre>/gi, '');
    return t.trim();
  }

  function containsSubgraph(s) {
    return /(^|\n)\s*subgraph\b/.test(s);
  }

  // Fix common Mermaid edge syntax errors
  function fixCommonMermaidEdgeSyntax(code) {
    if (!code) return code;
    let fixed = String(code);
    
    // Fix incomplete arrows
    fixed = fixed.replace(/-->\s*$/gm, '');
    
    // Fix malformed arrows (double arrows)
    fixed = fixed.replace(/-->\s*-->/g, '-->');
    
    // Fix arrows with semicolons
    fixed = fixed.replace(/--([^>]*);([^>]*)-->/g, '--$1$2-->');
    
    // Fix multiple arrows on same line
    fixed = fixed.replace(/(--[^>]*-->)\s*([A-Za-z][^;]*-->)/g, '$1\n    $2');
    
    return fixed;
  }

  // Add connection numbers to show workflow steps
  function addConnectionNumbers(code) {
    if (!code) return code;
    let fixed = String(code);
    
    // Only add numbers to flowchart/graph diagrams, not erDiagram
    if (/^erDiagram\b/i.test(fixed)) return fixed;
    
    // Find all connection lines
    const connectionPattern = /(\s+)([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)/g;
    let counter = 1;
    fixed = fixed.replace(connectionPattern, (match, indent, from, to) => {
      const numbered = `${indent}${from} -->|${counter++}| ${to}`;
      return numbered;
    });
    
    return fixed;
  }

  // Clean SVG content to remove problematic attributes
  function cleanSvgContent(svg) {
    if (!svg) return svg;
    let cleaned = String(svg);
    
    // Remove aria-roledescription and other problematic attributes
    cleaned = cleaned.replace(/\s+aria-roledescription="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s+role="[^"]*"/gi, '');
    
    return cleaned;
  }

  // PROACTIVE APPROACH: Comprehensive Mermaid syntax validation and correction
  function validateAndFixMermaidSyntax(mermaidCode) {
    const errors = [];
    let fixed = String(mermaidCode || '').trim();

    // EARLY: Strip fences and normalize
    fixed = stripMermaidFences(fixed);

    // EARLY: If it's ER-style content, force erDiagram directive
    const maybeEr = crowFootToErDiagram(fixed);
    if (maybeEr !== fixed) {
      fixed = maybeEr;
    }

    // ER-specific fast path: skip flowchart/class validations
    if (fixed.startsWith('erDiagram')) {
      // Normalize line endings and trim trailing spaces
      fixed = fixed.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '');
      // Ensure consistent two-space indentation inside entity blocks
      fixed = fixed.replace(/(^|\n)([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g, (_m, lead, entity, inner) => {
        const lines = (inner || '').split(/\n/)
          .map(l => l.trim())
          .filter(l => !!l);
        const body = lines.map(l => `  ${l}`).join('\n');
        return `${lead}${entity} {\n${body}\n}`;
      });
      return { isValid: true, fixedCode: fixed, errors: [] };
    }
    
    // Validation 1: Check for diagram type declaration
    if (!fixed.startsWith('flowchart') && !fixed.startsWith('graph') && !fixed.startsWith('sequenceDiagram') && !fixed.startsWith('classDiagram') && !fixed.startsWith('erDiagram')) {
      if (fixed.includes('-->') || fixed.includes('--') || fixed.includes('subgraph')) {
        errors.push('Missing diagram type declaration');
        // Prefer erDiagram if ER markers exist
        if (/^erDiagram\b/.test(maybeEr)) {
          fixed = maybeEr;
        } else {
          fixed = 'flowchart TD\n' + fixed;
        }
      }
    }
    
    // Validation 2: Check for incomplete arrows
    const incompleteArrows = fixed.match(/-->\s*$/gm) || [];
    if (incompleteArrows.length > 0) {
      errors.push(`Found ${incompleteArrows.length} incomplete arrows`);
      fixed = fixed.replace(/-->\s*$/gm, '');
    }
    
    // Validation 3: Check for malformed arrows
    const malformedArrows = fixed.match(/-->\s*-->/g) || [];
    if (malformedArrows.length > 0) {
      errors.push(`Found ${malformedArrows.length} malformed arrows`);
      fixed = fixed.replace(/-->\s*-->/g, '-->');
    }
    
    // Validation 4: Check for proper subgraph syntax
    const subgraphErrors = fixed.match(/subgraph\s+(\w+)\s*\[/g) || [];
    if (subgraphErrors.length > 0) {
      errors.push(`Found ${subgraphErrors.length} malformed subgraph declarations`);
      fixed = fixed.replace(/subgraph\s+(\w+)\s*\[/g, 'subgraph $1[');
    }
    
    // Validation 5: Check for classDef placement
    const classDefLines = fixed.split('\n').filter(line => line.trim().startsWith('classDef'));
    const nonClassDefLines = fixed.split('\n').filter(line => !line.trim().startsWith('classDef'));
    
    if (classDefLines.length > 0) {
      // Check if classDef is at the end
      const lastNonEmptyLine = nonClassDefLines.filter(line => line.trim()).pop();
      const firstClassDefLine = classDefLines[0];
      if (lastNonEmptyLine && firstClassDefLine && fixed.indexOf(firstClassDefLine) < fixed.indexOf(lastNonEmptyLine)) {
        errors.push('classDef statements should be at the end');
        fixed = nonClassDefLines.join('\n') + '\n' + classDefLines.join('\n');
      }
    }
    
    // Validation 6: Check for class applications
    const classLines = fixed.split('\n').filter(line => line.trim().includes(':::'));
    const nonClassLines = fixed.split('\n').filter(line => !line.trim().includes(':::'));
    
    if (classLines.length > 0) {
      // Check if class applications are after classDef
      const classDefIndex = fixed.indexOf('classDef');
      const classIndex = fixed.indexOf(':::');
      if (classDefIndex !== -1 && classIndex !== -1 && classIndex < classDefIndex) {
        errors.push('Class applications should be after classDef statements');
        fixed = nonClassLines.join('\n') + '\n' + classLines.join('\n');
      }
    }
    
    // Validation 7: Check for empty lines and normalize
    const emptyLines = fixed.split('\n').filter(line => !line.trim());
    if (emptyLines.length > 0) {
      errors.push(`Found ${emptyLines.length} empty lines`);
      fixed = fixed.split('\n').filter(line => line.trim()).join('\n');
    }
    
    // Validation 8: Fix inline comments (Mermaid doesn't support inline comments with %)
    const commentErrors = fixed.match(/\s+%\s+[^\n]*/g) || [];
    if (commentErrors.length > 0) {
      errors.push(`Found ${commentErrors.length} inline comments that need to be on separate lines`);
      // Move inline comments to separate lines
      fixed = fixed.replace(/\s+%\s+([^\n]*)/g, (match, comment) => {
        return '\n  %% ' + comment.trim();
      });
    }
    
    // Validation 9: Fix classDef formatting issues
    const classDefFormatLines = fixed.split('\n').filter(line => line.trim().startsWith('classDef'));
    classDefFormatLines.forEach((line, index) => {
      // Check for missing spaces or formatting issues in classDef
      if (!line.includes('fill:') || !line.includes('stroke:')) {
        errors.push(`classDef line ${index + 1} might have formatting issues`);
      }
    });
    
    // Validation 10: Ensure proper line breaks between classDef statements
    const classDefSection = fixed.split('\n').filter(line => line.trim().startsWith('classDef'));
    if (classDefSection.length > 1) {
      // Check if classDef statements are properly separated
      const classDefText = classDefSection.join('\n');
      if (!classDefText.includes('\nclassDef')) {
        errors.push('classDef statements should be on separate lines');
        fixed = fixed.replace(/classDef/g, '\nclassDef').replace(/^\n/, '');
      }
    }
    
    // Validation 11: Fix semicolons in arrow connections (invalid Mermaid syntax)
    const semicolonErrors = fixed.match(/--[^>]*;[^>]*-->/g) || [];
    if (semicolonErrors.length > 0) {
      errors.push(`Found ${semicolonErrors.length} semicolons in arrow connections`);
      // Remove semicolons from arrow connections
      fixed = fixed.replace(/--([^>]*);([^>]*)-->/g, '--$1$2-->');
    }
    
    // Validation 12: Fix multiple arrows on same line
    const multipleArrowErrors = fixed.match(/--[^>]*-->\s*[A-Za-z][^;]*-->/g) || [];
    if (multipleArrowErrors.length > 0) {
      errors.push(`Found ${multipleArrowErrors.length} multiple arrows on same line`);
      // Split multiple arrows into separate lines
      fixed = fixed.replace(/(--[^>]*-->)\s*([A-Za-z][^;]*-->)/g, '$1\n    $2');
    }
    
    // Validation 13: Check for proper indentation
    const lines = fixed.split('\n');
    let indentationErrors = 0;
    const fixedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('subgraph')) {
        if (!line.startsWith('  ')) indentationErrors++;
        return '  ' + trimmed;
      } else if (trimmed.startsWith('end')) {
        if (!line.startsWith('  ')) indentationErrors++;
        return '  ' + trimmed;
      } else if (trimmed.includes('-->') || trimmed.includes('--')) {
        if (!line.startsWith('    ')) indentationErrors++;
        return '    ' + trimmed;
      } else if (trimmed.startsWith('classDef')) {
        return trimmed;
      } else if (trimmed.includes(':::')) {
        return trimmed;
      } else if (trimmed.startsWith('%%')) {
        // Comments should be on their own lines
        return '  ' + trimmed;
      }
      return trimmed;
    });
    
    if (indentationErrors > 0) {
      errors.push(`Found ${indentationErrors} indentation issues`);
    }
    
    fixed = fixedLines.join('\n');
    
    const isValid = errors.length === 0;
    
    if (!isValid) {
      console.warn('Mermaid syntax validation failed:', errors);
      console.log('Fixed syntax:', fixed.substring(0, 200) + '...');
    } else {
      console.log('Mermaid syntax validation passed');
    }
    
    return { isValid, fixedCode: fixed, errors };
  }

  // Enhanced sanitize function that uses validation
  function sanitizeMermaid(raw) {
    let s = String(raw || '').trim();
    
    // Strip code fences first
    s = stripMermaidFences(s);
    
    // Apply comprehensive validation and fixing
    const validation = validateAndFixMermaidSyntax(s);
    s = validation.fixedCode;
    
    // Additional legacy fixes for compatibility
    s = s.replace(/\s+subgraph/g, '\nsubgraph')
         .replace(/end\s+subgraph/gi, 'end\nsubgraph')
         .replace(/\s*-->/g, ' --> ')
         .replace(/\s*==>/g, ' ==> ')
         .replace(/\s*-\.->/g, ' -.-> ');

    // LLM artifact: "Node->" or "node ->" between definitions
    s = s.replace(/\bnode\s*->/gi, ' --> ');

    // Clean up accidental "Label]Label[" merges
    s = s.replace(/(\]\s*)([A-Za-z0-9_]+\[)/g, '$1\n$2');
    
    // Fix graph TD formatting
    s = s.replace(/^\s*graph\s+TD/gi, 'flowchart TD');
    
    // Fix node ID conflicts with subgraph IDs
    const subgraphIds = Array.from(s.matchAll(/\bsubgraph\s+([A-Za-z0-9_]+)/gi)).map(m => m[1]);
    subgraphIds.forEach(id => {
      const re = new RegExp(`(^|\\n)${id}\\[`, 'g');
      s = s.replace(re, `$1${id}Node[`);
    });
    
    return s;
  }

  function isLikelyMermaid(code) {
    if (!code) return false;
    const c = String(code).trim().toLowerCase();
    return c.startsWith('graph ') || c.startsWith('flowchart ') || c.startsWith('erdiagram');
  }

  const sanitizedMermaid = useMemo(
    () => sanitizeMermaid(solution?.architecture_diagram || ''),
    [solution?.architecture_diagram]
  );
  const hasMermaidCode = useMemo(
    () => Boolean(sanitizedMermaid && isLikelyMermaid(sanitizedMermaid)),
    [sanitizedMermaid]
  );
  // Get validated and fixed Mermaid code
  const validatedMermaid = useMemo(() => {
    if (!sanitizedMermaid) return '';
    let code = sanitizedMermaid;
    
    // Apply all fixes in sequence
    code = fixCommonMermaidEdgeSyntax(code);
    code = addConnectionNumbers(code);
    
    // Final validation pass
    const validation = validateAndFixMermaidSyntax(code);
    return validation.fixedCode;
  }, [sanitizedMermaid]);

  const mermaidImageUrl = useMemo(() => {
    if (!hasMermaidCode) return null;
    try {
      const codeToEncode = validatedMermaid || sanitizedMermaid;
      if (typeof window !== 'undefined' && window.btoa) {
        const encoded = window.btoa(unescape(encodeURIComponent(codeToEncode)));
        return `https://mermaid.ink/svg/${encoded}`;
      }
      // Fallback if running without window (rare in CRA)
      // eslint-disable-next-line no-undef
      const encoded = Buffer.from(codeToEncode, 'utf-8').toString('base64');
      return `https://mermaid.ink/svg/${encoded}`;
    } catch (err) {
      console.warn('Mermaid encode error:', err);
      return null;
    }
  }, [validatedMermaid, sanitizedMermaid, hasMermaidCode]);

  // Render Mermaid diagram
  useEffect(() => {
    if (!solution || editable) return;
    
    const code = validatedMermaid || sanitizedMermaid;
    if (!isLikelyMermaid(code)) return;
    
    let renderCode = code;
    
    // Apply all validation and fixes
    const validation = validateAndFixMermaidSyntax(renderCode);
    renderCode = validation.fixedCode;
    
    // Fix edge syntax
    renderCode = fixCommonMermaidEdgeSyntax(renderCode);
    
    // Balance subgraphs
    if (!hasBalancedSubgraphs(renderCode)) {
      renderCode = fixUnbalancedSubgraphs(renderCode);
    }
    
    const now = Date.now();
    if (now - lastRenderRef.current < 1500) return;
    lastRenderRef.current = now;
    
    const el = mermaidContainerRef.current;
    if (!el) return;
    
    const renderDiagram = () => {
      const mermaid = window.mermaid;
      if (!mermaid || !mermaid.mermaidAPI) {
        return false;
      }
      try {
        const renderId = `mermaid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        el.innerHTML = '';
        mermaid.mermaidAPI.render(
          renderId,
          renderCode,
          (svgCode) => {
            // Clean SVG content before setting
            const cleanedSvg = cleanSvgContent(svgCode);
            el.innerHTML = cleanedSvg;
            el.setAttribute('data-mermaid-processed', 'true');
          },
          el
        );
        // If render produced empty output, fallback
        if (!el.innerHTML || el.innerHTML.trim().length < 10) {
          throw new Error('Empty SVG output');
        }
      } catch (e) {
        console.error('Mermaid render error:', e);
        console.error('Failed code:', renderCode.substring(0, 500));
        // Try one more time with just the validation fixes
        try {
          const fallbackValidation = validateAndFixMermaidSyntax(renderCode);
          const fallbackCode = fallbackValidation.fixedCode;
          mermaid.mermaidAPI.render(
            `mermaid-fallback-${Date.now()}`,
            fallbackCode,
            (svgCode) => {
              const cleanedSvg = cleanSvgContent(svgCode);
              el.innerHTML = cleanedSvg;
              el.setAttribute('data-mermaid-processed', 'true');
            },
            el
          );
        } catch (fallbackError) {
          console.error('Fallback render also failed:', fallbackError);
          el.innerHTML = `<pre style="white-space: pre-wrap; font-size: 12px; color: red;">Mermaid Syntax Error:\n${e.message}\n\nCode:\n${renderCode}</pre>`;
        }
      }
      return true;
    };

    el.removeAttribute('data-mermaid-processed');
    el.innerHTML = '';
    
    if (!window.mermaid) {
      const checkMermaid = setInterval(() => {
        if (window.mermaid && window.mermaid.mermaidAPI) {
          window.mermaid.initialize?.({ startOnLoad: false, securityLevel: 'loose' });
          window.mermaid.mermaidAPI.initialize?.({ startOnLoad: false, securityLevel: 'loose' });
          renderDiagram();
          clearInterval(checkMermaid);
        }
      }, 150);
      return () => clearInterval(checkMermaid);
    }
    
    window.mermaid.initialize?.({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });
    window.mermaid.mermaidAPI?.initialize?.({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });
    const ok = renderDiagram();
    // Retry once shortly after mount to handle late layout
    if (!ok) {
      setTimeout(() => {
        try { renderDiagram(); } catch {}
      }, 250);
    }
  }, [solution, editable, validatedMermaid, sanitizedMermaid]);

  // Expose scroll method to parent (App.js)
  useImperativeHandle(ref, () => ({
    scrollToSection: (sectionId) => {
      const section = sectionRefs[sectionId];
      if (section && section.current) {
        section.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        section.current.classList.add('bg-yellow-100');
        setTimeout(() => {
          section.current.classList.remove('bg-yellow-100');
        }, 1500);
      }
    },
  }));

  if (!solution) {
    return (
      <div className="text-center py-12">
        <FileText className="h-24 w-24 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Solution Generated Yet</h3>
        <p className="text-gray-500">Upload an RFP document and click "Generate Solution" to see the preview here.</p>
      </div>
    );
  }

  const updateField = (field, value) => {
    const updated = { ...solution, [field]: value };
    onChange?.(updated);
  };

  const updateListItem = (field, index, value) => {
    const list = [...(solution[field] || [])];
    list[index] = value;
    updateField(field, list);
  };

  const addListItem = (field, emptyValue) => {
    const list = [...(solution[field] || [])];
    list.push(emptyValue);
    updateField(field, list);
  };

  const removeListItem = (field, index) => {
    const list = [...(solution[field] || [])];
    list.splice(index, 1);
    updateField(field, list);
  };

  const updateApproachItem = (index, patch) => {
    const arr = [...(solution.solution_approach || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('solution_approach', arr);
  };

  const addApproachItem = () => {
    addListItem('solution_approach', { title: 'New Step', description: '' });
  };

  const removeApproachItem = (index) => {
    const arr = [...(solution.solution_approach || [])];
    arr.splice(index, 1);
    updateField('solution_approach', arr);
  };

  const updateMilestone = (index, patch) => {
    const arr = [...(solution.milestones || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('milestones', arr);
  };

  const addMilestone = () => {
    addListItem('milestones', { phase: 'New Phase', duration: '1 week', description: '' });
  };

  const removeMilestone = (index) => {
    const arr = [...(solution.milestones || [])];
    arr.splice(index, 1);
    updateField('milestones', arr);
  };

  // New: Resources helpers
  const updateResource = (index, patch) => {
    const arr = [...(solution.resources || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('resources', arr);
  };
  const addResource = () => addListItem('resources', { role: 'New Role', count: 1, years_of_experience: 3, responsibilities: '' });
  const removeResource = (index) => {
    const arr = [...(solution.resources || [])];
    arr.splice(index, 1);
    updateField('resources', arr);
  };

  // New: Cost Analysis helpers
  const updateCost = (index, patch) => {
    const arr = [...(solution.cost_analysis || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('cost_analysis', arr);
  };
  const addCost = () => addListItem('cost_analysis', { item: 'New Item', cost: '₹0', notes: '' });
  const removeCost = (index) => {
    const arr = [...(solution.cost_analysis || [])];
    arr.splice(index, 1);
    updateField('cost_analysis', arr);
  };

  // KPI helpers
  const updateKPI = (index, patch) => {
    const arr = [...(solution.key_performance_indicators || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('key_performance_indicators', arr);
  };
  const addKPI = () => addListItem('key_performance_indicators', { 
    metric: 'New KPI', 
    target: 'Target Value', 
    measurement_method: 'Measurement Method',
    frequency: 'Monthly'
  });
  const removeKPI = (index) => {
    const arr = [...(solution.key_performance_indicators || [])];
    arr.splice(index, 1);
    updateField('key_performance_indicators', arr);
  };

  return (
    <div className="space-y-6">
      <div className="border border-dashed border-gray-300 rounded-lg p-6">
        <div className="flex flex-col items-center text-center">
          <img src="/api/logo" alt="Company Logo" className="h-20 w-auto mb-4" />
          {editable ? (
            <input
              className="text-2xl font-bold text-center text-gray-900 mb-2 border-b border-gray-200 focus:outline-none focus:ring-0"
              value={solution.title}
              onChange={e => updateField('title', e.target.value)}
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{solution.title}</h1>
          )}
          {editable ? (
            <input
              className="text-gray-600 text-center border-b border-gray-200 focus:outline-none focus:ring-0"
              value={solution.date}
              onChange={e => updateField('date', e.target.value)}
            />
          ) : (
            <p className="text-gray-600">{solution.date}</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 my-4"></div>

      <Section title="Problem Statement" innerRef={sectionRefs['problem-statement']}>
        {editable ? (
          <textarea
            className="w-full bg-blue-50 p-4 rounded-lg text-gray-700 border border-blue-100 focus:outline-none focus:ring"
            rows={4}
            value={solution.problem_statement}
            onChange={e => updateField('problem_statement', e.target.value)}
          />
        ) : (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-gray-700">{solution.problem_statement}</p>
          </div>
        )}
      </Section>

      {solution.key_challenges?.length > 0 && (
        <Section title="Key Challenges" innerRef={sectionRefs['key-challenges']}>
          {editable ? (
            <div className="space-y-2">
              {solution.key_challenges.map((challenge, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    value={challenge}
                    onChange={e => updateListItem('key_challenges', idx, e.target.value)}
                  />
                  <button onClick={() => removeListItem('key_challenges', idx)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('key_challenges', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add challenge
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {solution.key_challenges.map((challenge, idx) => (
                <div key={idx} className="flex items-start">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <p className="text-gray-700">{challenge}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {solution.solution_approach?.length > 0 && (
        <Section title="Our Solution Approach">
          {editable ? (
            <div className="space-y-4">
              {solution.solution_approach.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 font-semibold text-gray-900 mb-2 border-b focus:outline-none"
                      value={step.title}
                      onChange={e => updateApproachItem(index, { title: e.target.value })}
                    />
                    <button onClick={() => removeApproachItem(index)} className="p-2 text-red-600 hover:bg-red-50 rounded self-start">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    className="w-full text-gray-700 border rounded px-3 py-2"
                    rows={3}
                    value={step.description}
                    onChange={e => updateApproachItem(index, { description: e.target.value })}
                  />
                </div>
              ))}
              <button onClick={addApproachItem} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add step
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {solution.solution_approach.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{step.title}</h4>
                  <p className="text-gray-700">{step.description}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {solution.architecture_diagram && (
        <Section title="Architecture Diagram" innerRef={sectionRefs['architecture-diagram']}>
          <div className="border border-gray-200 rounded-lg p-4">
            {editable ? (
              <textarea
                className="w-full text-gray-700 border rounded px-3 py-2"
                rows={5}
                value={solution.architecture_diagram}
                onChange={e => updateField('architecture_diagram', e.target.value)}
              />
            ) : (
              <>
                {hasMermaidCode && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowMermaidCode((v) => !v)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      {showMermaidCode ? 'Hide Code' : 'Code'}
                    </button>
                  </div>
                )}
                <div className="border border-dashed border-gray-200 rounded-md bg-white"
                     style={{ maxHeight: '80vh', overflowX: 'auto', overflowY: 'auto' }}>
                  {mermaidImageUrl && !mermaidImgError ? (
                    <img
                      src={mermaidImageUrl}
                      alt="Architecture Diagram"
                      style={{ display: 'block', width: '1600px', height: 'auto' }}
                      onError={() => setMermaidImgError(true)}
                    />
                  ) : solution.architecture_diagram_image ? (
                <img 
                  src={solution.architecture_diagram_image} 
                  alt="Architecture Diagram" 
                      style={{ display: 'block', width: '1600px', height: 'auto' }}
                />
              ) : (
                <div 
                  ref={mermaidContainerRef} 
                      className="mermaid p-4" 
                      style={{ minHeight: 400, minWidth: 1200 }}
                    />
                  )}
                </div>
                {showMermaidCode && hasMermaidCode && (
                  <pre className="mt-3 bg-gray-900 text-gray-100 text-xs rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                    {validatedMermaid || sanitizedMermaid}
                  </pre>
                )}
              </>
            )}
          </div>
        </Section>
      )}

      {solution.milestones?.length > 0 && (
        <Section title="Key Milestones">
          {editable ? (
            <div className="space-y-3">
              {solution.milestones.map((m, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input className="md:col-span-4 border rounded px-3 py-2 text-sm" value={m.phase} onChange={e => updateMilestone(idx, { phase: e.target.value })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" value={m.duration} onChange={e => updateMilestone(idx, { duration: e.target.value })} />
                  <textarea className="md:col-span-5 border rounded px-3 py-2 text-sm" rows={2} value={m.description} onChange={e => updateMilestone(idx, { description: e.target.value })} />
                  <button onClick={() => removeMilestone(idx)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded justify-self-start md:justify-self-auto">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addMilestone} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add milestone
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Phase</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Duration</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.milestones.map((m, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{m.phase}</td>
                      <td className="px-4 py-2 border-b align-top">{m.duration}</td>
                      <td className="px-4 py-2 border-b align-top">{m.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {solution.technical_stack?.length > 0 && (
        <Section title="Technology Stack">
          {editable ? (
            <div className="space-y-2">
              {solution.technical_stack.map((tech, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 border rounded px-3 py-2 text-sm" value={tech} onChange={e => updateListItem('technical_stack', i, e.target.value)} />
                  <button onClick={() => removeListItem('technical_stack', i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('technical_stack', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add technology
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {solution.technical_stack.map((tech, index) => (
                <div key={index} className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-center text-sm font-medium">
                  {tech}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {solution.objectives?.length > 0 && (
        <Section title="Objectives" innerRef={sectionRefs['objectives']}>
          {editable ? (
            <div className="space-y-2">
              {solution.objectives.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 border rounded px-3 py-2 text-sm" value={o} onChange={e => updateListItem('objectives', i, e.target.value)} />
                  <button onClick={() => removeListItem('objectives', i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('objectives', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add objective
              </button>
            </div>
          ) : (
            <ul className="list-disc pl-6 text-gray-700">
              {solution.objectives.map((o, i) => <li key={i} className="mb-1">{o}</li>)}
            </ul>
          )}
        </Section>
      )}

      {solution.acceptance_criteria?.length > 0 && (
        <Section title="Acceptance Criteria">
          {editable ? (
            <div className="space-y-2">
              {solution.acceptance_criteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 border rounded px-3 py-2 text-sm" value={c} onChange={e => updateListItem('acceptance_criteria', i, e.target.value)} />
                  <button onClick={() => removeListItem('acceptance_criteria', i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('acceptance_criteria', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add criteria
              </button>
            </div>
          ) : (
            <ul className="list-disc pl-6 text-gray-700">
              {solution.acceptance_criteria.map((c, i) => <li key={i} className="mb-1">{c}</li>)}
            </ul>
          )}
        </Section>
      )}

      {solution.resources?.length > 0 && (
        <Section title="Resources" innerRef={sectionRefs['resources']}>
          {editable ? (
            <div className="space-y-3">
              {solution.resources.map((r, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input className="md:col-span-3 border rounded px-3 py-2 text-sm" value={r.role} onChange={e => updateResource(i, { role: e.target.value })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" type="number" min={0} value={r.count} onChange={e => updateResource(i, { count: Number(e.target.value) })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" type="number" min={0} value={r.years_of_experience || 0} onChange={e => updateResource(i, { years_of_experience: Number(e.target.value) })} />
                  <textarea className="md:col-span-4 border rounded px-3 py-2 text-sm" rows={2} value={r.responsibilities || ''} onChange={e => updateResource(i, { responsibilities: e.target.value })} />
                  <button onClick={() => removeResource(i)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addResource} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add resource
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Role</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Count</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Years of Experience</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Responsibilities</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.resources.map((r, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{r.role}</td>
                      <td className="px-4 py-2 border-b align-top">{r.count}</td>
                      <td className="px-4 py-2 border-b align-top">{r.years_of_experience}</td>
                      <td className="px-4 py-2 border-b align-top">{r.responsibilities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {solution.cost_analysis?.length > 0 && (
        <Section title="Cost Analysis" innerRef={sectionRefs['cost-analysis']}>
          {editable ? (
            <div className="space-y-3">
              {solution.cost_analysis.map((c, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input className="md:col-span-5 border rounded px-3 py-2 text-sm" value={c.item} onChange={e => updateCost(i, { item: e.target.value })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" value={c.cost} onChange={e => updateCost(i, { cost: e.target.value })} />
                  <textarea className="md:col-span-4 border rounded px-3 py-2 text-sm" rows={2} value={c.notes || ''} onChange={e => updateCost(i, { notes: e.target.value })} />
                  <button onClick={() => removeCost(i)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addCost} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add cost item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Item</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Cost (INR)</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.cost_analysis.map((c, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{c.item}</td>
                      <td className="px-4 py-2 border-b align-top">{c.cost}</td>
                      <td className="px-4 py-2 border-b align-top">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Key Performance Indicators */}
      {solution.key_performance_indicators?.length > 0 && (
        <Section title="Key Performance Indicators" innerRef={sectionRefs['key-performance-indicators']}>
          {editable ? (
            <div className="space-y-3">
              {solution.key_performance_indicators.map((kpi, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input 
                    className="md:col-span-3 border rounded px-3 py-2 text-sm" 
                    value={kpi.metric} 
                    onChange={e => updateKPI(i, { metric: e.target.value })} 
                    placeholder="Metric"
                  />
                  <input 
                    className="md:col-span-2 border rounded px-3 py-2 text-sm" 
                    value={kpi.target} 
                    onChange={e => updateKPI(i, { target: e.target.value })} 
                    placeholder="Target"
                  />
                  <input 
                    className="md:col-span-3 border rounded px-3 py-2 text-sm" 
                    value={kpi.measurement_method} 
                    onChange={e => updateKPI(i, { measurement_method: e.target.value })} 
                    placeholder="Measurement Method"
                  />
                  <input 
                    className="md:col-span-3 border rounded px-3 py-2 text-sm" 
                    value={kpi.frequency || ''} 
                    onChange={e => updateKPI(i, { frequency: e.target.value })} 
                    placeholder="Frequency"
                  />
                  <button onClick={() => removeKPI(i)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addKPI} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add KPI
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Metric</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Target</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Measurement Method</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.key_performance_indicators.map((kpi, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{kpi.metric}</td>
                      <td className="px-4 py-2 border-b align-top">{kpi.target}</td>
                      <td className="px-4 py-2 border-b align-top">{kpi.measurement_method}</td>
                      <td className="px-4 py-2 border-b align-top">{kpi.frequency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
});
export default PreviewCard;