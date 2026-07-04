"""
dash.py
https://github.com/lzh173/xrit-rx

Dashboard HTTP server
"""

from colorama import Fore, Back, Style
import http.server
import json
import mimetypes
import os
import socketserver
import glob
from threading import Thread

dash_config = None
demuxer_instance = None


def _np(path):
    """Normalize path to use forward slashes (cross-platform compat for URLs)."""
    return path.replace("\\", "/") if path else path


def scan_latest_fd(output_path):
    """Scan received directory for the latest FD image."""
    base = os.path.join(output_path, "LRIT")
    if not os.path.isdir(base):
        return None, None
    dates = sorted([d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))], reverse=True)
    for date in dates:
        fd_dir = os.path.join(base, date, "FD")
        if os.path.isdir(fd_dir):
            files = sorted([f for f in os.listdir(fd_dir) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
            if files:
                return _np(os.path.join(fd_dir, files[0])), date
    return None, None


def scan_latest_fc(output_path):
    """Scan for the latest FD/FC image."""
    base = os.path.join(output_path, "LRIT")
    if not os.path.isdir(base):
        return None
    dates = sorted([d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))], reverse=True)
    for date in dates:
        fc_dir = os.path.join(base, date, "FD", "FC")
        if os.path.isdir(fc_dir):
            files = sorted([f for f in os.listdir(fc_dir) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
            if files:
                return _np(os.path.join(fc_dir, files[0]))
    return None


def scan_latest_ire(output_path):
    """Scan for the latest FD/IRE image."""
    base = os.path.join(output_path, "LRIT")
    if not os.path.isdir(base):
        return None
    dates = sorted([d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))], reverse=True)
    for date in dates:
        ire_dir = os.path.join(base, date, "FD", "IRE")
        if os.path.isdir(ire_dir):
            files = sorted([f for f in os.listdir(ire_dir) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
            if files:
                return _np(os.path.join(ire_dir, files[0]))
    return None


def scan_latest_add(output_path):
    """Scan for the latest ADD image (any non-FD/ANT directory)."""
    base = os.path.join(output_path, "LRIT")
    if not os.path.isdir(base):
        return None
    skip_dirs = {'FD', 'ANT', 'LRIT_FILE', 'FC', 'IRE'}
    dates = sorted([d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))], reverse=True)
    for date in dates:
        date_dir = os.path.join(base, date)
        for d in sorted(os.listdir(date_dir)):
            if d in skip_dirs:
                continue
            sub = os.path.join(date_dir, d)
            if os.path.isdir(sub):
                files = sorted([f for f in os.listdir(sub) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
                if files:
                    return _np(os.path.join(sub, files[0]))
    return None


def get_available_dates(output_path):
    """Get list of available date directories with product counts."""
    base = os.path.join(output_path, "LRIT")
    if not os.path.isdir(base):
        return []
    dates = []
    for d in sorted(os.listdir(base), reverse=True):
        date_dir = os.path.join(base, d)
        if os.path.isdir(date_dir):
            count = 0
            for root, dirs, files in os.walk(date_dir):
                for f in files:
                    if f.lower().endswith(('.jpg', '.png')):
                        count += 1
            if count > 0:
                dates.append({"date": d, "count": count})
            else:
                dates.append({"date": d, "count": 0})
    return dates


class Dashboard:
    def __init__(self, config, demuxer):
        global dash_config
        global demuxer_instance

        dash_config = config
        demuxer_instance = demuxer

        try:
            self.socket = socketserver.TCPServer(("", int(dash_config.port)), Handler)
        except OSError as e:
            if e.errno == 10048:
                print("\n" + Fore.WHITE + Back.RED + Style.BRIGHT + "仪表板未启动：端口已被占用")
            else:
                print(e)
            return

        # Print offline mode status
        if dash_config.offline:
            print("产品查看器 HTTP 服务器已启动（端口 {}）".format(dash_config.port))

        # Start HTTP server thread
        self.httpd_thread = Thread()
        self.httpd_thread.name = "HTTP SERVER"
        self.httpd_thread.run = self.http_server
        self.httpd_thread.start()


    def http_server(self):
        """
        HTTP server and request handler thread
        """

        self.socket.serve_forever()


    def stop(self):
        """
        Stops the HTTP server thread
        """

        try:
            self.socket.shutdown()
        except AttributeError:
            return


class Handler(http.server.SimpleHTTPRequestHandler):
    """
    Custom HTTP request handler
    """

    def __init__(self, request, client_address, server):
        try:
            super().__init__(request, client_address, server)
        except ConnectionResetError:
            return


    def do_GET(self):
        """
        Respond to GET requests
        """

        # Offline mode root: serve product viewer
        if self.path == "/" and dash_config.offline:
            self.path = "offline-viewer.html"
        elif self.path == "/":
            self.path = "index.html"

        try:
            # --- Image endpoints (work in both online and offline mode) ---
            if self.path == "/latest":
                if dash_config.offline:
                    fp, _ = scan_latest_fd(dash_config.output)
                else:
                    fp = demuxer_instance.lastImageFD if demuxer_instance else None
                self.serve_latest(fp)
                return

            if self.path == "/latest_add":
                if dash_config.offline:
                    fp = scan_latest_add(dash_config.output)
                else:
                    fp = demuxer_instance.lastImageADD if demuxer_instance else None
                self.serve_latest(fp)
                return

            if self.path == "/latest_FDFC":
                if dash_config.offline:
                    fp = scan_latest_fc(dash_config.output)
                else:
                    fp = None
                    fd_img = demuxer_instance.lastImageFD if demuxer_instance else None
                    if fd_img:
                        fc_dir = os.path.join(os.path.dirname(fd_img), "FC")
                        if os.path.isdir(fc_dir):
                            fc_files = [f for f in os.listdir(fc_dir) if f.lower().endswith('.jpg') or f.lower().endswith('.png')]
                            if fc_files:
                                fc_files.sort(reverse=True)
                                fp = os.path.join(fc_dir, fc_files[0])
                self.serve_latest(fp)
                return

            if self.path == "/latest_FDIRE":
                if dash_config.offline:
                    fp = scan_latest_ire(dash_config.output)
                else:
                    fp = None
                    fd_img = demuxer_instance.lastImageFD if demuxer_instance else None
                    if fd_img:
                        ire_dir = os.path.join(os.path.dirname(fd_img), "IRE")
                        if os.path.isdir(ire_dir):
                            ire_files = [f for f in os.listdir(ire_dir) if f.lower().endswith('.jpg') or f.lower().endswith('.png')]
                            if ire_files:
                                ire_files.sort(reverse=True)
                                fp = os.path.join(ire_dir, ire_files[0])
                self.serve_latest(fp)
                return

            # Serve API list page
            if self.path == "/apilist":
                self.serve_apilist()
                return

            # --- API endpoints ---
            if self.path.startswith("/api/") or self.path == "/api":
                content, status, mime = self.handle_api(self.path)

                self.send_response(status)
                self.send_header('Content-type', mime)
                self.end_headers()
                self.wfile.write(content)
            else:                                                       # Local file requests
                self.path = "html/{}".format(self.path)

                if os.path.isfile(self.path):                           # Requested file exists (HTTP 200)
                    self.send_response(200)
                    mime = mimetypes.guess_type(self.path)[0]
                    # Force UTF-8 charset for HTML files
                    if mime == "text/html":
                        mime = "text/html; charset=utf-8"
                    self.send_header('Content-type', mime)
                    self.end_headers()

                    self.wfile.write(
                        open(self.path, 'rb').read()
                    )
                else:                                                   # Requested file not found (HTTP 404)
                    self.send_response(404)
                    self.end_headers()
        except ConnectionAbortedError:
            return


    def serve_latest(self, filepath):
        """
        Serve the latest image file directly as binary
        """

        if filepath and os.path.isfile(filepath):
            self.send_response(200)
            mime = mimetypes.guess_type(filepath)[0]
            self.send_header('Content-type', mime)
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()


    def serve_apilist(self):
        """
        Serve a simple API navigation page
        """

        host = self.headers.get("Host", "localhost:1692")
        mode_label = "离线浏览" if dash_config.offline else "正常接收"
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>xrit-rx API 导航</title>
    <style>
        body {{ font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; margin: 0; padding: 40px; }}
        h1 {{ color: #e94560; }}
        h2 {{ color: #f5a623; margin-top: 30px; }}
        a {{ color: #0f3460; background: #e94560; padding: 8px 20px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 6px 0; font-weight: bold; }}
        a:hover {{ background: #ff6b7f; }}
        code {{ background: #16213e; padding: 2px 8px; border-radius: 4px; color: #f5a623; }}
        .desc {{ color: #aaa; margin-left: 12px; font-size: 14px; }}
        .endpoint {{ margin: 10px 0; }}
        .mode {{ display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 13px; margin-left: 12px; }}
        .offline {{ background: #f5a623; color: #1a1a2e; }}
        .online {{ background: #2ecc71; color: #1a1a2e; }}
    </style>
</head>
<body>
    <h1>🌐 xrit-rx API 接口导航 <span class="mode {'offline' if dash_config.offline else 'online'}">{mode_label}</span></h1>

    <h2>🖼️ 图片直出端点（浏览器直接打开）</h2>
    <div class="endpoint"><a href="http://{host}/latest" target="_blank">/latest</a> <span class="desc">最新全盘原图（FD）</span></div>
    <div class="endpoint"><a href="http://{host}/latest_FDFC" target="_blank">/latest_FDFC</a> <span class="desc">最新假彩色（FD/FC）</span></div>
    <div class="endpoint"><a href="http://{host}/latest_FDIRE" target="_blank">/latest_FDIRE</a> <span class="desc">最新红外增强（FD/IRE）</span></div>
    <div class="endpoint"><a href="http://{host}/latest_add" target="_blank">/latest_add</a> <span class="desc">最新附加数据图片</span></div>

    <h2>📡 API 接口（返回 JSON）</h2>
    <div class="endpoint"><a href="http://{host}/api" target="_blank">/api</a> <span class="desc">配置信息</span></div>
    <div class="endpoint"><a href="http://{host}/api/current/vcid" target="_blank">/api/current/vcid</a> <span class="desc">当前 VCID</span></div>
    <div class="endpoint"><a href="http://{host}/api/latest/image" target="_blank">/api/latest/image</a> <span class="desc">最新图片路径</span></div>
    <div class="endpoint"><a href="http://{host}/api/latest/fd" target="_blank">/api/latest/fd</a> <span class="desc">最新 FD 路径</span></div>
    <div class="endpoint"><a href="http://{host}/api/latest/add" target="_blank">/api/latest/add</a> <span class="desc">最新 ADD 路径</span></div>
    <div class="endpoint"><a href="http://{host}/api/latest/xrit" target="_blank">/api/latest/xrit</a> <span class="desc">最新 xRIT 文件路径</span></div>

    <h2>📊 Web 仪表板</h2>
    <div class="endpoint"><a href="http://{host}/" target="_blank">/</a> <span class="desc">xrit-rx {"离线产品查看器" if dash_config.offline else "仪表板主页"}</span></div>

    <p style="margin-top: 40px; color: #666; font-size: 13px;">xrit-rx · <a href="https://github.com/lzh173/xrit-rx" style="background: none; padding: 0; color: #e94560; display: inline;">GitHub</a></p>
</body>
</html>"""
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))


    def handle_api(self, path):
        """
        Handle API endpoint request
        """

        # Base response object
        content = b''
        status = 404
        mime = "application/json"

        # Requested endpoint path
        path = path.replace("/api", "").split("/")
        path = None if len(path) == 1 else path[1:]

        if path == None:                                        # Root API endpoint
            content = {
                'version': dash_config.version,
                'spacecraft': dash_config.spacecraft,
                'downlink': dash_config.downlink,
                'vcid_blacklist': dash_config.blacklist,
                'output_path': dash_config.output,
                'images': dash_config.images,
                'xrit': dash_config.xrit,
                'interval': int(dash_config.interval),
                'offline': dash_config.offline
            }

        elif "/".join(path).startswith(dash_config.output):     # Endpoint starts with demuxer output root path
            path = "/".join(path)
            if (os.path.isfile(path)):
                mime = mimetypes.guess_type(path)[0]
                content = open(path, 'rb').read()

        elif path[0] == "current" and len(path) == 2:
            if path[1] == "vcid":
                vcid = demuxer_instance.currentVCID if demuxer_instance else None
                content = {
                    'vcid': vcid
                }

        elif path[0] == "latest" and len(path) == 2:
            if path[1] == "image":
                img = demuxer_instance.lastImage if demuxer_instance else None
                content = {
                    'image': img
                }
            elif path[1] == "fd":
                img = demuxer_instance.lastImageFD if demuxer_instance else None
                content = {
                    'image': img
                }
            elif path[1] == "add":
                img = demuxer_instance.lastImageADD if demuxer_instance else None
                content = {
                    'image': img
                }
            elif path[1] == "xrit":
                xrit = demuxer_instance.lastXRIT if demuxer_instance else None
                content = {
                    'xrit': xrit
                }

        elif path[0] == "offline" and dash_config.offline:
            if len(path) == 2 and path[1] == "dates":
                content = get_available_dates(dash_config.output)
            elif len(path) == 3 and path[1] == "date":
                target_date = path[2]
                content = self.get_date_products(target_date)
            elif len(path) == 4 and path[1] == "image":
                # /api/offline/image/YYYYMMDD/FD or /api/offline/image/YYYYMMDD/FC etc.
                target_date = path[2]
                img_type = path[3].upper()
                base = os.path.join(dash_config.output, "LRIT", target_date)
                if img_type == "FD":
                    fd_dir = os.path.join(base, "FD")
                    if os.path.isdir(fd_dir):
                        files = sorted([f for f in os.listdir(fd_dir) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
                        if files:
                            content = {"path": os.path.join(fd_dir, files[0])}
                elif img_type == "FC":
                    fc_dir = os.path.join(base, "FD", "FC")
                    if os.path.isdir(fc_dir):
                        files = sorted([f for f in os.listdir(fc_dir) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
                        if files:
                            content = {"path": os.path.join(fc_dir, files[0])}
                elif img_type == "IRE":
                    ire_dir = os.path.join(base, "FD", "IRE")
                    if os.path.isdir(ire_dir):
                        files = sorted([f for f in os.listdir(ire_dir) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
                        if files:
                            content = {"path": os.path.join(ire_dir, files[0])}
                elif img_type == "ADD":
                    skip_dirs = {'FD', 'ANT', 'LRIT_FILE', 'FC', 'IRE'}
                    for d in sorted(os.listdir(base)):
                        if d in skip_dirs: continue
                        sub = os.path.join(base, d)
                        if os.path.isdir(sub):
                            files = sorted([f for f in os.listdir(sub) if f.lower().endswith(('.jpg', '.png'))], reverse=True)
                            if files:
                                content = {"path": os.path.join(sub, files[0])}
                                break

        # Send HTTP 200 OK if content has been updated
        if content != b'': status = 200

        # Convert Python dict/list into JSON string
        if isinstance(content, (dict, list)):
            content = json.dumps(content, sort_keys=False, ensure_ascii=False).encode('utf-8')

        # Return response bytes, HTTP status code and content MIME type
        return content, status, mime


    def get_date_products(self, target_date):
        """Get all products available for a specific date."""
        base = os.path.join(dash_config.output, "LRIT", target_date)
        if not os.path.isdir(base):
            return {"date": target_date, "products": []}

        products = []
        skip_dirs = {'LRIT_FILE'}
        for d in sorted(os.listdir(base)):
            if d in skip_dirs: continue
            sub = os.path.join(base, d)
            if os.path.isdir(sub):
                item = {"name": d, "type": "directory", "files": []}
                for f in sorted(os.listdir(sub)):
                    fpath = os.path.join(sub, f)
                    if os.path.isfile(fpath) and f.lower().endswith(('.jpg', '.png')):
                        info = {"name": f, "path": _np(fpath)}
                        # Check FC subdirectory
                        fc_path = os.path.join(sub, "FC", f)
                        if os.path.isfile(fc_path):
                            info["fc"] = _np(fc_path)
                        ire_path = os.path.join(sub, "IRE", f)
                        if os.path.isfile(ire_path):
                            info["ire"] = _np(ire_path)
                        item["files"].append(info)
                if item["files"]:
                    products.append(item)
        return {"date": target_date, "products": products}


    def log_message(self, format, *args):
        """
        Silence HTTP server log messages
        """

        #super().log_message(format, *args)
        return
