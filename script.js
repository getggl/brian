// --- Globals ---
let nodes = [], textblocks = [], connections = [];
let selected = null, connectMode = false, disconnectMode = false, contextTarget = null;
let zoomLevel = 1, panX = 0, panY = 0;

const canvas = document.getElementById('canvas');
const svg = document.getElementById("connections");
const menu = document.getElementById('contextMenu');
const wrapper = document.getElementById('canvasWrapper');
const connectIndicator = document.getElementById('connectIndicator');

// --- Dragging ---
function makeDraggable(el) {
  let offsetX, offsetY;
  el.onmousedown = e => {
    if (e.button === 2) return;
    offsetX = e.offsetX; offsetY = e.offsetY;
    document.onmousemove = ev => {
      el.style.left = (ev.pageX - offsetX - panX) / zoomLevel + 'px';
      el.style.top = (ev.pageY - offsetY - panY) / zoomLevel + 'px';
      updateConnections();
    };
    document.onmouseup = () => document.onmousemove = null;
  };
}

// --- Bind Helpers ---
function bindNodeEvents(node) {
  makeDraggable(node);
  node.onclick = e => {
    e.stopPropagation();
    deselectAll();
    node.classList.add('selected');
    selected = node;

    if (connectMode && contextTarget && contextTarget !== node) {
      connectNodes(contextTarget, node);
      exitConnectMode();
      contextTarget = null;
      hideMenu();
    } else if (disconnectMode && contextTarget && contextTarget !== node) {
      disconnectNodes(contextTarget, node);
      disconnectMode = false; contextTarget = null; hideMenu();
    }
  };
  node.oncontextmenu = e => {
    e.preventDefault();
    contextTarget = node;
    showMenu(e.pageX, e.pageY);
  };
}

function bindTextBlockEvents(tb) {
  makeDraggable(tb);
  tb.onclick = e => {
    e.stopPropagation();
    deselectAll();
    tb.classList.add('selected');
    selected = tb;
  };
}

// --- Add Node ---
function addNode(x = 100, y = 100, text = "Node") {
  const node = document.createElement('div');
  node.className = 'node';
  node.contentEditable = true;
  node.textContent = text;
  node.style.left = x + 'px';
  node.style.top = y + 'px';

  // Persistent UUID
  node.dataset.id = crypto.randomUUID();

  canvas.appendChild(node);
  bindNodeEvents(node);
  nodes.push(node);
  return node;
}

// --- Add Text Block ---
function addTextBlock(x = 200, y = 200, text = "Text") {
  const tb = document.createElement('div');
  tb.className = 'textblock';
  tb.contentEditable = true;
  tb.textContent = text;
  tb.style.left = x + 'px';
  tb.style.top = y + 'px';
  canvas.appendChild(tb);
  bindTextBlockEvents(tb);
  textblocks.push(tb);
  return tb;
}

// --- Connect / Disconnect ---
function connectNodes(a, b) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("stroke", "#0ff");
  line.setAttribute("stroke-width", "2");

  // Store UUIDs
  line.dataset.a = a.dataset.id;
  line.dataset.b = b.dataset.id;

  svg.appendChild(line);
  connections.push({ line, a, b });
  updateConnections();
}

function disconnectNodes(a, b) {
  connections = connections.filter(c => {
    if ((c.a === a && c.b === b) || (c.a === b && c.b === a)) {
      svg.removeChild(c.line);
      return false;
    }
    return true;
  });
}

// --- Update Connections ---
function updateConnections() {
  connections.forEach(c => {
    const ax = parseFloat(c.a.style.left) + c.a.offsetWidth / 2;
    const ay = parseFloat(c.a.style.top) + c.a.offsetHeight / 2;
    const bx = parseFloat(c.b.style.left) + c.b.offsetWidth / 2;
    const by = parseFloat(c.b.style.top) + c.b.offsetHeight / 2;
    c.line.setAttribute('x1', ax);
    c.line.setAttribute('y1', ay);
    c.line.setAttribute('x2', bx);
    c.line.setAttribute('y2', by);
  });
}

// --- Delete Selected ---
function deleteSelected() {
  if (!selected) return;
  if (nodes.includes(selected)) {
    connections = connections.filter(c => {
      if (c.a === selected || c.b === selected) {
        svg.removeChild(c.line);
        return false;
      }
      return true;
    });
    nodes = nodes.filter(n => n !== selected);
  }
  if (textblocks.includes(selected)) {
    textblocks = textblocks.filter(t => t !== selected);
  }
  canvas.removeChild(selected);
  selected = null;
}

// --- Save Project as HTML ---
function saveProjectFile() {
  const liveCanvas = document.getElementById("canvas").cloneNode(true);
  liveCanvas.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
  const liveSvg = document.getElementById("connections");

  const projectHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Graph Project</title></head>
<body>
  <div id="canvasWrapper">
    ${liveCanvas.outerHTML.replace(/\s*class="([^"]*\s)?selected(\s[^"]*)?"/g, (m, p1, p2) => {
  const cleaned = [p1, p2].filter(Boolean).join(" ").trim();
  return cleaned ? ` class="${cleaned}"` : "";
})}

    ${liveSvg.outerHTML}
  </div>
</body>
</html>`;
  const blob = new Blob([projectHTML], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "graph-project.html";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Load Project ---
function loadGraph(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const doc = new DOMParser().parseFromString(text, "text/html");

    // restore canvas nodes
    const savedCanvas = doc.getElementById("canvas");
    canvas.innerHTML = savedCanvas.innerHTML;

    // restore svg lines
    const savedSvg = doc.getElementById("connections");
    const liveSvg = document.getElementById("connections");
    while (liveSvg.firstChild) liveSvg.removeChild(liveSvg.firstChild);
    [...savedSvg.children].forEach(child => liveSvg.appendChild(child));

    // rebuild arrays
    nodes = Array.from(canvas.getElementsByClassName("node"));
    textblocks = Array.from(canvas.getElementsByClassName("textblock"));
    connections = [];

    nodes.forEach(bindNodeEvents);
    textblocks.forEach(bindTextBlockEvents);

    // rebuild connections
    liveSvg.querySelectorAll("line").forEach(line => {
      const aId = line.dataset.a;
      const bId = line.dataset.b;
      const aNode = canvas.querySelector(`.node[data-id="${aId}"]`);
      const bNode = canvas.querySelector(`.node[data-id="${bId}"]`);
      if (aNode && bNode) {
        connections.push({ line, a: aNode, b: bNode });
      }
    });

    updateConnections();
  };

  reader.readAsText(file);
}

// --- Export Canvas (read-only HTML) ---
function exportCanvasFile() {
  const liveCanvas = document.getElementById("canvas").cloneNode(true);
  liveCanvas.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
  const liveSvg = document.getElementById("connections");

  const css = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join("\n");
      } catch (e) {
        return "";
      }
    })
    .join("\n");

  const exportHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Graph Export</title>
<style>${css}</style></head>
<body>
  <div id="canvasWrapper">
    ${liveCanvas.outerHTML}
    ${liveSvg.outerHTML}
  </div>
</body></html>`;

  const blob = new Blob([exportHTML], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "graph-export.html";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Utility ---
function deselectAll() {
  nodes.forEach(n => n.classList.remove('selected'));
  textblocks.forEach(t => t.classList.remove('selected'));
  selected = null;
}
// --- Context Menu Helpers ---
function showMenu(x, y) {
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'flex';

  if (contextTarget) {
    document.getElementById('colorPicker').value =
      rgbToHex(contextTarget.style.background || '#fffa65');
    document.getElementById('textColorPicker').value =
      rgbToHex(contextTarget.style.color || '#000');
  }
}

function hideMenu() { menu.style.display = 'none'; }

function startConnect() {
  connectMode = true; disconnectMode = false;
  connectIndicator.style.display = 'inline';
  hideMenu();
}

function exitConnectMode() {
  connectMode = false;
  connectIndicator.style.display = 'none';
}
connectIndicator.onclick = exitConnectMode;

function startDisconnect() {
  disconnectMode = true; connectMode = false;
  hideMenu();
}

function changeBgColor(color) { 
  if (contextTarget) { contextTarget.style.background = color; hideMenu(); } 
}
function changeTextColor(color) { 
  if (contextTarget) { contextTarget.style.color = color; hideMenu(); } 
}
function toggleShape() {
  if (contextTarget) {
    contextTarget.style.borderRadius =
      (contextTarget.style.borderRadius === '0px') ? '6px' : '0px';
    hideMenu();
  }
}

// --- Zoom Controls ---
function zoomIn() { zoomLevel *= 1.2; updateTransform(); }
function zoomOut() { zoomLevel /= 1.2; updateTransform(); }
function resetView() { zoomLevel = 1; panX = 0; panY = 0; updateTransform(); }

function updateTransform() {
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  updateConnections();
}

// --- Right-Click Drag to Pan ---
let isPanning = false, startX = 0, startY = 0;
wrapper.onmousedown = e => {
  if (e.button === 2) { isPanning = true; startX = e.pageX - panX; startY = e.pageY - panY; }
};
wrapper.onmousemove = e => {
  if (isPanning) { panX = e.pageX - startX; panY = e.pageY - startY; updateTransform(); }
};
wrapper.onmouseup = () => { isPanning = false; };

// --- Utility ---
function deselectAll() {
  nodes.forEach(n => n.classList.remove('selected'));
  textblocks.forEach(t => t.classList.remove('selected'));
  selected = null;
}

function rgbToHex(rgb) {
  if (!rgb) return '#000000';
  if (rgb.startsWith('#')) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m) return '#000000';
  return "#" + m.slice(0,3).map(n => {
    const hex = parseInt(n).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join('');
}

// --- Hide Menu & Deselect on Canvas Click ---
canvas.onclick = () => { hideMenu(); deselectAll(); };
