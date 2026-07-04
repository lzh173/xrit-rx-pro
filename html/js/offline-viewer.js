'use strict';
/**
 *  offline-viewer.js
 *  https://github.com/lzh173/xrit-rx
 *
 *  Offline product viewer for received satellite images
 */

var config = {};
var dates = [];
var currentDate = null;
var currentFile = null;      // Currently selected file info {name, path, fc?, ire?}
var currentType = 'FD';      // 'FD' | 'FC' | 'IRE' | (product name for non-FD)
var allProducts = [];        // Raw products array for current date
var refreshTimer = null;
var isViewingLatest = true;
var pollInterval = 30;

var typeLabels = {
    'FD': '原图',
    'FC': '假彩色',
    'IRE': '红外增强'
};

function init()
{
    print("正在启动离线产品查看器...", "VIEWER");

    http_get("/api", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                config = data;
                configure();
            });
        }
        else {
            print("获取配置失败", "CONF");
            document.getElementById("viewer-body").innerHTML =
                '<div class="empty-msg"><div class="big-icon">⚠</div><p>无法连接到 xrit-rx 服务</p></div>';
        }
    });
}


function configure()
{
    console.log(config);

    var heading = document.getElementById("dash-heading");
    heading.innerHTML = `${config.spacecraft} ${config.downlink} 离线产品查看器`;
    heading.innerHTML += `<span>xrit-rx <a href="https://github.com/lzh173/xrit-rx" target="_blank">v${config.version}</a></span>`;
    document.title = `${config.spacecraft} ${config.downlink} - xrit-rx 离线查看器`;

    setInterval(() => { block_time(); }, 100);
    block_time();

    // Set time block heading
    var timeHeading = document.querySelector('#block-time .block-heading');
    if (timeHeading) timeHeading.textContent = '时间';

    loadDates();
}


function loadDates()
{
    http_get("/api/offline/dates", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                dates = data;
                if (dates.length > 0) {
                    currentDate = dates[0].date;
                    print("已加载日期：" + currentDate, "VIEWER");
                    loadDateProducts(currentDate);
                }
                else {
                    showEmpty("暂无已接收的产品数据<br><span style='font-size:14px;color:#666;'>请先在正常模式下运行 xrit-rx 接收数据</span>");
                }
            });
        }
        else {
            print("获取日期列表失败", "VIEWER");
            showEmpty("无法获取产品日期列表");
        }
    });
}


function loadDateProducts(date)
{
    currentDate = date;
    isViewingLatest = (dates.length > 0 && date == dates[0].date);
    print("正在加载：" + date, "VIEWER");

    http_get(`/api/offline/date/${date}`, (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                renderViewer(data);
            });
        }
        else {
            showEmpty("该日期无可用产品");
        }
    });
}


function renderViewer(data)
{
    allProducts = data.products || [];
    var body = document.getElementById("viewer-body");
    var hasFD = false;

    // Find FD files
    var fdProduct = null;
    var nonFD = [];
    allProducts.forEach(function(p) {
        if (p.name == 'FD') {
            fdProduct = p;
        } else if (p.name != 'ANT' && p.files && p.files.length > 0) {
            nonFD.push(p);
        }
    });

    if (!fdProduct || !fdProduct.files || fdProduct.files.length === 0) {
        showEmpty("该日期暂无全盘图（FD）数据");
        return;
    }

    var fdFiles = fdProduct.files;

    // Check if currentFile still exists in this date's data
    var fileStillExists = false;
    if (currentFile) {
        for (var pi = 0; pi < allProducts.length && !fileStillExists; pi++) {
            var pf = allProducts[pi].files || [];
            for (var fi = 0; fi < pf.length && !fileStillExists; fi++) {
                if (pf[fi].path === currentFile.path) fileStillExists = true;
            }
        }
    }

    if (!currentFile || !fileStillExists) {
        currentFile = fdFiles[fdFiles.length - 1];
        currentType = 'FD';
    }

    // Build UI
    var html = '';

    // ——— Date nav ———
    html += '<div class="date-nav">';
    html += '  <button class="nav-btn" id="btn-prev" onclick="navigateDate(-1)">◀</button>';
    html += '  <span class="date-label" id="date-label">' + formatDate(currentDate) + '</span>';
    html += '  <button class="nav-btn" id="btn-next" onclick="navigateDate(1)">▶</button>';
    html += '</div>';

    // ——— Split ———
    html += '<div class="viewer-split">';

    // ——— Product list (left) ———
    html += '  <div class="product-list" id="product-list">';

    // FD group
    html += '    <div class="product-group">';
    html += '      <div class="group-header">FD (' + fdFiles.length + ')</div>';
    fdFiles.forEach(function(f, idx) {
        var num = f.name.replace(/^IMG_FD_(\d+).*$/, '$1');
        var isActive = (currentFile.path === f.path) ? ' active' : '';
        html += '      <div class="product-item' + isActive + '" onclick="selectFile(\'' + f.path.replace(/'/g, "\\'") + '\')">';
        html += '        <span class="item-num">#' + num + '</span>' + formatTimeFromFilename(f.name);
        html += '      </div>';
    });
    html += '    </div>';

    // Non-FD groups
    nonFD.forEach(function(p) {
        html += '    <div class="product-group">';
        html += '      <div class="group-header">' + p.name + ' (' + p.files.length + ')</div>';
        p.files.forEach(function(f) {
            var isActive = (currentFile.path === f.path) ? ' active' : '';
            html += '      <div class="product-item' + isActive + '" onclick="selectFile(\'' + f.path.replace(/'/g, "\\'") + '\')">';
            html += '        ' + formatTimeFromFilename(f.name);
            html += '      </div>';
        });
        html += '    </div>';
    });

    html += '  </div>';

    // ——— Main image area (right) ———
    html += '  <div class="main-area">';

    // Type selector
    html += '    <div class="type-selector" id="type-selector">';
    html += '      <button class="type-btn active" data-type="FD" onclick="switchType(\'FD\')">🖼 原图</button>';
    var hasFC = currentFile && currentFile.fc ? true : false;
    var hasIRE = currentFile && currentFile.ire ? true : false;
    html += '      <button class="type-btn' + (hasFC ? '' : ' disabled') + '" data-type="FC" onclick="switchType(\'FC\')">🎨 假彩色</button>';
    html += '      <button class="type-btn' + (hasIRE ? '' : ' disabled') + '" data-type="IRE" onclick="switchType(\'IRE\')">🔥 红外增强</button>';
    html += '    </div>';

    // Main image
    var imgSrc = getCurrentImageUrl();
    html += '    <div class="main-image-wrap">';
    html += '      <img id="main-img" src="' + imgSrc + '" alt="image" onerror="handleImgError()">';
    html += '      <div class="img-error" id="img-error">图片加载失败</div>';
    html += '    </div>';

    // Info bar
    html += '    <div class="image-info">';
    html += '      <span class="info-type" id="info-type">' + (currentFile.name.match(/^IMG_FD_(\d+)/) ? 'FD #' + RegExp.$1 : currentFile.name) + '</span>';
    html += '      <span class="info-file" id="info-file">' + currentFile.name + '</span>';
    html += '      <span class="info-date">' + formatDate(currentDate) + '</span>';
    html += '      <span><a href="' + imgSrc + '" target="_blank" id="info-link">打开原图</a></span>';
    html += '    </div>';

    html += '  </div>'; // end main-area
    html += '</div>';   // end viewer-split

    body.innerHTML = html;

    updateNavButtons();

    // Schedule next refresh if on latest date
    cancelRefresh();
    if (isViewingLatest) {
        refreshTimer = setTimeout(refreshLatest, pollInterval * 1000);
    }
}


function selectFile(path)
{
    // Find which product this file belongs to
    for (var pi = 0; pi < allProducts.length; pi++) {
        var p = allProducts[pi];
        for (var fi = 0; fi < (p.files || []).length; fi++) {
            if (p.files[fi].path === path) {
                currentFile = p.files[fi];
                currentType = p.name === 'FD' ? 'FD' : p.name;
                renderViewer({"products": allProducts});
                return;
            }
        }
    }
}


function switchType(type)
{
    if (!currentFile) return;

    // For non-FD files, only "original" is valid
    if (currentFile.name.indexOf('FD') === -1 && type !== 'FD') return;

    if (type === 'FC' && !currentFile.fc) return;
    if (type === 'IRE' && !currentFile.ire) return;

    currentType = type;

    var img = document.getElementById("main-img");
    var errDiv = document.getElementById("img-error");
    if (img) {
        img.style.display = 'block';
        if (errDiv) errDiv.style.display = 'none';
        img.src = getCurrentImageUrl();
        document.getElementById("info-link").href = img.src;
    }

    // Update info
    var typeLabel = typeLabels[type] || type;
    var match = currentFile.name.match(/^IMG_FD_(\d+)/);
    if (match) {
        document.getElementById("info-type").textContent = 'FD #' + match[1] + ' ' + typeLabel;
    } else {
        document.getElementById("info-type").textContent = currentFile.name;
    }

    // Update type buttons
    document.querySelectorAll('#type-selector .type-btn').forEach(function(btn) {
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}


function getCurrentImageUrl()
{
    if (!currentFile) return '';
    var path = currentFile.path;
    if (currentType === 'FC' && currentFile.fc) path = currentFile.fc;
    if (currentType === 'IRE' && currentFile.ire) path = currentFile.ire;
    return '/api/' + path.replace(/\\/g, '/');
}


function handleImgError()
{
    var errDiv = document.getElementById("img-error");
    if (errDiv) errDiv.style.display = 'block';
}


function formatTimeFromFilename(name)
{
    // Extract HHMMSS from filename like IMG_FD_025_IR105_20260704_041006.jpg
    var parts = name.split('_');
    for (var i = parts.length - 1; i >= 0; i--) {
        if (/^\d{6}\./.test(parts[i]) || /^\d{6}$/.test(parts[i])) {
            return parts[i].substr(0, 2) + ':' + parts[i].substr(2, 2) + ':' + parts[i].substr(4, 2);
        }
        if (/^\d{6}\.\w{3,4}$/.test(parts[i])) {
            return parts[i].substr(0, 2) + ':' + parts[i].substr(2, 2) + ':' + parts[i].substr(4, 2);
        }
    }
    return name;
}


function navigateDate(direction)
{
    var idx = dates.findIndex(function(d) { return d.date == currentDate; });
    if (idx === -1) return;

    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= dates.length) return;

    currentDate = dates[newIdx].date;
    isViewingLatest = (newIdx === 0);
    loadDateProducts(currentDate);
}


function updateNavButtons()
{
    var idx = dates.findIndex(function(d) { return d.date == currentDate; });
    var prevBtn = document.getElementById("btn-prev");
    var nextBtn = document.getElementById("btn-next");
    if (prevBtn) prevBtn.disabled = (idx <= 0);
    if (nextBtn) nextBtn.disabled = (idx >= dates.length - 1);
}


function cancelRefresh()
{
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
}


function refreshLatest()
{
    if (dates.length === 0 || !isViewingLatest) return;

    http_get("/api/offline/dates", (res) => {
        if (res.status === 200) {
            res.json().then((data) => {
                if (!isViewingLatest) return;

                var prevDate = currentDate;
                dates = data;

                if (dates.length > 0) {
                    var latestDate = dates[0].date;
                    if (latestDate !== prevDate) {
                        currentDate = latestDate;
                        var lbl = document.getElementById("date-label");
                        if (lbl) lbl.textContent = formatDate(currentDate);
                        loadDateProducts(latestDate);
                        return;
                    } else {
                        http_get("/api/offline/date/" + currentDate, (res) => {
                            if (res.status === 200) {
                                res.json().then((data) => {
                                    if (!isViewingLatest) return;

                                    var products = data.products || [];
                                    var fdProd = null;
                                    products.forEach(function(p) { if (p.name === 'FD') fdProd = p; });

                                    var oldPath = currentFile ? currentFile.path : '';
                                    var newLatestPath = (fdProd && fdProd.files && fdProd.files.length > 0)
                                        ? fdProd.files[fdProd.files.length - 1].path : '';

                                    // If a new FD image arrived
                                    if (newLatestPath && newLatestPath !== oldPath) {
                                        currentFile = fdProd.files[fdProd.files.length - 1];
                                        currentType = 'FD';
                                        renderViewer(data);
                                        print("检测到新图片", "VIEWER");
                                    } else {
                                        // Just update data in background without re-render
                                        allProducts = products;
                                    }
                                });
                            }
                        });
                    }
                }

                refreshTimer = setTimeout(refreshLatest, pollInterval * 1000);
            });
        }
    });
}


function formatDate(dateStr)
{
    if (!dateStr) return '-';
    return dateStr.substr(0, 4) + '-' + dateStr.substr(4, 2) + '-' + dateStr.substr(6, 2);
}


function showEmpty(msg)
{
    var body = document.getElementById("viewer-body");
    body.innerHTML = '<div class="empty-msg"><div class="big-icon">📭</div><p>' + msg + '</p></div>';
}


/* ——————————— Time block ——————————— */
function block_time()
{
    var block = document.getElementById("block-time");
    if (!block) return;
    var els = block.children[1].children;
    if (els && els.length >= 2) {
        els[0].innerHTML = get_time_local() + '<br><span title="UTC ' + get_time_utc_offset() + '">本地</span>';
        els[1].innerHTML = get_time_utc() + '<br><span>UTC</span>';
    }
}
