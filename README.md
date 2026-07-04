# xrit-rx — LRIT/HRIT 下行链路处理器

> **GK-2A 气象卫星数据接收与处理**
>
> 基于 [sam210723/xrit-rx](https://github.com/sam210723/xrit-rx) 的深度汉化增强版 v2.0.0

## 📋 功能概览

| 功能 | 说明 |
|------|------|
| 📡 **数据源** | GOESRECV / Open Satellite Project / UDP / 文件回放 |
| 🧩 **解复用** | CCSDS VCDU → M_PDU → CP_PDU → TP_File → xRIT → 图片 |
| 🌐 **Web 仪表板** | 实时查看 VCID 通道、最新图片、日运行计划 |
| 🖼️ **图片直出 API** | `/latest`、`/latest_FDFC`、`/latest_FDIRE`、`/latest_add` |
| 🎨 **自动假彩色** | Full Disk 保存后自动用 Sanchez 生成球面假彩（FD/FC/）|
| 🔥 **自动红外增强** | Full Disk 保存后自动生成红外增强图（FD/IRE/）|
| 📂 **离线产品查看器** | `-offline` 模式浏览全部已接收产品（FD/FC/IRE/ADD）|
| 🔄 **断线重连** | TCP 连接断开后自动重试（指数退避，最多 5 次）|
| 🔔 **音频提示** | 丢包提示音 + 断联提示音 |
| 🇨🇳 **全界面汉化** | Python 后端 + Web 前端全部中文化 |

## 🚀 快速开始

### 环境要求

- Python 3.7+
- 依赖安装：

```bash
pip install -r requirements.txt
```

### 配置

编辑 `xrit-rx.ini`：

```ini
[rx]
spacecraft = GK-2A
mode = lrit              # LRIT (64 kbps) 或 HRIT (3 Mbps)
input = goesrecv         # 数据源

[goesrecv]
ip = 192.168.10.80       # goesrecv IP
vchan = 5004             # 虚拟通道端口

[dashboard]
enabled = true
port = 1692              # Web 仪表板端口
```

### 运行

```bash
# 正常接收模式
python xrit-rx.py

# 离线浏览模式（仅启动 Web 服务器，浏览已接收的产品）
python xrit-rx.py -offline
```

启动后访问：
- **仪表板**（正常模式）: `http://<IP>:1692/`
- **离线产品查看器**（`-offline` 模式）: `http://<IP>:1692/`
- **API 导航**: `http://<IP>:1692/apilist`

## 🌐 Web 端点

### 图片直出（浏览器可直接打开）

| 端点 | 描述 |
|------|------|
| `/latest` | 最新全盘原图 |
| `/latest_FDFC` | 最新假彩色（球面圆盘） |
| `/latest_FDIRE` | 最新红外增强 |
| `/latest_add` | 最新附加数据图片 |

### JSON API

| 端点 | 描述 |
|------|------|
| `/api` | 配置信息 |
| `/api/current/vcid` | 当前虚拟通道 ID |
| `/api/latest/image` | 最新图片路径 |
| `/api/latest/fd` | 最新全盘图片路径 |
| `/api/latest/add` | 最新附加数据路径 |
| `/api/latest/xrit` | 最新 xRIT 文件路径 |

### 离线模式 API

| 端点 | 描述 |
|------|------|
| `/api/offline/dates` | 可用日期列表（含产品数量） |
| `/api/offline/date/<YYYYMMDD>` | 指定日期的所有产品 |
| `/api/offline/image/<YYYYMMDD>/<TYPE>` | 指定日期和类型的图片路径 |

## 📁 输出目录结构

```
received/
└── LRIT/
    └── YYYYMMDD/            # 按日期归档
        ├── FD/
        │   ├── IMG_FD_xxx.jpg         # 全盘原图
        │   ├── FC/
        │   │   └── IMG_FD_xxx.jpg     # 假彩色（Sanchez 生成）
        │   └── IRE/
        │       └── IMG_FD_xxx.jpg     # 红外增强（enhance-ir 生成）
        ├── ANT/               # 字母数字文本
        ├── LRIT_FILE/         # 原始 xRIT 文件（可选）
        ├── GWW3F/             # 全球波浪模型
        ├── RWW3F/             # 区域波浪预报
        ├── RWW3M/             # 区域波浪分析
        ├── SSTA/              # 海面温度分析
        └── ...
```

## 🎮 命令行参数

| 参数 | 说明 |
|------|------|
| `--config <路径>` | 配置文件路径，默认 `xrit-rx.ini` |
| `--file <路径>` | 回放 VCDU 数据包文件 |
| `-v` | 详细控制台输出（调试用） |
| `--dump <路径>` | 将 VCDU 转储到文件（调试用） |
| `-offline` | **离线模式**：不连接数据源，仅启动 Web 产品查看器 |

### 离线模式

`-offline` 参数让你无需运行卫星接收链路即可浏览已接收的图片产品：

```bash
python xrit-rx.py -offline
```

功能：
- 扫描 `received/LRIT/YYYYMMDD/` 目录结构，展示所有可用日期
- **产品列表侧边栏**：按类型分组显示所有文件（FD 按编号、其他按类型）
- 支持浏览 FD 原图、FC 假彩色、IRE 红外增强、各类附加数据（GIF/PNG/JPEG）
- 日期前后切换导航
- 自动刷新检测新图片
- 完整的 `/latest`、`/latest_FDFC`、`/latest_FDIRE`、`/latest_add` API 支持

## 🔧 自定义

### 自动生成功能

FD 图片保存后自动触发：

1. **假彩色**（FC）— 使用 `tools/Sanchez/Sanchez.exe`
   - 命令: `Sanchez -s <input> -o <output>`
   - 输出目录: `FD/FC/`
   - 输出为球面圆盘投影（非方形）

2. **红外增强**（IRE）— 使用 `tools/enhance-ir.py`
   - 命令: `python enhance-ir.py <input> -s -o`
   - 输出目录: `FD/IRE/`

### 音频提示

| 事件 | 音调 | 时长 |
|------|------|------|
| 丢包 | 600 Hz | 200 ms |
| 连接断开 | 800 Hz | 500 ms |

## 🛠️ 工具脚本

| 脚本 | 用途 |
|------|------|
| `tools/enhance-ir.py` | GK-2A 红外彩色增强 |
| `tools/lrit-img.py` | LRIT IMG → JPEG（原始） |
| `tools/hrit-img.py` | HRIT IMG → JPEG |
| `tools/lrit-add.py` | 从 LRIT ADD 文件提取数据 |
| `tools/xrit-decrypt.py` | xRIT 文件 DES 解密 |
| `tools/keymsg-decrypt.py` | 解密 KMA 加密密钥消息 |

## 🏷️ 版本历史

| 版本 | 说明 |
|------|------|
| **v2.0.0** | 全界面汉化、离线模式、假彩色/红外增强自动生成、音频提示、多线程 HTTP |
| v1.3.1 | 原版最新版本（[sam210723/xrit-rx](https://github.com/sam210723/xrit-rx)） |

## 📜 开源协议

本项目基于 [GNU General Public License v3.0](LICENSE)。
