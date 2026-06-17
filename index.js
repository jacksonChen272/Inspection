/* ==========================================================================
   JavaScript Logic - Meida Food Field Inspection System
   ========================================================================== */

// ==========================================================================
// 1. Initial State & Configuration
// ==========================================================================

let currentUser = null;
let templates = [];
let reports = [];
let currentReport = null;
let usersList = []; // Local database of users

// Photo Markup Editor State
let markupContext = null;
let isDrawingMarkup = false;
let markupImage = new Image();
let markupBrushColor = "#ef4444";
let markupBrushSize = 5;
let currentEditingPhotoMeta = null; // { itemId, photoIndex }

// Signature Pad State
let isDrawingSignature = false;
let signatureCanvas = null;
let signatureContext = null;
let signatureLocked = false;

// Default Users Database
const DEFAULT_USERS = [
    { id: "MD-001", name: "林大明", dept: "品保部", role: "管理員" },
    { id: "MD-002", name: "張美琪", dept: "生產部", role: "巡檢主管" },
    { id: "MD-101", name: "王小明", dept: "製造一課", role: "巡檢員" },
    { id: "MD-102", name: "李小華", dept: "製造二課", role: "巡檢員" }
];

// Default Presets Templates (Styled for Food Processing [美達食品])
const PRESET_TEMPLATES = [
    {
        id: "tmpl-food-hygiene",
        name: "美達食品現場衛生與安全巡檢單",
        creator: "系統預設",
        createdAt: "2026-06-17",
        categories: [
            {
                name: "A. 人員衛生管理區 (Person hygiene)",
                items: [
                    "作業人員是否正確配戴口罩、髮網與乾淨工作服（無毛髮外露或戴個人飾品）",
                    "人員進廠前是否落實洗手消毒與風淋程序，且雙手無任何外傷感染",
                    "更衣室與風淋室運作正常，黏塵滾輪及清潔消耗品充足"
                ]
            },
            {
                name: "B. 生產現場與工藝溫度控管 (Process temp & Sanitation)",
                items: [
                    "夾層蒸煮鍋 (Cooker) 蒸煮中心溫度計讀數 (標準: ≧85°C)",
                    "配料調配缸攪拌馬達運轉穩定性及表層衛生清潔狀態",
                    "高溫連續殺菌釜運作溫度與殺菌釜內壓力讀值控制",
                    "成品充填包裝區（潔淨室）金屬檢測機測試塊感應警報測試狀態"
                ]
            },
            {
                name: "C. 環境與廢棄物控管 (Sanitation & Waste)",
                items: [
                    "車間地面排水溝流暢度與異味監控，地面積水或結露狀況",
                    "設備表面（輸送帶、工作檯）洗滌液殘留測試 (餘氯濃度 150-200ppm)",
                    "生產廢料桶加蓋閉鎖狀態，防鼠防蠅擋板定位正常"
                ]
            }
        ]
    },
    {
        id: "tmpl-machining-pow",
        name: "美達食品機房動力與公共設備巡檢表",
        creator: "系統預設",
        createdAt: "2026-06-17",
        categories: [
            {
                name: "A. 鍋爐房與供汽系統",
                items: [
                    "燃氣鍋爐運行蒸氣壓力 (標準: 0.6-0.8 MPa)",
                    "水軟化設備運作狀態與軟水硬度檢驗結果",
                    "排煙管道及燃氣洩漏警報器安全功能測試"
                ]
            },
            {
                name: "B. 冷凍機房與低溫原料庫",
                items: [
                    "1號冷凍原料庫控制面板顯示溫度 (標準: ≦-18°C)",
                    "低溫解凍庫控制面板顯示溫度 (標準: 0-4°C)",
                    "冷凝器風扇運轉有無異音，冷媒管路接頭無結霜洩漏"
                ]
            }
        ]
    }
];

// ==========================================================================
// 2. Routing / Screen Toggle Navigation
// ==========================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Header Visibility logic
    const appHeader = document.getElementById('app-header');
    if (screenId === 'login-screen') {
        appHeader.style.display = 'none';
    } else {
        appHeader.style.display = 'block';
        updateHeaderUser();
    }
    
    // Refresh Navigation Tab Highlights
    document.querySelectorAll('nav button').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-primary)';
    });
    
    if (screenId === 'dashboard-screen') {
        const dashBtn = document.getElementById('nav-dash-btn');
        if (dashBtn) {
            dashBtn.style.background = 'var(--primary-light)';
            dashBtn.style.color = 'var(--primary)';
        }
        renderDashboard();
    } else if (screenId === 'template-screen') {
        const tmplBtn = document.getElementById('nav-templates-btn');
        if (tmplBtn) {
            tmplBtn.style.background = 'var(--primary-light)';
            tmplBtn.style.color = 'var(--primary)';
        }
        renderTemplatesScreen();
    } else if (screenId === 'users-screen') {
        const usersBtn = document.getElementById('nav-users-btn');
        if (usersBtn) {
            usersBtn.style.background = 'var(--primary-light)';
            usersBtn.style.color = 'var(--primary)';
        }
        renderUsersScreen();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// 3. User & Authentication Logic
// ==========================================================================

function checkAuth() {
    const savedUser = localStorage.getItem('inspection_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showScreen('dashboard-screen');
    } else {
        showScreen('login-screen');
    }
}

function login(usernameVal, passwordVal) {
    if (!usersList || usersList.length === 0) {
        usersList = [...DEFAULT_USERS];
    }
    
    // Safe lookup to prevent undefined errors
    const matchingUser = usersList.find(u => 
        u && u.id && u.id.toLowerCase() === usernameVal.trim().toLowerCase() && passwordVal === '123456'
    );
    
    if (matchingUser && (matchingUser.role === '管理員' || matchingUser.role === '巡檢主管')) {
        currentUser = {
            id: matchingUser.id,
            name: matchingUser.name,
            role: matchingUser.role,
            avatar: matchingUser.name.charAt(0)
        };
        localStorage.setItem('inspection_user', JSON.stringify(currentUser));
        showScreen('dashboard-screen');
        showToast(`歡迎登入！[美達食品] ${currentUser.role} ${currentUser.name}`);
    } else if (usernameVal.trim().toLowerCase() === 'admin' && passwordVal === '123456') {
        currentUser = {
            id: "MD-001",
            name: "林大明",
            role: "管理員",
            avatar: "林"
        };
        localStorage.setItem('inspection_user', JSON.stringify(currentUser));
        showScreen('dashboard-screen');
        showToast("歡迎登入！系統管理員 林大明");
    } else {
        alert("帳號或密碼錯誤，或是您的角色無權限登入後台！\n主管測試帳號：MD-001 或 admin\n預設密碼：123456");
    }
}

function updateHeaderUser() {
    if (currentUser) {
        const avatarEl = document.getElementById('user-avatar');
        const nameEl = document.getElementById('user-display-name');
        const idEl = document.getElementById('user-display-id');
        
        if (avatarEl) avatarEl.textContent = currentUser.avatar;
        if (nameEl) nameEl.textContent = currentUser.name;
        if (idEl) idEl.textContent = `${currentUser.role} (${currentUser.id})`;
    }
}

// ==========================================================================
// 4. LocalStorage CRUD Utilities
// ==========================================================================

function loadData() {
    // 1. Load User DB
    const savedUsers = localStorage.getItem('inspection_users_db');
    if (savedUsers) {
        usersList = JSON.parse(savedUsers);
    } else {
        usersList = [...DEFAULT_USERS];
        localStorage.setItem('inspection_users_db', JSON.stringify(usersList));
    }

    // 2. Load custom templates (merged with default presets)
    const savedTemplates = localStorage.getItem('inspection_templates');
    if (savedTemplates) {
        templates = [...PRESET_TEMPLATES, ...JSON.parse(savedTemplates)];
    } else {
        templates = [...PRESET_TEMPLATES];
    }
    
    // 3. Load historical reports
    const savedReports = localStorage.getItem('inspection_reports');
    if (savedReports) {
        reports = JSON.parse(savedReports);
    } else {
        reports = [];
    }
}

function saveCustomTemplatesToStorage(customTemplatesOnly) {
    localStorage.setItem('inspection_templates', JSON.stringify(customTemplatesOnly));
}

function saveReport(reportObj) {
    const idx = reports.findIndex(r => r.id === reportObj.id);
    if (idx !== -1) {
        reports[idx] = reportObj;
    } else {
        reports.push(reportObj);
    }
    localStorage.setItem('inspection_reports', JSON.stringify(reports));
    renderDashboard();
}

function deleteReport(reportId) {
    if (confirm("您確定要刪除這筆巡檢紀錄嗎？此動作無法復原。")) {
        reports = reports.filter(r => r.id !== reportId);
        localStorage.setItem('inspection_reports', JSON.stringify(reports));
        renderDashboard();
        showToast("已成功刪除巡檢紀錄。");
    }
}

// ==========================================================================
// 5. Dashboard Renderer
// ==========================================================================

function renderDashboard() {
    loadData();
    
    // Date Indicator
    const timeEl = document.getElementById('current-date-time');
    if (timeEl) {
        const now = new Date();
        timeEl.innerHTML = `<i class="fa-regular fa-clock"></i> 系統時間: ${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }
    
    // Calculate statistics
    const submittedReports = reports.filter(r => !r.isDraft);
    document.getElementById('stat-completed-count').textContent = submittedReports.length;
    
    let totalDefects = 0;
    let totalCheckedItems = 0;
    let totalPassedItems = 0;
    
    submittedReports.forEach(r => {
        r.items.forEach(it => {
            if (it.status === 'fail') totalDefects++;
            if (it.status === 'pass' || it.status === 'fail') {
                totalCheckedItems++;
                if (it.status === 'pass') totalPassedItems++;
            }
        });
    });
    
    document.getElementById('stat-defect-count').textContent = totalDefects;
    
    const passRate = totalCheckedItems > 0 ? Math.round((totalPassedItems / totalCheckedItems) * 100) : 100;
    document.getElementById('stat-pass-rate').textContent = passRate + "%";
    
    // Render History Logs Table
    const tbody = document.getElementById('history-tbody');
    const emptyState = document.getElementById('history-empty');
    tbody.innerHTML = '';
    
    if (reports.length === 0) {
        emptyState.style.display = 'block';
        document.getElementById('history-table').style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    document.getElementById('history-table').style.display = 'table';
    
    // Sort: newest first
    const sortedReports = [...reports].sort((a,b) => b.timestamp - a.timestamp);
    
    sortedReports.forEach(report => {
        const defects = report.items.filter(it => it.status === 'fail').length;
        
        // Status Badge UI
        let statusBadge = '';
        if (report.isDraft) {
            statusBadge = '<span class="status-badge draft"><i class="fa-solid fa-pen-ruler"></i> 暫存草稿</span>';
        } else if (defects > 0) {
            statusBadge = '<span class="status-badge fail"><i class="fa-solid fa-circle-exclamation"></i> 發現異常</span>';
        } else {
            statusBadge = '<span class="status-badge ok"><i class="fa-solid fa-circle-check"></i> 安全合格</span>';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${report.date}</strong> <span style="font-size: 11px; color: var(--text-secondary);">${report.time}</span></td>
            <td><div style="font-weight: 600;">${report.title}</div><div style="font-size: 11px; color: var(--text-muted);">ID: ${report.id}</div></td>
            <td>${report.area}</td>
            <td>${report.inspector} (${report.inspectorId})</td>
            <td><span style="font-size: 13px; font-weight: 500;">${report.signature ? '✔️ 主管已核章' : '❌ 未核章'}</span></td>
            <td>${statusBadge}</td>
            <td><span style="font-weight: 600; color: ${defects > 0 ? 'var(--danger)' : 'inherit'};">${defects}</span></td>
            <td class="action-buttons-cell no-print">
                <button class="btn-table-action view" onclick="viewReportDetail('${report.id}')">
                    <i class="fa-solid fa-magnifying-glass-chart"></i> ${report.isDraft ? '繼續填寫' : '查看/匯出'}
                </button>
                <button class="btn-table-action delete" onclick="deleteReport('${report.id}')">
                    <i class="fa-solid fa-trash"></i> 刪除
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================================================
// 6. Template Management UI & Heuristic Excel Parser
// ==========================================================================

function renderTemplatesScreen() {
    loadData();
    const presetContainer = document.getElementById('preset-templates-list');
    presetContainer.innerHTML = '';
    
    templates.forEach(tmpl => {
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.innerHTML = `
            <div class="preset-info">
                <h4>${tmpl.name}</h4>
                <p>來源: ${tmpl.creator} | 項目數: ${tmpl.categories.reduce((acc, cat) => acc + cat.items.length, 0)} 個</p>
            </div>
            <div class="preset-actions">
                <button class="btn-secondary" style="padding: 6px 12px; font-size:12px;" title="套用此巡檢單開始填寫" onclick="startNewInspection('${tmpl.id}')">
                    <i class="fa-solid fa-play"></i> 開始巡檢
                </button>
                <button class="btn-secondary" style="padding: 6px 12px; font-size:12px;" title="載入至設計器修改" onclick="loadTemplateToDesigner('${tmpl.id}')">
                    <i class="fa-solid fa-file-pen"></i> 載入編輯
                </button>
            </div>
        `;
        presetContainer.appendChild(card);
    });
}

function parseUploadedFile(file) {
    const reader = new FileReader();
    const fileName = file.name;
    const extension = fileName.split('.').pop().toLowerCase();
    
    showToast(`正在讀取檔案: ${fileName}...`);
    
    if (extension === 'xlsx' || extension === 'xls') {
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rowsData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                processExcelParsedRows(fileName.replace(/\.[^/.]+$/, ""), rowsData);
            } catch (err) {
                console.error(err);
                alert("Excel 檔案解析失敗，請確認檔案格式是否損壞。");
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (extension === 'txt' || extension === 'csv') {
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                processTextParsedLines(fileName.replace(/\.[^/.]+$/, ""), text);
            } catch (err) {
                console.error(err);
                alert("文字檔案讀取失敗！");
            }
        };
        reader.readAsText(file, 'UTF-8');
    } else {
        alert("不支援的檔案格式！");
    }
}

function processExcelParsedRows(docTitle, rows) {
    if (!rows || rows.length === 0) {
        alert("Excel 檔案內容為空！");
        return;
    }
    
    let parsedCategories = [];
    let currentCategory = { name: "A. 一般巡檢大項", items: [] };
    
    rows.forEach((row, idx) => {
        const cells = row.map(c => c !== undefined && c !== null ? String(c).trim() : "").filter(c => c !== "");
        if (cells.length === 0) return;
        
        if (cells.length === 1) {
            const titleText = cells[0];
            if (idx === 0 && (titleText.includes("表") || titleText.includes("單") || titleText.includes("記錄"))) {
                return;
            }
            if (currentCategory.items.length > 0) {
                parsedCategories.push(currentCategory);
            }
            currentCategory = { name: titleText, items: [] };
        } else if (cells.length >= 2) {
            const checkItemText = cells.join(" - ");
            currentCategory.items.push(checkItemText);
        }
    });
    
    if (currentCategory.items.length > 0) {
        parsedCategories.push(currentCategory);
    }
    
    if (parsedCategories.length === 0) {
        alert("無法從 Excel 中自動識別巡檢大項與細項。");
        return;
    }
    
    designerTemplate = {
        id: "custom-" + Date.now(),
        name: docTitle,
        creator: currentUser ? currentUser.name : "主管上傳",
        createdAt: new Date().toISOString().split('T')[0],
        categories: parsedCategories
    };
    
    loadTemplateToDesignerUI();
    showToast("Excel 解析成功！已加載至右側設計器，您可以進一步編輯。");
}

function processTextParsedLines(docTitle, text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== "");
    if (lines.length === 0) {
        alert("文字檔案內容為空！");
        return;
    }
    
    let parsedCategories = [];
    let currentCategory = null;
    
    lines.forEach(line => {
        if (line.endsWith(':') || line.endsWith('：') || (line.startsWith('[') && line.endsWith(']')) || (line.startsWith('【') && line.endsWith('】'))) {
            if (currentCategory) {
                parsedCategories.push(currentCategory);
            }
            currentCategory = { name: line.replace(/[:：\[\]【】]/g, ""), items: [] };
        } else {
            if (!currentCategory) {
                currentCategory = { name: "A. 預設分類項目", items: [] };
            }
            currentCategory.items.push(line);
        }
    });
    
    if (currentCategory) {
        parsedCategories.push(currentCategory);
    }
    
    designerTemplate = {
        id: "custom-" + Date.now(),
        name: docTitle,
        creator: currentUser ? currentUser.name : "主管上傳",
        createdAt: new Date().toISOString().split('T')[0],
        categories: parsedCategories
    };
    
    loadTemplateToDesignerUI();
    showToast("文字檔解析成功！已加載至設計器。");
}

function loadTemplateToDesigner(tmplId) {
    const tmplObj = templates.find(t => t.id === tmplId);
    if (!tmplObj) return;
    
    designerTemplate = JSON.parse(JSON.stringify(tmplObj));
    if (tmplId.startsWith('tmpl-')) {
        designerTemplate.id = "custom-" + Date.now();
        designerTemplate.name += " (複本)";
        designerTemplate.creator = currentUser ? currentUser.name : "主管自訂";
    }
    
    loadTemplateToDesignerUI();
    showToast(`已載入 [${tmplObj.name}]`);
}

function loadTemplateToDesignerUI() {
    const designerTitleInput = document.getElementById('designer-title');
    if (designerTitleInput) designerTitleInput.value = designerTemplate.name;
    
    const container = document.getElementById('designer-groups-container');
    if (!container) return;
    container.innerHTML = '';
    
    designerTemplate.categories.forEach((cat, catIdx) => {
        const groupCard = document.createElement('div');
        groupCard.className = 'designer-group-card';
        groupCard.innerHTML = `
            <div class="designer-group-header">
                <i class="fa-solid fa-folder-open" style="color: var(--warning);"></i>
                <input type="text" value="${cat.name}" placeholder="分類名稱" onchange="updateDesignerCategoryName(${catIdx}, this.value)">
                <button class="btn-designer-del" title="刪除整組" onclick="deleteDesignerCategory(${catIdx})">
                    <i class="fa-solid fa-square-minus"></i>
                </button>
            </div>
            <div class="designer-items-sublist" id="designer-sublist-${catIdx}"></div>
            <button class="btn-designer-add" onclick="addDesignerItem(${catIdx})">
                <i class="fa-solid fa-circle-plus"></i> 新增檢查細項
            </button>
        `;
        container.appendChild(groupCard);
        renderDesignerSubItems(catIdx);
    });
}

function renderDesignerSubItems(catIdx) {
    const subContainer = document.getElementById(`designer-sublist-${catIdx}`);
    if (!subContainer) return;
    subContainer.innerHTML = '';
    
    const cat = designerTemplate.categories[catIdx];
    cat.items.forEach((itemText, itemIdx) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'designer-item-row';
        itemRow.innerHTML = `
            <span style="font-size: 12px; color: var(--text-secondary); min-width: 16px;">${itemIdx + 1}.</span>
            <input type="text" value="${itemText}" placeholder="檢查內容與標準描述..." onchange="updateDesignerItemText(${catIdx}, ${itemIdx}, this.value)">
            <button class="btn-designer-del" onclick="deleteDesignerItem(${catIdx}, ${itemIdx})">
                <i class="fa-solid fa-circle-minus"></i>
            </button>
        `;
        subContainer.appendChild(itemRow);
    });
}

function updateDesignerCategoryName(catIdx, val) {
    designerTemplate.categories[catIdx].name = val;
}

function deleteDesignerCategory(catIdx) {
    designerTemplate.categories.splice(catIdx, 1);
    loadTemplateToDesignerUI();
}

function addDesignerItem(catIdx) {
    designerTemplate.categories[catIdx].items.push("全新檢查細項內容描述");
    loadTemplateToDesignerUI();
}

function updateDesignerItemText(catIdx, itemIdx, val) {
    designerTemplate.categories[catIdx].items[itemIdx] = val;
}

function deleteDesignerItem(catIdx, itemIdx) {
    designerTemplate.categories[catIdx].items.splice(itemIdx, 1);
    loadTemplateToDesignerUI();
}

// ==========================================================================
// 7. Form Filling Engine
// ==========================================================================

function populateInspectorSelects() {
    loadData();
    const inspectorSelect = document.getElementById('form-input-inspector');
    const approverSelect = document.getElementById('form-input-approver');
    
    if (!inspectorSelect || !approverSelect) return;
    
    inspectorSelect.innerHTML = '';
    approverSelect.innerHTML = '';
    
    usersList.forEach(u => {
        if (u.role === '巡檢員' || u.role === '巡檢主管' || u.role === '管理員') {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.name} (${u.role})`;
            inspectorSelect.appendChild(opt);
        }
        if (u.role === '巡檢主管' || u.role === '管理員') {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = `${u.name} (${u.role})`;
            approverSelect.appendChild(opt);
        }
    });
}

function startNewInspection(tmplId) {
    loadData();
    const tmpl = templates.find(t => t.id === tmplId);
    if (!tmpl) return;
    
    populateInspectorSelects();
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = String(now.getHours()).padStart(2,'0') + ":" + String(now.getMinutes()).padStart(2,'0');
    
    currentReport = {
        id: "RPT-" + Date.now(),
        templateId: tmpl.id,
        title: tmpl.name,
        inspector: "", 
        inspectorId: "", 
        approver: "",
        approverId: "",
        date: dateStr,
        time: timeStr,
        area: "美達 A 廠 蒸煮調配區",
        machine: "",
        items: [],
        signature: "",
        isDraft: true,
        timestamp: Date.now()
    };
    
    tmpl.categories.forEach(cat => {
        cat.items.forEach(itName => {
            currentReport.items.push({
                category: cat.name,
                name: itName,
                record: "", 
                status: "", 
                note: "",
                photos: []
            });
        });
    });
    
    loadReportToFillingUI();
    showScreen('form-screen');
}

function loadReportToFillingUI() {
    if (!currentReport) return;
    
    populateInspectorSelects();
    
    document.getElementById('form-title-display').textContent = `現場巡檢: ${currentReport.title}`;
    document.getElementById('form-meta-datetime').textContent = `${currentReport.date} ${currentReport.time}`;
    document.getElementById('form-input-area').value = currentReport.area;
    document.getElementById('form-input-machine').value = currentReport.machine;
    
    if (currentReport.inspectorId) {
        document.getElementById('form-input-inspector').value = currentReport.inspectorId;
    }
    if (currentReport.approverId) {
        document.getElementById('form-input-approver').value = currentReport.approverId;
    }
    
    signatureLocked = false;
    document.getElementById('signature-lock-btn').innerHTML = `<i class="fa-solid fa-lock"></i> 鎖定簽章`;
    document.getElementById('signature-canvas').style.pointerEvents = 'auto';
    
    const canvas = document.getElementById('signature-canvas');
    if (signatureContext) {
        signatureContext.clearRect(0, 0, canvas.width, canvas.height);
        signatureContext.fillStyle = '#ffffff';
        signatureContext.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    if (currentReport.signature) {
        const img = new Image();
        img.onload = function() {
            if (signatureContext) signatureContext.drawImage(img, 0, 0);
            lockSignaturePad();
        };
        img.src = currentReport.signature;
    }
    
    const container = document.getElementById('form-checklist-container');
    if (!container) return;
    container.innerHTML = '';
    
    let currentCategoryName = "";
    let categoryBlock = null;
    let itemsSubContainer = null;
    
    currentReport.items.forEach((item, itemIdx) => {
        if (item.category !== currentCategoryName) {
            currentCategoryName = item.category;
            
            categoryBlock = document.createElement('div');
            categoryBlock.className = 'inspection-category-block';
            categoryBlock.innerHTML = `
                <div class="category-title">
                    <i class="fa-solid fa-chevron-right"></i> ${currentCategoryName}
                </div>
                <div class="category-items-container" id="cat-items-${itemIdx}"></div>
            `;
            container.appendChild(categoryBlock);
            itemsSubContainer = document.getElementById(`cat-items-${itemIdx}`);
        }
        
        const row = document.createElement('div');
        row.className = 'inspection-item-row';
        row.id = `item-row-${itemIdx}`;
        row.innerHTML = `
            <div class="inspection-item-header" style="flex-direction: column; align-items: stretch; gap: 8px;">
                <div class="item-question">
                    <span class="item-index">${itemIdx + 1}</span>
                    <span class="item-name">${item.name}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; width: 100%; flex-wrap: wrap;">
                    <input type="text" class="item-record-input" 
                           placeholder="現況/數值記錄 (例如: 85°C 或 正常)..." 
                           value="${item.record || ''}" 
                           onchange="updateCheckItemRecord(${itemIdx}, this.value)"
                           style="flex: 1; min-width: 180px; max-width: 100%;">
                    <div class="item-options" style="flex-wrap: wrap;">
                        <button class="option-btn pass ${item.status === 'pass' ? 'active' : ''}" onclick="setCheckItemStatus(${itemIdx}, 'pass')">
                            <i class="fa-solid fa-circle-check"></i> 合格
                        </button>
                        <button class="option-btn fail ${item.status === 'fail' ? 'active' : ''}" onclick="setCheckItemStatus(${itemIdx}, 'fail')">
                            <i class="fa-solid fa-circle-xmark"></i> 不合格
                        </button>
                        <button class="option-btn na ${item.status === 'na' ? 'active' : ''}" onclick="setCheckItemStatus(${itemIdx}, 'na')">
                            <i class="fa-solid fa-circle-minus"></i> 無運作
                        </button>
                        <button class="btn-photo-action" onclick="triggerPhotoUpload(${itemIdx})" title="拍照">
                            <i class="fa-solid fa-camera"></i> 拍照 <span id="photo-count-badge-${itemIdx}" style="background: var(--primary); color: white; border-radius:50%; font-size:10px; padding:1px 6px; margin-left:4px; display:${item.photos.length > 0 ? 'inline' : 'none'};">${item.photos.length}</span>
                        </button>
                    </div>
                    <input type="file" id="file-uploader-${itemIdx}" accept="image/*" style="display:none;" onchange="handlePhotoUpload(${itemIdx}, this)">
                </div>
            </div>
            <div class="inspection-item-details ${item.status === 'fail' || item.note || item.photos.length > 0 ? 'active' : ''}" id="item-details-${itemIdx}">
                <div class="form-group" style="margin-bottom:8px;">
                    <label style="font-size:12px; font-weight:600;"><i class="fa-solid fa-comment-dots"></i> 異常說明 / 備註</label>
                    <textarea placeholder="填寫更多描述..." rows="2" style="padding-left:12px;" onchange="updateCheckItemNote(${itemIdx}, this.value)">${item.note || ''}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <div class="photo-uploader-container">
                        <div id="photo-thumbs-${itemIdx}" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
                    </div>
                </div>
            </div>
        `;
        if (itemsSubContainer) itemsSubContainer.appendChild(row);
        renderPhotoThumbnails(itemIdx);
    });
}

function updateCheckItemRecord(itemIdx, val) {
    currentReport.items[itemIdx].record = val;
}

function setCheckItemStatus(itemIdx, status) {
    currentReport.items[itemIdx].status = status;
    const row = document.getElementById(`item-row-${itemIdx}`);
    if (row) {
        row.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = row.querySelector(`.option-btn.${status}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
    const detailsBlock = document.getElementById(`item-details-${itemIdx}`);
    if (detailsBlock) {
        if (status === 'fail') {
            detailsBlock.classList.add('active');
        } else {
            const item = currentReport.items[itemIdx];
            if (!item.note && item.photos.length === 0) {
                detailsBlock.classList.remove('active');
            }
        }
    }
}

function updateCheckItemNote(itemIdx, text) {
    currentReport.items[itemIdx].note = text;
}

function triggerPhotoUpload(itemIdx) {
    const el = document.getElementById(`file-uploader-${itemIdx}`);
    if (el) el.click();
}

function handlePhotoUpload(itemIdx, input) {
    if (input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const rawBase64 = e.target.result;
        compressImage(rawBase64, 800, 0.7, function(compressedBase64) {
            currentReport.items[itemIdx].photos.push(compressedBase64);
            renderPhotoThumbnails(itemIdx);
            
            const detailsBlock = document.getElementById(`item-details-${itemIdx}`);
            if (detailsBlock) detailsBlock.classList.add('active');
            
            const badge = document.getElementById(`photo-count-badge-${itemIdx}`);
            if (badge) {
                badge.style.display = 'inline';
                badge.textContent = currentReport.items[itemIdx].photos.length;
            }
            input.value = '';
        });
    };
    reader.readAsDataURL(file);
}

function renderPhotoThumbnails(itemIdx) {
    const thumbsContainer = document.getElementById(`photo-thumbs-${itemIdx}`);
    if (!thumbsContainer) return;
    thumbsContainer.innerHTML = '';
    
    const item = currentReport.items[itemIdx];
    item.photos.forEach((base64Img, photoIdx) => {
        const thumb = document.createElement('div');
        thumb.className = 'photo-preview-box';
        thumb.innerHTML = `
            <img src="${base64Img}">
            <span class="photo-badge"><i class="fa-solid fa-marker"></i> 標記</span>
            <button class="btn-delete-photo" onclick="deletePhoto(${itemIdx}, ${photoIdx}); event.stopPropagation();">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        thumb.addEventListener('click', () => {
            openPhotoMarkupModal(itemIdx, photoIdx, base64Img);
        });
        thumbsContainer.appendChild(thumb);
    });
}

function deletePhoto(itemIdx, photoIdx) {
    currentReport.items[itemIdx].photos.splice(photoIdx, 1);
    renderPhotoThumbnails(itemIdx);
    
    const badge = document.getElementById(`photo-count-badge-${itemIdx}`);
    const len = currentReport.items[itemIdx].photos.length;
    if (badge) {
        if (len > 0) {
            badge.textContent = len;
        } else {
            badge.style.display = 'none';
            const item = currentReport.items[itemIdx];
            if (!item.note && item.status !== 'fail') {
                const detailsBlock = document.getElementById(`item-details-${itemIdx}`);
                if (detailsBlock) detailsBlock.classList.remove('active');
            }
        }
    }
}

function compressImage(base64Source, maxDim, quality, callback) {
    const img = new Image();
    img.onload = function() {
        let width = img.width;
        let height = img.height;
        if (width > height) {
            if (width > maxDim) {
                height *= maxDim / width;
                width = maxDim;
            }
        } else {
            if (height > maxDim) {
                width *= maxDim / height;
                height = maxDim;
            }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64Source;
}

// ==========================================================================
// 8. Photo Markup Overlay Canvas Editor
// ==========================================================================

function openPhotoMarkupModal(itemIdx, photoIdx, base64Img) {
    currentEditingPhotoMeta = { itemIdx, photoIdx };
    document.getElementById('markup-modal').classList.add('active');
    
    const canvas = document.getElementById('markup-canvas');
    if (!canvas) return;
    markupContext = canvas.getContext('2d');
    
    markupImage = new Image();
    markupImage.onload = function() {
        canvas.width = markupImage.width;
        canvas.height = markupImage.height;
        if (markupContext) markupContext.drawImage(markupImage, 0, 0);
    };
    markupImage.src = base64Img;
}

function closeMarkupModal() {
    const modal = document.getElementById('markup-modal');
    if (modal) modal.classList.remove('active');
    currentEditingPhotoMeta = null;
}

function initMarkupEvents() {
    const canvas = document.getElementById('markup-canvas');
    if (!canvas) return;
    
    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: ((clientX - rect.left) / rect.width) * canvas.width,
            y: ((clientY - rect.top) / rect.height) * canvas.height
        };
    }
    
    function startDraw(e) {
        e.preventDefault();
        isDrawingMarkup = true;
        const coords = getCoords(e);
        if (markupContext) {
            markupContext.beginPath();
            markupContext.moveTo(coords.x, coords.y);
            markupContext.lineCap = "round";
            markupContext.strokeStyle = markupBrushColor;
            markupContext.lineWidth = markupBrushSize;
        }
    }
    
    function draw(e) {
        if (!isDrawingMarkup) return;
        e.preventDefault();
        const coords = getCoords(e);
        if (markupContext) {
            markupContext.lineTo(coords.x, coords.y);
            markupContext.stroke();
        }
    }
    
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', () => isDrawingMarkup = false);
    canvas.addEventListener('mouseleave', () => isDrawingMarkup = false);
    
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', () => isDrawingMarkup = false);
    
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
            markupBrushColor = this.getAttribute('data-color');
        });
    });
    
    const slider = document.getElementById('markup-brush-slider');
    if (slider) {
        slider.addEventListener('input', function(e) {
            markupBrushSize = parseInt(e.target.value);
            document.getElementById('brush-size-val').textContent = markupBrushSize;
        });
    }
    
    const clearBtn = document.getElementById('markup-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (markupContext) {
                markupContext.clearRect(0, 0, canvas.width, canvas.height);
                markupContext.drawImage(markupImage, 0, 0);
            }
        });
    }
    
    const cancelBtn = document.getElementById('markup-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeMarkupModal);
    
    const closeBtn = document.getElementById('markup-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeMarkupModal);
    
    const saveBtn = document.getElementById('markup-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (!currentEditingPhotoMeta) return;
            const { itemIdx, photoIdx } = currentEditingPhotoMeta;
            currentReport.items[itemIdx].photos[photoIdx] = canvas.toDataURL('image/jpeg', 0.8);
            renderPhotoThumbnails(itemIdx);
            closeMarkupModal();
            showToast("已儲存照片批註。");
        });
    }
}

// ==========================================================================
// 9. Digital Signature Pad Implementation
// ==========================================================================

function initSignatureEvents() {
    signatureCanvas = document.getElementById('signature-canvas');
    if (!signatureCanvas) return;
    signatureContext = signatureCanvas.getContext('2d');
    
    function resizeCanvas() {
        if (!signatureCanvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = signatureCanvas.getBoundingClientRect();
        signatureCanvas.width = rect.width * dpr;
        signatureCanvas.height = rect.height * dpr;
        if (signatureContext) {
            signatureContext.scale(dpr, dpr);
            signatureContext.fillStyle = '#ffffff';
            signatureContext.fillRect(0, 0, rect.width, rect.height);
        }
    }
    
    window.addEventListener('resize', () => {
        if (document.getElementById('form-screen').classList.contains('active')) {
            resizeCanvas();
        }
    });
    
    function getCoords(e) {
        const rect = signatureCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    
    function startDraw(e) {
        if (signatureLocked) return;
        e.preventDefault();
        isDrawingSignature = true;
        const coords = getCoords(e);
        if (signatureContext) {
            signatureContext.beginPath();
            signatureContext.moveTo(coords.x, coords.y);
            signatureContext.strokeStyle = "#000000";
            signatureContext.lineWidth = 2.5;
            signatureContext.lineCap = "round";
        }
    }
    
    function draw(e) {
        if (!isDrawingSignature || signatureLocked) return;
        e.preventDefault();
        const coords = getCoords(e);
        if (signatureContext) {
            signatureContext.lineTo(coords.x, coords.y);
            signatureContext.stroke();
        }
    }
    
    signatureCanvas.addEventListener('mousedown', startDraw);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', () => isDrawingSignature = false);
    signatureCanvas.addEventListener('mouseleave', () => isDrawingSignature = false);
    
    signatureCanvas.addEventListener('touchstart', startDraw, { passive: false });
    signatureCanvas.addEventListener('touchmove', draw, { passive: false });
    signatureCanvas.addEventListener('touchend', () => isDrawingSignature = false);
    
    const clearBtn = document.getElementById('signature-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            unlockSignaturePad();
            const rect = signatureCanvas.getBoundingClientRect();
            if (signatureContext) {
                signatureContext.clearRect(0, 0, rect.width, rect.height);
                signatureContext.fillStyle = '#ffffff';
                signatureContext.fillRect(0, 0, rect.width, rect.height);
            }
            currentReport.signature = "";
        });
    }
    
    const lockBtn = document.getElementById('signature-lock-btn');
    if (lockBtn) {
        lockBtn.addEventListener('click', () => {
            if (signatureLocked) {
                unlockSignaturePad();
            } else {
                lockSignaturePad();
            }
        });
    }
}

function lockSignaturePad() {
    signatureLocked = true;
    const lockBtn = document.getElementById('signature-lock-btn');
    if (lockBtn) lockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> 解鎖變更`;
    if (signatureCanvas) {
        signatureCanvas.style.pointerEvents = 'none';
        currentReport.signature = signatureCanvas.toDataURL('image/png');
    }
    showToast("簽章已鎖定確認！");
}

function unlockSignaturePad() {
    signatureLocked = false;
    const lockBtn = document.getElementById('signature-lock-btn');
    if (lockBtn) lockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> 鎖定簽章`;
    if (signatureCanvas) signatureCanvas.style.pointerEvents = 'auto';
}

// ==========================================================================
// 10. Word Document Generator Engine (docx.js)
// ==========================================================================

async function exportReportToWord() {
    if (!currentReport) return;
    
    showToast("正在建立 [美達食品] Word 巡檢文件...");
    
    try {
        const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } = window.docx;
        
        const cellPadding = { top: 120, bottom: 120, left: 150, right: 150 };
        const cellBorders = {
            top: { style: BorderStyle.SINGLE, size: 6, color: "D0D5DD" },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "D0D5DD" },
            left: { style: BorderStyle.SINGLE, size: 6, color: "D0D5DD" },
            right: { style: BorderStyle.SINGLE, size: 6, color: "D0D5DD" },
        };
        const thBorders = {
            top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
            bottom: { style: BorderStyle.DOUBLE, size: 12, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
        };
        
        // Document Title
        const docTitle = new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 },
            children: [
                new TextRun({
                    text: `[美達食品] 現場巡檢報告書`,
                    bold: true,
                    size: 36, // 18pt
                    font: "Calibri",
                    color: "1A365D",
                })
            ]
        });
        
        // Metadata Table
        const metaTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            spacing: { before: 100, after: 300 },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "巡檢表名稱", bold: true, font: "Calibri" })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders,
                            backgroundColor: "F8FAFC"
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: currentReport.title, font: "Calibri" })] })],
                            width: { size: 80, type: WidthType.PERCENTAGE },
                            columnSpan: 3,
                            margins: cellPadding,
                            borders: cellBorders
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "巡檢日期", bold: true, font: "Calibri" })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders,
                            backgroundColor: "F8FAFC"
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: currentReport.date, font: "Calibri" })] })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "巡檢時間", bold: true, font: "Calibri" })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders,
                            backgroundColor: "F8FAFC"
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: currentReport.time, font: "Calibri" })] })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "生產線/區域", bold: true, font: "Calibri" })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders,
                            backgroundColor: "F8FAFC"
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: currentReport.area, font: "Calibri" })] })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "機台/設備編號", bold: true, font: "Calibri" })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders,
                            backgroundColor: "F8FAFC"
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: currentReport.machine || "無", font: "Calibri" })] })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "填寫巡檢員", bold: true, font: "Calibri" })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders,
                            backgroundColor: "F8FAFC"
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `${currentReport.inspector} (${currentReport.inspectorId})`, font: "Calibri" })] })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "覆核主管", bold: true, font: "Calibri" })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders,
                            backgroundColor: "F8FAFC"
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: currentReport.approver || "無", font: "Calibri" })] })],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        })
                    ]
                })
            ]
        });
        
        const checkListHeader = new Paragraph({
            spacing: { before: 300, after: 150 },
            children: [
                new TextRun({ text: "詳細巡檢檢驗項目與現場記錄：", bold: true, font: "Calibri", size: 24, color: "1A365D" })
            ]
        });
        
        const tableRows = [];
        
        // Header
        tableRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "項次", bold: true, font: "Calibri" })] })],
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        margins: cellPadding,
                        borders: thBorders,
                        backgroundColor: "E2E8F0"
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "檢查項目 / 內容規範", bold: true, font: "Calibri" })] })],
                        width: { size: 42, type: WidthType.PERCENTAGE },
                        margins: cellPadding,
                        borders: thBorders,
                        backgroundColor: "E2E8F0"
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "現況記錄數值", bold: true, font: "Calibri" })] })],
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        margins: cellPadding,
                        borders: thBorders,
                        backgroundColor: "E2E8F0"
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "判定", bold: true, font: "Calibri" })] })],
                        width: { size: 12, type: WidthType.PERCENTAGE },
                        margins: cellPadding,
                        borders: thBorders,
                        backgroundColor: "E2E8F0"
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "異常與相片", bold: true, font: "Calibri" })] })],
                        width: { size: 18, type: WidthType.PERCENTAGE },
                        margins: cellPadding,
                        borders: thBorders,
                        backgroundColor: "E2E8F0"
                    })
                ]
            })
        );
        
        for (let i = 0; i < currentReport.items.length; i++) {
            const item = currentReport.items[i];
            
            let statusText = "合格";
            let statusColor = "00875A";
            if (item.status === 'fail') {
                statusText = "不合格";
                statusColor = "D80027";
            } else if (item.status === 'na') {
                statusText = "無運作";
                statusColor = "7A869A";
            }
            
            const detailCellsChildren = [];
            if (item.note) {
                detailCellsChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: "備註: ", bold: true, color: "4A5568", font: "Calibri", size: 16 }),
                            new TextRun({ text: item.note, color: "E53E3E", font: "Calibri", size: 16 })
                        ],
                        spacing: { after: 100 }
                    })
                );
            }
            
            if (item.photos && item.photos.length > 0) {
                for (let pIdx = 0; pIdx < item.photos.length; pIdx++) {
                    const photoBuffer = base64ToArrayBuffer(item.photos[pIdx]);
                    detailCellsChildren.push(
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: photoBuffer,
                                    transformation: { width: 100, height: 75 }
                                })
                            ],
                            spacing: { after: 60 },
                            alignment: AlignmentType.CENTER
                        })
                    );
                }
            }
            
            if (detailCellsChildren.length === 0) {
                detailCellsChildren.push(new Paragraph({ children: [new TextRun({ text: "-", font: "Calibri" })] }));
            }
            
            tableRows.push(
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1), font: "Calibri" })] })],
                            width: { size: 8, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: `[${item.category.split(".")[0]}] `, color: "718096", font: "Calibri", bold: true }),
                                        new TextRun({ text: item.name, font: "Calibri" })
                                    ]
                                })
                            ],
                            width: { size: 42, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: item.record || "-", font: "Calibri", italics: true })] })],
                            width: { size: 20, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                        new TextRun({ text: statusText, bold: true, color: statusColor, font: "Calibri" })
                                    ]
                                })
                            ],
                            width: { size: 12, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        }),
                        new TableCell({
                            children: detailCellsChildren,
                            width: { size: 18, type: WidthType.PERCENTAGE },
                            margins: cellPadding,
                            borders: cellBorders
                        })
                    ]
                })
            );
        }
        
        const checklistTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        });
        
        // Signature Block
        let signatureChildren = [
            new TextRun({ text: "覆核主管電子簽章核核：  ", bold: true, font: "Calibri", size: 22 })
        ];
        if (currentReport.signature) {
            const sigBuffer = base64ToArrayBuffer(currentReport.signature);
            signatureChildren.push(
                new ImageRun({
                    data: sigBuffer,
                    transformation: { width: 140, height: 50 }
                })
            );
        }
        
        const signatureParagraph = new Paragraph({
            spacing: { before: 400, after: 200 },
            alignment: AlignmentType.RIGHT,
            children: signatureChildren
        });
        
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    docTitle,
                    metaTable,
                    checkListHeader,
                    checklistTable,
                    signatureParagraph
                ]
            }]
        });
        
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `美達食品巡檢單_${currentReport.date}_${currentReport.area}.docx`);
        showToast("Word 文件下載已啟動！");
        
    } catch (err) {
        console.error(err);
        alert("Word 檔案產生失敗: " + err.message);
    }
}

function base64ToArrayBuffer(base64) {
    const rawString = base64.split(',')[1] || base64;
    const binaryString = window.atob(rawString);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// ==========================================================================
// 14. Users Database Screen Implementation
// ==========================================================================

function renderUsersScreen() {
    loadData();
    const tbody = document.getElementById('users-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    usersList.forEach((user, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${user.id}</strong></td>
            <td>${user.name}</td>
            <td>${user.dept}</td>
            <td><span class="status-badge" style="background:var(--primary-light); color:var(--primary);">${user.role}</span></td>
            <td class="action-buttons-cell">
                <button class="btn-table-action view" onclick="editUser(${idx})">
                    <i class="fa-solid fa-user-pen"></i> 編輯
                </button>
                <button class="btn-table-action delete" onclick="deleteUser(${idx})">
                    <i class="fa-solid fa-user-minus"></i> 刪除
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editUser(index) {
    const user = usersList[index];
    if (!user) return;
    document.getElementById('user-edit-index').value = index;
    document.getElementById('user-input-id').value = user.id;
    document.getElementById('user-input-id').disabled = true; 
    document.getElementById('user-input-name').value = user.name;
    document.getElementById('user-input-dept').value = user.dept;
    document.getElementById('user-input-role').value = user.role;
    
    document.getElementById('user-form-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> 編輯人員資料`;
    document.getElementById('user-save-btn').innerHTML = `<i class="fa-solid fa-check"></i> 儲存變更`;
    
    const clearBtn = document.getElementById('user-clear-btn');
    if (clearBtn) clearBtn.style.display = 'inline-block';
}

function deleteUser(index) {
    const u = usersList[index];
    if (!u) return;
    if (confirm(`您確定要刪除人員 [${u.name}] (工號: ${u.id}) 嗎？`)) {
        usersList.splice(index, 1);
        localStorage.setItem('inspection_users_db', JSON.stringify(usersList));
        renderUsersScreen();
        showToast("已成功移除人員。");
    }
}

function resetUserForm() {
    const editIndexInput = document.getElementById('user-edit-index');
    const inputId = document.getElementById('user-input-id');
    const inputName = document.getElementById('user-input-name');
    const inputDept = document.getElementById('user-input-dept');
    const inputRole = document.getElementById('user-input-role');
    const formTitle = document.getElementById('user-form-title');
    const saveBtn = document.getElementById('user-save-btn');
    const clearBtn = document.getElementById('user-clear-btn');

    if (editIndexInput) editIndexInput.value = "-1";
    if (inputId) {
        inputId.value = "";
        inputId.disabled = false;
    }
    if (inputName) inputName.value = "";
    if (inputDept) inputDept.value = "";
    if (inputRole) inputRole.value = "巡檢員";
    
    if (formTitle) formTitle.innerHTML = `<i class="fa-solid fa-user-plus"></i> 新增人員帳號`;
    if (saveBtn) saveBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> 儲存人員`;
    if (clearBtn) clearBtn.style.display = 'none';
}

// ==========================================================================
// 15. Theme & App Toggles
// ==========================================================================

function initTheme() {
    const savedTheme = localStorage.getItem('inspection_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcon(savedTheme);
    
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('inspection_theme', nextTheme);
            updateThemeToggleIcon(nextTheme);
        });
    }
}

function updateThemeToggleIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        if (theme === 'dark') {
            btn.innerHTML = `<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>`;
        } else {
            btn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
        }
    }
}

function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = 'hsl(215, 90%, 55%)';
        toast.style.color = 'white';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
        toast.style.zIndex = '9999';
        toast.style.fontWeight = '500';
        toast.style.fontSize = '14px';
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 3500);
}

// ==========================================================================
// 16. Safe Event Binding Setup (Invoked in DOMContentLoaded)
// ==========================================================================

function initAppEvents() {
    // 1. Navigation clicks
    const bindClick = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    };

    bindClick('nav-dash-btn', () => showScreen('dashboard-screen'));
    bindClick('nav-templates-btn', () => showScreen('template-screen'));
    bindClick('nav-users-btn', () => showScreen('users-screen'));
    
    bindClick('dash-new-inspection-btn', () => showScreen('template-screen'));
    bindClick('dash-manage-templates-btn', () => showScreen('template-screen'));
    bindClick('dash-manage-users-btn', () => showScreen('users-screen'));
    
    bindClick('back-to-dash-btn-1', () => showScreen('dashboard-screen'));
    bindClick('back-to-dash-btn-2', () => showScreen('dashboard-screen'));
    bindClick('back-to-dash-btn-3', () => showScreen('dashboard-screen'));

    // 2. User Form Events
    const userClearBtn = document.getElementById('user-clear-btn');
    if (userClearBtn) userClearBtn.addEventListener('click', resetUserForm);

    const userEditorForm = document.getElementById('user-editor-form');
    if (userEditorForm) {
        userEditorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const uIndex = parseInt(document.getElementById('user-edit-index').value);
            const uId = document.getElementById('user-input-id').value.trim();
            const uName = document.getElementById('user-input-name').value.trim();
            const uDept = document.getElementById('user-input-dept').value.trim();
            const uRole = document.getElementById('user-input-role').value;
            
            if (!uId || !uName || !uDept) {
                alert("請填寫所有必要人員欄位！");
                return;
            }
            
            const newUser = { id: uId, name: uName, dept: uDept, role: uRole };
            
            if (uIndex === -1) {
                if (usersList.some(u => u.id.toLowerCase() === uId.toLowerCase())) {
                    alert(`已存在相同的工號 [${uId}]，請確認填寫內容！`);
                    return;
                }
                usersList.push(newUser);
                showToast(`已成功新增人員：${uName}`);
            } else {
                usersList[uIndex] = newUser;
                showToast(`已成功更新人員資料：${uName}`);
            }
            
            localStorage.setItem('inspection_users_db', JSON.stringify(usersList));
            resetUserForm();
            renderUsersScreen();
        });
    }

    // 3. Template Designer Events
    bindClick('designer-add-group-btn', () => {
        designerTemplate.categories.push({
            name: `${String.fromCharCode(65 + designerTemplate.categories.length)}. 新增巡檢大項`,
            items: ["預設檢查細項條目"]
        });
        loadTemplateToDesignerUI();
    });

    bindClick('designer-save-template-btn', () => {
        const titleVal = document.getElementById('designer-title').value.trim();
        if (!titleVal) {
            alert("請輸入巡檢單名稱！");
            return;
        }
        
        designerTemplate.name = titleVal;
        if (designerTemplate.categories.length === 0) {
            alert("表單內不能沒有任何巡檢項目！");
            return;
        }
        
        let savedTemplates = localStorage.getItem('inspection_templates');
        let customArr = savedTemplates ? JSON.parse(savedTemplates) : [];
        
        const existingIdx = customArr.findIndex(t => t.id === designerTemplate.id);
        if (existingIdx !== -1) {
            customArr[existingIdx] = designerTemplate;
        } else {
            if (!designerTemplate.id) designerTemplate.id = "custom-" + Date.now();
            designerTemplate.creator = currentUser ? currentUser.name : "主管自訂";
            designerTemplate.createdAt = new Date().toISOString().split('T')[0];
            customArr.push(designerTemplate);
        }
        
        saveCustomTemplatesToStorage(customArr);
        renderTemplatesScreen();
        showToast("範本儲存成功！已更新範本清單。");
    });

    // 4. Form Submission Events
    bindClick('form-save-draft-btn', () => {
        if (!currentReport) return;
        validateAndCollectFormMeta();
        currentReport.isDraft = true;
        currentReport.timestamp = Date.now();
        if (signatureLocked) {
            currentReport.signature = signatureCanvas.toDataURL('image/png');
        }
        saveReport(currentReport);
        showScreen('dashboard-screen');
        showToast("草稿暫存完成！");
    });

    bindClick('form-submit-btn', () => {
        if (!currentReport) return;
        validateAndCollectFormMeta();
        
        let unselected = [];
        currentReport.items.forEach((it, idx) => {
            if (!it.status) unselected.push(idx + 1);
        });
        if (unselected.length > 0) {
            alert(`無法送出！\n第 ${unselected.join(", ")} 項巡檢項目未勾選。`);
            return;
        }
        
        let commentsMissing = [];
        currentReport.items.forEach((it, idx) => {
            if (it.status === 'fail' && !it.note.trim()) {
                commentsMissing.push(idx + 1);
            }
        });
        if (commentsMissing.length > 0) {
            alert(`無法送出！\n第 ${commentsMissing.join(", ")} 項不合格之處未填寫原因說明！`);
            return;
        }
        
        if (!currentReport.signature && !signatureLocked) {
            alert("無法送出！\n請於審核人簽名區域手寫簽名，並點選「鎖定簽章」核准！");
            return;
        }
        
        if (signatureLocked) {
            currentReport.signature = signatureCanvas.toDataURL('image/png');
        }
        
        currentReport.isDraft = false;
        currentReport.timestamp = Date.now();
        
        saveReport(currentReport);
        viewReportDetail(currentReport.id);
        showToast("巡檢單已送出並正式存檔！");
    });

    bindClick('form-cancel-btn', () => {
        if (confirm("是否放棄填寫？")) {
            showScreen('dashboard-screen');
        }
    });

    // 5. Detail Action Events
    bindClick('detail-export-word-btn', exportReportToWord);
    bindClick('detail-print-btn', () => window.print());

    // 6. History Table Search Filter
    const searchInput = document.getElementById('search-history-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();
            const rows = document.querySelectorAll('#history-tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? 'table-row' : 'none';
            });
        });
    }

    // 7. Login Events
    bindClick('quick-login-btn', (e) => {
        e.preventDefault();
        login('admin', '123456');
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;
            login(u, p);
        });
    }

    bindClick('submit-login-btn', (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        login(u, p);
    });

    bindClick('logout-btn', () => {
        if (confirm("您確定要登出系統嗎？")) {
            localStorage.removeItem('inspection_user');
            currentUser = null;
            showScreen('login-screen');
        }
    });
}

// ==========================================================================
// 17. Run Setup Sequence on Load
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    try {
        // 1. Initialise CSS Theme Configurations
        initTheme();
        
        // 2. Load LocalStorage Data Arrays
        loadData();
        
        // 3. Setup Interactive Visual Elements
        initMarkupEvents();
        initSignatureEvents();
        
        // 4. Securely Bind All General Click & Submit Listeners
        initAppEvents();
        
        // 5. Auto Login redirection check
        checkAuth();
        
        showToast("美達食品巡檢系統載入完成！");
    } catch (e) {
        console.error("Initialization Critical Fail:", e);
        alert("系統載入模組時出錯！若您是在本機以雙擊 HTML 檔案開啟，部分舊型瀏覽器可能限制安全指令。\n詳細錯誤內容: " + e.message);
    }
});
