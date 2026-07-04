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
from threading import Thread

dash_config = None
demuxer_instance = None

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
                print("\n" + Fore.WHITE + Back.RED + Style.BRIGHT + "DASHBOARD NOT STARTED: PORT ALREADY IN USE")
            else:
                print(e)
            return

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

        # Respond with index.html content on root path requests
        if self.path == "/": self.path = "index.html"

        try:
            # Serve latest Full Disk original image directly
            if self.path == "/latest":
                self.serve_latest(demuxer_instance.lastImageFD)
                return

            # Serve latest Additional Data image directly
            if self.path == "/latest_add":
                self.serve_latest(demuxer_instance.lastImageADD)
                return

            # Serve latest False Color (FC) image directly
            if self.path == "/latest_FDFC":
                fd_img = demuxer_instance.lastImageFD
                if fd_img:
                    fc_dir = os.path.join(os.path.dirname(fd_img), "FC")
                    if os.path.isdir(fc_dir):
                        fc_files = [f for f in os.listdir(fc_dir) if f.lower().endswith('.jpg') or f.lower().endswith('.png')]
                        if fc_files:
                            fc_files.sort(reverse=True)
                            fc_path = os.path.join(fc_dir, fc_files[0])
                            self.serve_latest(fc_path)
                            return
                self.serve_latest(None)
                return

            # Serve latest Infrared Enhanced (IRE) image directly
            if self.path == "/latest_FDIRE":
                fd_img = demuxer_instance.lastImageFD
                if fd_img:
                    ire_dir = os.path.join(os.path.dirname(fd_img), "IRE")
                    if os.path.isdir(ire_dir):
                        ire_files = [f for f in os.listdir(ire_dir) if f.lower().endswith('.jpg') or f.lower().endswith('.png')]
                        if ire_files:
                            ire_files.sort(reverse=True)
                            ire_path = os.path.join(ire_dir, ire_files[0])
                            self.serve_latest(ire_path)
                            return
                self.serve_latest(None)
                return

            # Serve API list page
            if self.path == "/apilist":
                self.serve_apilist()
                return

            if self.path.startswith("/api/") or self.path == "/api":    # API endpoint requests
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
    </style>
</head>
<body>
    <h1>🌐 xrit-rx API 接口导航</h1>

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
    <div class="endpoint"><a href="http://{host}/" target="_blank">/</a> <span class="desc">xrit-rx 仪表板主页</span></div>

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
                'interval': int(dash_config.interval)
            }
        
        elif "/".join(path).startswith(dash_config.output):     # Endpoint starts with demuxer output root path
            path = "/".join(path)
            if (os.path.isfile(path)):
                mime = mimetypes.guess_type(path)[0]
                content = open(path, 'rb').read()

        elif path[0] == "current" and len(path) == 2:
            if path[1] == "vcid":
                content = {
                    'vcid': demuxer_instance.currentVCID
                }

        elif path[0] == "latest" and len(path) == 2:
            if path[1] == "image":
                content = {
                    'image': demuxer_instance.lastImage
                }
            elif path[1] == "fd":
                content = {
                    'image': demuxer_instance.lastImageFD
                }
            elif path[1] == "add":
                content = {
                    'image': demuxer_instance.lastImageADD
                }
            elif path[1] == "xrit":
                content = {
                    'xrit': demuxer_instance.lastXRIT
                }
        
        # Send HTTP 200 OK if content has been updated
        if content != b'': status = 200

        # Convert Python dict into JSON string
        if type(content) is dict:
            content = json.dumps(content, sort_keys=False).encode('utf-8')

        # Return response bytes, HTTP status code and content MIME type
        return content, status, mime


    def log_message(self, format, *args):
        """
        Silence HTTP server log messages
        """

        #super().log_message(format, *args)
        return
