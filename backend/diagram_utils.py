"""
Utilities for enhancing and processing Mermaid diagrams.
"""
import re
import requests
import traceback
from main import safe_print

def _sanitize_mermaid_code(raw: str) -> str:
    """Remove markdown fences and clean Mermaid code."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines:
            body = "\n".join(lines[1:])
            if body.rstrip().endswith("```"):
                body = body[:body.rfind("```")].rstrip()
            return body
    return text

def _fix_mermaid_syntax_errors(code: str) -> str:
    """Fix common Mermaid syntax errors to prevent rendering failures."""
    
    # Fix bidirectional arrows: A <--> B becomes A --> B and B --> A
    def fix_bidirectional_arrows(text):
        bidirectional_pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s*<-->\s*([A-Za-z0-9_]+)\s*$', re.MULTILINE)
        
        def replace_bidirectional(match):
            from_node = match.group(1)
            to_node = match.group(2)
            return f"  {from_node} --> {to_node}\n  {to_node} --> {from_node}"
        
        return bidirectional_pattern.sub(replace_bidirectional, text)
    
    # Fix edge labels: A -- Label --> B becomes A -->|Label| B
    def fix_edge_labels(text):
        edge_label_pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s*--\s*([^-\n]+?)\s*-->\s*([A-Za-z0-9_]+)\s*$', re.MULTILINE)
        
        def replace_edge_label(match):
            from_node = match.group(1).strip()
            label = match.group(2).strip()
            to_node = match.group(3).strip()
            return f"  {from_node} -->|{label}| {to_node}"
        
        return edge_label_pattern.sub(replace_edge_label, text)
    
    # Fix malformed edges
    def fix_malformed_edges(text):
        malformed_pattern = re.compile(r'^\s*([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)\s*--\s*([^-\n]+?)\s*-->\s*([A-Za-z0-9_]+)\s*$', re.MULTILINE)
        
        def replace_malformed(match):
            from_node = match.group(1).strip()
            middle_node = match.group(2).strip()
            label = match.group(3).strip()
            to_node = match.group(4).strip()
            return f"  {from_node} --> {middle_node}\n  {middle_node} -->|{label}| {to_node}"
        
        return malformed_pattern.sub(replace_malformed, text)
    
    fixed_code = code
    fixed_code = fix_bidirectional_arrows(fixed_code)
    fixed_code = fix_edge_labels(fixed_code)
    fixed_code = fix_malformed_edges(fixed_code)
    
    return fixed_code

def _add_modern_styling(code: str) -> str:
    """Add modern visual styling to Mermaid diagrams."""
    
    if "%%{init" in code:
        return code  # Already has styling
    
    init = """%%{init: {
  'theme': 'neutral',
  'themeVariables': {
    'fontSize':'12px', 
    'fontFamily':'Inter, system-ui, sans-serif',
    'lineColor':'#666', 
    'primaryColor':'#f8f9fa',
    'edgeLabelBackground':'#ffffff', 
    'padding':12
  },
  'flowchart': { 
    'htmlLabels': true, 
    'useMaxWidth': true,
    'nodeSpacing': 45, 
    'rankSpacing': 55,
    'diagramPadding': 12, 
    'wrap': true 
  }
}}%%
"""
    
    return init + code

def enhance_mermaid_diagram(raw_code: str) -> str:
    """
    Complete diagram enhancement pipeline.
    Call this function before rendering any Mermaid diagram.
    """
    safe_print("[DEBUG] Starting diagram enhancement pipeline")
    safe_print("[DEBUG] Raw code preview:", raw_code[:200])
    
    code = _sanitize_mermaid_code(raw_code)
    safe_print("[DEBUG] After sanitize:", code[:200])
    
    code = _fix_mermaid_syntax_errors(code)
    safe_print("[DEBUG] After syntax fixes:", code[:200])
    
    code = _add_modern_styling(code)
    safe_print("[DEBUG] After styling:", code[:200])
    
    if not code.strip():
        safe_print("[ERROR] Enhancement resulted in empty diagram code!")
    
    return code

def generate_diagram_image(diagram_code, output_path):
    """
    Generate an image from the diagram code using Kroki
    """
    try:
        # Clean and validate the diagram code
        if not diagram_code or not isinstance(diagram_code, str):
            raise ValueError("Invalid diagram code")

        diagram_code = diagram_code.strip()
        if not diagram_code:
            raise ValueError("Empty diagram code")

        # Define supported formats based on file extension
        output_format = "svg" if output_path.lower().endswith('.svg') else "png"
        
        # Make request to Kroki
        payload = {"diagram_source": diagram_code, "diagram_type": "mermaid"}
        url = f"https://kroki.io/mermaid/{output_format}"
        
        safe_print(f"[DEBUG] Sending request to {url}")
        safe_print(f"[DEBUG] Diagram code (first 100 chars): {diagram_code[:100]}...")
        
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30  # Add timeout
        )
        response.raise_for_status()

        content_length = len(response.content)
        safe_print(f"[DEBUG] Received response: {response.status_code}, Content-Length: {content_length}")

        if content_length == 0:
            raise ValueError("Empty response from Kroki API")

        with open(output_path, "wb") as f:
            f.write(response.content)
            safe_print(f"[DEBUG] Wrote {content_length} bytes to {output_path}")

        return True
    except requests.exceptions.Timeout:
        safe_print("[ERROR] Request to Kroki API timed out")
        return False
    except requests.exceptions.RequestException as e:
        safe_print(f"[ERROR] HTTP error occurred: {e}")
        if hasattr(e.response, 'text'):
            safe_print(f"[DEBUG] Response text: {e.response.text}")
        return False
    except Exception as e:
        safe_print(f"[ERROR] Error generating diagram: {e}")
        import traceback
        safe_print(f"[DEBUG] Error traceback: {traceback.format_exc()}")
        return False