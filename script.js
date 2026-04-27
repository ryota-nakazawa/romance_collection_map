const canvas = document.querySelector("#mapCanvas");
const svg = document.querySelector("#relationSvg");
const emptyState = document.querySelector("#emptyState");
const imageInput = document.querySelector("#imageInput");
const sampleButton = document.querySelector("#sampleButton");
const personList = document.querySelector("#personList");
const relationList = document.querySelector("#relationList");
const fromSelect = document.querySelector("#fromSelect");
const toSelect = document.querySelector("#toSelect");
const relationType = document.querySelector("#relationType");
const relationLabel = document.querySelector("#relationLabel");
const addRelationButton = document.querySelector("#addRelationButton");
const exportPngButton = document.querySelector("#exportPngButton");
const exportResult = document.querySelector("#exportResult");
const resetButton = document.querySelector("#resetButton");
const personCount = document.querySelector("#personCount");
const relationCount = document.querySelector("#relationCount");
const statusChip = document.querySelector("#statusChip");

const relationTypes = [
  { id: "love", label: "好き", color: "#ee4c8b" },
  { id: "interest", label: "気になる", color: "#ff705d" },
  { id: "unsure", label: "迷い中", color: "#f7b731" },
  { id: "rival", label: "ライバル", color: "#1aa6b7" },
  { id: "support", label: "応援", color: "#1f9d63" },
];

const samplePalette = ["#ee4c8b", "#005bac", "#ff705d", "#1aa6b7", "#f7b731", "#6f5bdc"];

let people = [];
let relations = [];
let dragState = null;
let latestExportUrl = null;
let latestExportBlob = null;
let latestExportDataUrl = null;

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function canvasRect() {
  return canvas.getBoundingClientRect();
}

function initialPosition(index) {
  const rect = canvasRect();
  const count = Math.max(people.length + 1, 6);
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const radiusX = Math.min(rect.width * 0.32, 300);
  const radiusY = Math.min(rect.height * 0.3, 220);
  return {
    x: rect.width / 2 + Math.cos(angle) * radiusX,
    y: rect.height / 2 + Math.sin(angle) * radiusY,
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sampleImage(name, color) {
  const svgText = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="#071b4d"/>
        </linearGradient>
      </defs>
      <rect width="220" height="220" fill="url(#g)"/>
      <circle cx="110" cy="88" r="44" fill="rgba(255,255,255,.88)"/>
      <path d="M38 206c12-48 44-74 72-74s60 26 72 74" fill="rgba(255,255,255,.86)"/>
      <text x="110" y="120" text-anchor="middle" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="${color}">${name.slice(0, 1)}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

function addPerson(name, image) {
  const position = initialPosition(people.length);
  people.push({
    id: uid("person"),
    name,
    image,
    x: position.x,
    y: position.y,
  });
  render();
}

async function handleFiles(files) {
  const list = Array.from(files).slice(0, 12 - people.length);
  const loaded = await Promise.all(list.map(fileToDataUrl));
  loaded.forEach((image, index) => addPerson(`出演者${people.length + index + 1}`, image));
  imageInput.value = "";
}

function addSamples() {
  const names = ["葵", "蓮", "美月", "湊", "陽菜", "陸"];
  names.forEach((name, index) => {
    if (people.length < 12) {
      addPerson(name, sampleImage(name, samplePalette[index % samplePalette.length]));
    }
  });
  const get = (name) => people.find((person) => person.name === name)?.id;
  relations = [
    { id: uid("rel"), from: get("葵"), to: get("蓮"), type: "love", label: "好き" },
    { id: uid("rel"), from: get("蓮"), to: get("美月"), type: "interest", label: "気になる" },
    { id: uid("rel"), from: get("美月"), to: get("湊"), type: "unsure", label: "迷い中" },
    { id: uid("rel"), from: get("湊"), to: get("陸"), type: "rival", label: "ライバル" },
  ].filter((relation) => relation.from && relation.to);
  render();
}

function removePerson(id) {
  people = people.filter((person) => person.id !== id);
  relations = relations.filter((relation) => relation.from !== id && relation.to !== id);
  render();
}

function removeRelation(id) {
  relations = relations.filter((relation) => relation.id !== id);
  render();
}

function updatePersonName(id, name) {
  const person = people.find((item) => item.id === id);
  if (person) person.name = name || "名前未設定";
  renderCanvas();
  renderSelects();
  renderRelations();
}

function renderPeopleList() {
  personList.innerHTML = "";
  people.forEach((person) => {
    const row = document.createElement("div");
    row.className = "person-row";
    row.innerHTML = `
      <img alt="" src="${person.image}" />
      <input type="text" value="${escapeAttribute(person.name)}" aria-label="${escapeAttribute(person.name)}の名前" />
      <button class="icon-button" type="button" aria-label="${escapeAttribute(person.name)}を削除">×</button>
    `;
    row.querySelector("input").addEventListener("input", (event) => {
      updatePersonName(person.id, event.target.value);
    });
    row.querySelector("button").addEventListener("click", () => removePerson(person.id));
    personList.append(row);
  });
}

function renderSelects() {
  [fromSelect, toSelect].forEach((select) => {
    const selected = select.value;
    select.innerHTML = people
      .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
      .join("");
    if (people.some((person) => person.id === selected)) select.value = selected;
  });

  relationType.innerHTML = relationTypes
    .map((type) => `<option value="${type.id}">${type.label}</option>`)
    .join("");
}

function renderRelations() {
  relationList.innerHTML = "";
  relations.forEach((relation) => {
    const from = people.find((person) => person.id === relation.from);
    const to = people.find((person) => person.id === relation.to);
    const type = relationTypes.find((item) => item.id === relation.type) || relationTypes[0];
    if (!from || !to) return;

    const row = document.createElement("div");
    row.className = "relation-row";
    row.innerHTML = `
      <span class="relation-color" style="background:${type.color}"></span>
      <span class="relation-copy">
        <strong>${escapeHtml(from.name)} → ${escapeHtml(to.name)}</strong>
        <span>${escapeHtml(relation.label || type.label)}</span>
      </span>
      <button class="icon-button" type="button" aria-label="関係を削除">×</button>
    `;
    row.querySelector("button").addEventListener("click", () => removeRelation(relation.id));
    relationList.append(row);
  });
}

function renderCanvas() {
  canvas.querySelectorAll(".person-card").forEach((element) => element.remove());
  people.forEach((person) => {
    const card = document.createElement("button");
    card.className = "person-card";
    card.type = "button";
    card.dataset.id = person.id;
    card.style.left = `${person.x}px`;
    card.style.top = `${person.y}px`;
    card.innerHTML = `
      <img class="person-photo" alt="" src="${person.image}" draggable="false" />
      <span class="person-name">${escapeHtml(person.name)}</span>
    `;
    card.addEventListener("pointerdown", startDrag);
    canvas.append(card);
  });
  renderRelationSvg();
}

function relationPath(from, to) {
  const geometry = relationGeometry(from, to);
  return { d: `M ${geometry.sx} ${geometry.sy} Q ${geometry.cx} ${geometry.cy} ${geometry.ex} ${geometry.ey}`, labelX: geometry.cx, labelY: geometry.cy };
}

function relationGeometry(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / distance) * 18;
  const offsetY = (dx / distance) * 18;
  const startRadius = 64;
  const endRadius = 66;
  const sx = from.x + (dx / distance) * startRadius + offsetX;
  const sy = from.y + (dy / distance) * startRadius + offsetY;
  const ex = to.x - (dx / distance) * endRadius + offsetX;
  const ey = to.y - (dy / distance) * endRadius + offsetY;
  const cx = (sx + ex) / 2 + offsetX * 2;
  const cy = (sy + ey) / 2 + offsetY * 2;
  return { sx, sy, ex, ey, cx, cy, dx, dy, distance };
}

function renderRelationSvg() {
  const rect = canvasRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML = `
    <defs>
      ${relationTypes
        .map(
          (type) => `
            <marker id="arrow-${type.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="${type.color}"></path>
            </marker>
          `,
        )
        .join("")}
    </defs>
  `;

  relations.forEach((relation) => {
    const from = people.find((person) => person.id === relation.from);
    const to = people.find((person) => person.id === relation.to);
    const type = relationTypes.find((item) => item.id === relation.type) || relationTypes[0];
    if (!from || !to || from.id === to.id) return;

    const path = relationPath(from, to);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", path.d);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", type.color);
    line.setAttribute("stroke-width", "5");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("marker-end", `url(#arrow-${type.id})`);
    svg.append(line);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", path.labelX);
    text.setAttribute("y", path.labelY - 8);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "relation-label");
    text.textContent = relation.label || type.label;
    svg.append(text);
  });
}

function startDrag(event) {
  const id = event.currentTarget.dataset.id;
  const person = people.find((item) => item.id === id);
  if (!person) return;
  const rect = canvasRect();
  dragState = {
    id,
    startX: event.clientX,
    startY: event.clientY,
    originalX: person.x,
    originalY: person.y,
    width: rect.width,
    height: rect.height,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!dragState) return;
  const person = people.find((item) => item.id === dragState.id);
  if (!person) return;
  person.x = clamp(dragState.originalX + event.clientX - dragState.startX, 72, dragState.width - 72);
  person.y = clamp(dragState.originalY + event.clientY - dragState.startY, 78, dragState.height - 78);
  const card = canvas.querySelector(`[data-id="${dragState.id}"]`);
  if (card) {
    card.style.left = `${person.x}px`;
    card.style.top = `${person.y}px`;
  }
  renderRelationSvg();
}

function stopDrag() {
  dragState = null;
}

function addRelation() {
  const from = fromSelect.value;
  const to = toSelect.value;
  if (!from || !to || from === to) {
    statusChip.textContent = "別々の人物を選んでください";
    return;
  }
  const type = relationTypes.find((item) => item.id === relationType.value) || relationTypes[0];
  relations.push({
    id: uid("rel"),
    from,
    to,
    type: type.id,
    label: relationLabel.value.trim() || type.label,
  });
  relationLabel.value = "";
  render();
}

function updateCounts() {
  personCount.textContent = `${people.length}人`;
  relationCount.textContent = `${relations.length}本`;
  emptyState.hidden = people.length > 0;
  statusChip.textContent =
    people.length === 0
      ? "画像を追加してください"
      : `${people.length}人 / ${relations.length}本の関係線`;
}

function render() {
  renderPeopleList();
  renderSelects();
  renderRelations();
  renderCanvas();
  updateCounts();
}

async function exportPng() {
  if (people.length === 0) {
    statusChip.textContent = "先に人物を追加してください";
    return;
  }
  exportPngButton.disabled = true;
  exportPngButton.textContent = "PNG生成中...";

  try {
    const exportCanvas = await drawExportCanvas();
    const dataUrl = exportCanvas.toDataURL("image/png");
    const blob = dataUrlToBlob(dataUrl);

    if (!blob.size) {
      throw new Error("Generated PNG is empty");
    }

    if (latestExportUrl) URL.revokeObjectURL(latestExportUrl);
    latestExportBlob = blob;
    latestExportDataUrl = dataUrl;
    latestExportUrl = URL.createObjectURL(blob);
    showExportResult();
    statusChip.textContent = `PNGを生成しました (${Math.round(blob.size / 1024)}KB)`;
  } catch (error) {
    console.error(error);
    statusChip.textContent = "PNG生成に失敗しました";
  } finally {
    exportPngButton.disabled = false;
    exportPngButton.textContent = "PNGを書き出す";
  }
}

async function drawExportCanvas() {
  const rect = canvasRect();
  const width = Math.max(640, Math.round(rect.width));
  const height = Math.max(480, Math.round(rect.height));
  const scale = 2;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width * scale;
  exportCanvas.height = height * scale;
  const context = exportCanvas.getContext("2d");
  context.scale(scale, scale);

  drawExportBackground(context, width, height);
  drawExportRelations(context);

  const imageEntries = await Promise.all(
    people.map(async (person) => ({
      person,
      image: await loadImage(person.image),
    })),
  );
  imageEntries.forEach(({ person, image }) => drawExportPerson(context, person, image));

  return exportCanvas;
}

function drawExportBackground(context, width, height) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#e8f1ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(238, 76, 139, 0.10)";
  context.beginPath();
  context.arc(width * 0.12, height * 0.12, width * 0.18, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(247, 183, 49, 0.14)";
  context.beginPath();
  context.arc(width * 0.88, height * 0.18, width * 0.16, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#071b4d";
  context.font = "800 26px Arial, sans-serif";
  context.textBaseline = "top";
  context.fillText("今日の恋模様", 34, 28);
}

function drawExportRelations(context) {
  relations.forEach((relation) => {
    const from = people.find((person) => person.id === relation.from);
    const to = people.find((person) => person.id === relation.to);
    const type = relationTypes.find((item) => item.id === relation.type) || relationTypes[0];
    if (!from || !to || from.id === to.id) return;

    const geometry = relationGeometry(from, to);
    context.save();
    context.strokeStyle = type.color;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(geometry.sx, geometry.sy);
    context.quadraticCurveTo(geometry.cx, geometry.cy, geometry.ex, geometry.ey);
    context.stroke();
    drawArrowHead(context, geometry, type.color);
    drawExportLabel(context, relation.label || type.label, geometry.cx, geometry.cy - 8);
    context.restore();
  });
}

function drawArrowHead(context, geometry, color) {
  const angle = Math.atan2(geometry.ey - geometry.cy, geometry.ex - geometry.cx);
  const size = 13;
  context.save();
  context.translate(geometry.ex, geometry.ey);
  context.rotate(angle);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-size, -size * 0.55);
  context.lineTo(-size, size * 0.55);
  context.closePath();
  context.fill();
  context.restore();
}

function drawExportLabel(context, label, x, y) {
  context.font = "800 15px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  context.strokeText(label, x, y);
  context.fillStyle = "#071b4d";
  context.fillText(label, x, y);
}

function drawExportPerson(context, person, image) {
  const photoX = person.x;
  const photoY = person.y - 10;
  context.save();
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(7, 27, 77, 0.22)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 12;
  context.beginPath();
  context.arc(photoX, photoY, 60, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  context.arc(photoX, photoY, 54, 0, Math.PI * 2);
  context.clip();
  drawImageCover(context, image, photoX - 54, photoY - 54, 108, 108);
  context.restore();

  drawRoundRect(context, person.x - 58, person.y + 52, 116, 30, 15);
  context.fillStyle = "#08266d";
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "800 14px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(person.name, person.x, person.y + 67, 104);
}

function drawImageCover(context, image, x, y, width, height) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawRoundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function showExportResult() {
  exportResult.hidden = false;
  exportResult.innerHTML = "";

  const preview = document.createElement("img");
  preview.alt = "書き出した相関図プレビュー";
  preview.src = latestExportDataUrl;

  const actions = document.createElement("div");
  actions.className = "export-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "生成したPNGを保存";
  saveButton.addEventListener("click", savePngFile);

  const openLink = document.createElement("a");
  openLink.href = latestExportDataUrl;
  openLink.target = "_blank";
  openLink.rel = "noopener";
  openLink.textContent = "画像を別タブで開く";

  const note = document.createElement("p");
  note.textContent =
    "保存ボタンが効かないブラウザでは、別タブで開いた画像を右クリックまたは長押しして保存してください。";

  actions.append(saveButton, openLink);
  exportResult.append(preview, actions, note);
}

async function savePngFile() {
  if (!latestExportBlob || !latestExportDataUrl) return;

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "romance-correlation-map.png",
        types: [
          {
            description: "PNG image",
            accept: { "image/png": [".png"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(await latestExportBlob.arrayBuffer());
      await writable.close();
      statusChip.textContent = "PNGを保存しました";
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  triggerDownload(latestExportDataUrl);
  window.open(latestExportDataUrl, "_blank", "noopener");
  statusChip.textContent = "別タブで開いた画像から保存してください";
}

function triggerDownload(url) {
  const link = document.createElement("a");
  link.download = "romance-correlation-map.png";
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
}

function resetAll() {
  people = [];
  relations = [];
  exportResult.hidden = true;
  exportResult.innerHTML = "";
  if (latestExportUrl) URL.revokeObjectURL(latestExportUrl);
  latestExportUrl = null;
  latestExportBlob = null;
  latestExportDataUrl = null;
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

imageInput.addEventListener("change", (event) => handleFiles(event.target.files));
sampleButton.addEventListener("click", addSamples);
addRelationButton.addEventListener("click", addRelation);
exportPngButton.addEventListener("click", exportPng);
resetButton.addEventListener("click", resetAll);
window.addEventListener("pointermove", moveDrag);
window.addEventListener("pointerup", stopDrag);
window.addEventListener("resize", renderRelationSvg);

render();
