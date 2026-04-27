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
  return { d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, labelX: cx, labelY: cy };
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

function exportSvgMarkup() {
  const rect = canvasRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const background = `
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#e8f1ff"/>
      </linearGradient>
      ${people
        .map(
          (person) => `
            <clipPath id="clip-${person.id}">
              <circle cx="${person.x}" cy="${person.y - 10}" r="54"/>
            </clipPath>
          `,
        )
        .join("")}
      ${relationTypes
        .map(
          (type) => `
            <marker id="export-arrow-${type.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="${type.color}"></path>
            </marker>
          `,
        )
        .join("")}
    </defs>
    <rect width="100%" height="100%" rx="8" fill="url(#bg)"/>
    <circle cx="${width * 0.12}" cy="${height * 0.12}" r="${width * 0.18}" fill="rgba(238,76,139,.10)"/>
    <circle cx="${width * 0.88}" cy="${height * 0.18}" r="${width * 0.16}" fill="rgba(247,183,49,.14)"/>
    <text x="34" y="52" font-size="26" font-family="Arial, sans-serif" font-weight="800" fill="#071b4d">今日の恋模様</text>
  `;

  const relationMarkup = relations
    .map((relation) => {
      const from = people.find((person) => person.id === relation.from);
      const to = people.find((person) => person.id === relation.to);
      const type = relationTypes.find((item) => item.id === relation.type) || relationTypes[0];
      if (!from || !to || from.id === to.id) return "";
      const path = relationPath(from, to);
      return `
        <path d="${path.d}" fill="none" stroke="${type.color}" stroke-width="5" stroke-linecap="round" marker-end="url(#export-arrow-${type.id})"/>
        <text x="${path.labelX}" y="${path.labelY - 8}" text-anchor="middle" font-size="15" font-family="Arial, sans-serif" font-weight="800" fill="#071b4d" stroke="#fff" stroke-width="5" paint-order="stroke">${escapeHtml(relation.label || type.label)}</text>
      `;
    })
    .join("");

  const peopleMarkup = people
    .map(
      (person) => `
        <circle cx="${person.x}" cy="${person.y - 10}" r="60" fill="#fff"/>
        <image href="${person.image}" x="${person.x - 54}" y="${person.y - 64}" width="108" height="108" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${person.id})"/>
        <rect x="${person.x - 58}" y="${person.y + 52}" width="116" height="30" rx="15" fill="#08266d"/>
        <text x="${person.x}" y="${person.y + 72}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" font-weight="800" fill="#fff">${escapeHtml(person.name)}</text>
      `,
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${background}
      ${relationMarkup}
      ${peopleMarkup}
    </svg>
  `;
}

function exportPng() {
  if (people.length === 0) {
    statusChip.textContent = "先に人物を追加してください";
    return;
  }
  exportPngButton.disabled = true;
  exportPngButton.textContent = "PNG生成中...";
  const markup = exportSvgMarkup();
  const rect = canvasRect();
  const image = new Image();
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  image.onload = () => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.round(rect.width * 2);
    exportCanvas.height = Math.round(rect.height * 2);
    const context = exportCanvas.getContext("2d");
    context.scale(2, 2);
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    exportCanvas.toBlob((blob) => {
      if (!blob) {
        statusChip.textContent = "PNG生成に失敗しました";
        exportPngButton.disabled = false;
        exportPngButton.textContent = "PNGを書き出す";
        return;
      }
      if (latestExportUrl) URL.revokeObjectURL(latestExportUrl);
      latestExportBlob = blob;
      latestExportDataUrl = exportCanvas.toDataURL("image/png");
      latestExportUrl = URL.createObjectURL(blob);
      showExportResult();
      triggerDownload(latestExportDataUrl);
      statusChip.textContent = "PNGを生成しました";
      exportPngButton.disabled = false;
      exportPngButton.textContent = "PNGを書き出す";
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    statusChip.textContent = "PNG生成に失敗しました";
    exportPngButton.disabled = false;
    exportPngButton.textContent = "PNGを書き出す";
  };
  image.src = url;
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
      await writable.write(latestExportBlob);
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
