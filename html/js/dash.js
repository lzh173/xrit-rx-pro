'use strict';
/**
 *  dash.js
 *  https://github.com/lzh173/xrit-rx
 *
 *  Updates dashboard data through xrit-rx API
 */

var config = {};
var blocks = {
    vchan:    {
        width: 620,
        height: 180,
        title: "虚拟通道",
        update: block_vchan
    },
    time:     {
        width: 390,
        height: 180,
        title: "时间",
        update: null
    },
    latestimg:  {
        width: 500,
        height: 590,
        title: "最新图片",
        update: block_latestimg
    },
    schedule: {
        width: 510,
        height: 590,
        title: "计划表",
        update: block_schedule
    }
};
var vchans = {
    "GK-2A": {
        0:  ["FD", "圆盘图"],
        4:  ["ANT", "文本"],
        5:  ["ADD", "附加数据"],
        63: ["IDLE", "无数据"]
    }
};
var sch = [];  // Will be loaded from /api/schedule
var current_vcid;
var latest_image;
var utc_date = "20260627";

function init()
{
    print("正在启动面板...", "DASH");

    // Get config object from xrit-rx
    http_get("/api", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                config = data;

                // Configure dashboard
                if (!configure()) { return; }
                print("完成！", "DASH");
            })
        }
        else {
            print("获取配置失败", "CONF");
            return false;
        }
    });
}


/**
 * Configure dashboard
 */
function configure()
{
    // Write config object to console
    console.log(config);

    // Set heading and window title
    var heading = document.getElementById("dash-heading");
    heading.innerHTML =  `${config.spacecraft} ${config.downlink} 仪表板`;
    heading.innerHTML += `<span><a href="/viewer" target="_blank" style="color:#f5a623;margin-right:12px;" title="打开产品查看器">📂 浏览产品</a> xrit-rx <a href="https://github.com/lzh173/xrit-rx/releases/tag/v${config.version}" target="_blank" title="在 GitHub 上查看发布说明">v${config.version}</a></span>`;
    document.title = `${config.spacecraft} ${config.downlink} - xrit-rx v${config.version}`;

    // Build blocks
    console.log(blocks);
    for (var block in blocks) {
        var el = document.getElementById(`block-${block}`);
        blocks[block].body = el.children[1];

        // Set block size
        el.style.width  = `${blocks[block].width}px`;
        el.style.height = `${blocks[block].height}px`;

        // Set block heading
        el.children[0].innerText = blocks[block].title;
    }

    // Parse and build schedule
    if (config.spacecraft == "GK-2A") { get_schedule() };

    // Setup clock loop
    setInterval(() => {
        block_time(blocks.time.body);
    }, 100);
    block_time(blocks.time.body);

    // Setup polling loop
    setInterval(poll, config.interval * 1000);
    poll();
    poll();

    return true;
}


/**
 * Poll xrit-rx API for updated data
 */
function poll()
{
    // Get current VCID
    http_get("/api/current/vcid", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                current_vcid = data['vcid'];
            });
        }
        else {
            print("获取当前 VCID 失败", "POLL");
            return false;
        }
    });

    // Get last image
    http_get("/api/latest/image", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                latest_image = data['image'];
            });
        }
        else {
            print("获取最新图片失败", "POLL");
            return false;
        }
    });

    // Call update function for each block
    for (var block in blocks) {
        if (blocks[block].update != null) {
            blocks[block].update(blocks[block].body);
        }
    }
}


/**
 * Initialize schedule table from hardcoded data
 */
function get_schedule()
{
    // Create schedule table
    var table = document.createElement("table");
    table.className = "schedule";
    table.appendChild(document.createElement("tbody"));

    // Table header
    var header = table.createTHead();
    var row = header.insertRow(0);
    row.insertCell(0).innerHTML = "开始时间 (UTC)";
    row.insertCell(1).innerHTML = "结束时间 (UTC)";
    row.insertCell(2).innerHTML = "类型";
    row.insertCell(3).innerHTML = "序号";

    // Add table to document
    var element = blocks['schedule'].body;
    element.innerHTML = "";
    element.appendChild(table);

    // Fetch schedule data from API
    http_get("/api/schedule", (res) => {
        if (res.status == 200) {
            res.json().then((data) => {
                // Filter out EGMSG (emergency messages, rarely transmitted)
                sch = data.filter(function(e) { return e[2] !== 'EGMSG'; });
                print("已加载（" + sch.length + " 条记录）", "SCHD");
            });
        }
        else {
            print("加载计划表失败", "SCHD");
        }
    });
}


/**
 * Update Virtual Channel block
 */
function block_vchan(element)
{
    // Check block has been built
    if (element.innerHTML == "") {
        for (var ch in vchans[config.spacecraft]) {
            var indicator = document.createElement("span");
            indicator.className = "vchan";
            indicator.id = `vcid-${ch}`
            indicator.title = vchans[config.spacecraft][ch][1];

            var name = vchans[config.spacecraft][ch][0];
            indicator.innerHTML = `<span>${name}</span><p>VCID ${ch}</p>`;

            // Set 'disabled' attribute on blacklisted VCIDs
            if (config.vcid_blacklist.indexOf(parseInt(ch)) > -1) {
                indicator.setAttribute("disabled", "");
                indicator.title += "（已列入黑名单）";
            }

            element.appendChild(indicator);
        }
    }
    else {  // Update block
        for (var ch in vchans[config.spacecraft]) {
            // Do not update blacklisted channels
            if (config.vcid_blacklist.indexOf(parseInt(ch)) > -1) { continue; }

            // Update active channel
            if (ch == current_vcid) {
                document.getElementById(`vcid-${ch}`).setAttribute("active", "");
            }
            else {
                document.getElementById(`vcid-${ch}`).removeAttribute("active");
            }
        }
    }
}


/**
 * Update Time block
 */
function block_time(element)
{
    var local = element.children[0];
    var utc = element.children[1];

    local.innerHTML = `${get_time_local()}<br><span title="UTC ${get_time_utc_offset()}">本地</span>`;
    utc.innerHTML = `${get_time_utc()}<br><span>UTC</span>`;
}


/**
 * Update Latest Image block
 */
function block_latestimg(element)
{
    var img = element.children[0].children[0];
    var link = element.children[0];
    var cap = element.children[2];

    if (latest_image) {
        var url = `/api/${latest_image}`;
        var fname = url.split('/');
        fname = fname[fname.length - 1];
        var ext = fname.split('.')[1];
        fname = fname.split('.')[0];

        // Set <img> src attribute
        if (ext != "txt") {
            // Only update image element if URL has changed
            if (img.getAttribute("src") != url) {
                img.setAttribute("src", url);
                link.setAttribute("href", url);
                cap.innerText = fname;
            }
        }
    }
    else {
        // Check image output is enabled
        if (config.images == false) {
            cap.innerHTML = "xrit-rx 中已禁用图像输出<br><br>请检查密钥文件是否存在，并在 <code>xrit-rx.ini</code> 配置文件中设置 <code>images = true</code>";
        }
        else {
            link.innerHTML = "<img class=\"latestimg\">";
            link.setAttribute("href", "#");
            cap.innerText = "等待图像...";
        }
    }
}


/**
 * Update Schedule block
 */
function block_schedule(element)
{
    // Check schedule has been loaded
    if (sch.length == 0) { return; }

    // Add spacecraft and downlink to block header
    var header = element.parentNode.children[0];
    header.innerHTML = `${config.spacecraft} ${config.downlink} 计划表`;

    // Get current UTC time
    var time = get_time_utc().replace(/:/g, "");

    // Get table body element
    var body = element.children[0].children[1];

    // Find first entry to add to table
    var first;
    for (var entry in sch) {
        var start = sch[entry][0];
        var end = sch[entry][1];

        if (time < start) {
            first = Math.max(0, parseInt(entry) - 3);
            break;
        }
    }

    body.innerHTML = "";
    for (var i = first; i < first + 12; i++) {
        // Limit index
        if (i >= sch.length) { break; }

        var start = sch[i][0];
        var end = sch[i][1];
        var row = body.insertRow();

        // Add cells to row
        row.insertCell().innerHTML = `${sch[i][0].substr(0, 2)}:${sch[i][0].substr(2, 2)}:${sch[i][0].substr(4, 2)}`;
        row.insertCell().innerHTML = `${sch[i][1].substr(0, 2)}:${sch[i][1].substr(2, 2)}:${sch[i][1].substr(4, 2)}`;
        row.insertCell().innerHTML = sch[i][2];
        row.insertCell().innerHTML = sch[i][3];

        // Set past entries as disabled (except last entry)
        if (time > start && i != sch.length - 1) {
            row.removeAttribute("active", "");
            row.setAttribute("disabled", "");
        }

        // Set current entry as active
        if (time > start && time < end) {
            row.removeAttribute("disabled", "");
            row.setAttribute("active", "");
        }
    }
}
