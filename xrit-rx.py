"""
xrit-rx.py
https://github.com/lzh173/xrit-rx

Frontend for CCSDS demultiplexer and image generator
"""

import ast
from argparse import ArgumentParser
from collections import namedtuple
import colorama
from colorama import Fore, Back, Style
from configparser import ConfigParser, NoOptionError, NoSectionError
from os import mkdir, path
import socket
import sys
import threading
from time import time, sleep
import winsound

from demuxer import Demuxer
import ccsds as CCSDS
from dash import Dashboard


# Globals
args = None             # Parsed CLI arguments
config = None           # Config parser object
stime = None            # Processing start time
source = None           # Input source type
spacecraft = None       # Spacecraft name
downlink = None         # Downlink type (LRIT/HRIT)
output = None           # Output path root
output_images = None    # Flag for saving Images to disk
output_xrit = None      # Flag for saving xRIT files to disk
blacklist = []          # VCID blacklist
packetf = None          # Packet file object
keypath = None          # Decryption key file path
keys = {}               # Decryption keys
sck = None              # TCP/UDP socket object
buflen = 892            # Input buffer length (1 VCDU)
demux = None            # Demuxer class object
dash = None             # Dashboard class object
dashe = None            # Dashboard enabled flag
dashp = None            # Dashboard HTTP port
dashi = None            # Dashboard refresh interval (sec)
ver = "2.0.0"           # xrit-rx version
switch_to_offline = False  # Flag set by console listener to switch modes
console_thread = None      # Background stdin listener


def start_console_listener():
    """
    Start a background daemon thread that reads stdin for mode switch commands.
    """
    global console_thread

    def _listener():
        while True:
            try:
                cmd = sys.stdin.readline().strip().lower()
            except (EOFError, OSError):
                sleep(0.5)
                continue
            if not cmd:
                sleep(0.1)
                continue
            if cmd == "offline":
                global switch_to_offline
                switch_to_offline = True
                print(Fore.YELLOW + Style.BRIGHT + "\n正在等待当前数据处理完毕，切换至离线模式...\n")
            elif cmd in ("exit", "quit"):
                safe_stop()

    t = threading.Thread(target=_listener, daemon=True, name="console-listener")
    t.start()
    console_thread = t


def init():
    print("┌──────────────────────────────────────────────┐")
    print("│                   xrit-rx                    │")
    print("│         LRIT/HRIT 下行链路处理器               │")
    print("├──────────────────────────────────────────────┤")
    print("│     @sam210723         vksdr.com/xrit-rx     │")
    print("└──────────────────────────────────────────────┘\n")
    
    global args
    global config
    global stime
    global output
    global demux
    global dash
    global switch_to_offline

    # Initialise Colorama
    colorama.init(autoreset=True)

    # Handle arguments and config file
    args = parse_args()
    config = parse_config(args.config)
    print_config()

    # Start background console listener (reads stdin for mode switching)
    start_console_listener()

    # Mode state machine: "offline" ↔ "normal"
    current_mode = "offline" if args.offline else "normal"

    while True:
        if current_mode == "offline":
            # ── Offline mode ──
            print(Fore.GREEN + Style.BRIGHT + "离线模式：仅启动 Web 产品查看器\n")

            offline_output = path.abspath(output).replace("\\", "/")

            if dashe:
                cfg = namedtuple('dash_config', 'port interval spacecraft downlink output images xrit blacklist version offline')
                dash = Dashboard(
                    cfg(dashp, dashi, spacecraft, downlink, offline_output, output_images, output_xrit, blacklist, ver, True),
                    None
                )
                print("离线查看器已启动，访问 http://localhost:{}/ 浏览产品\n".format(dashp))
            else:
                print(Fore.WHITE + Back.RED + Style.BRIGHT + "仪表板未启用，请在配置中启用 dashboard")
                exit()

            print(Fore.YELLOW + Style.BRIGHT + "输入 rx 切换到接收模式，输入 exit 退出\n")

            need_receive = False
            while True:
                try:
                    cmd = input("(offline) ").strip().lower()
                except (EOFError, KeyboardInterrupt):
                    print()
                    break

                if cmd in ("rx", "receive", "start"):
                    need_receive = True
                    break
                elif cmd in ("exit", "quit", "q"):
                    break
                elif cmd in ("help", "?"):
                    print("  rx, start   - 切换到正常接收模式")
                    print("  offline     - 切换到离线浏览（在接收模式下输入）")
                    print("  exit, quit  - 退出程序")
                    print("  help        - 显示此帮助")
                else:
                    print("未知命令，输入 help 查看帮助")

            if dash:
                dash.stop()

            if not need_receive:
                return

            print(Fore.GREEN + Style.BRIGHT + "\n正在切换至接收模式...\n")
            current_mode = "normal"
            continue  # re-enter loop as normal mode

        elif current_mode == "normal":
            # ── Normal receive mode ──
            dirs()
            config_input()
            load_keys()

            demux_config = namedtuple('demux_config', 'spacecraft downlink verbose dump output images xrit blacklist keys')
            output += "/" + downlink + "/"
            demux = Demuxer(demux_config(spacecraft, downlink, args.v, args.dump, output, output_images, output_xrit, blacklist, keys))

            if dashe:
                cfg = namedtuple('dash_config', 'port interval spacecraft downlink output images xrit blacklist version offline')
                dash = Dashboard(cfg(dashp, dashi, spacecraft, downlink, output, output_images, output_xrit, blacklist, ver, False), demux)

            if not demux.coreReady:
                print(Fore.WHITE + Back.RED + Style.BRIGHT + "解复用器核心线程启动失败")
                exit()

            print("──────────────────────────────────────────────────────────────────────────────────\n")
            stime = time()
            loop()  # blocks until switch_to_offline or source complete

            # Clean up normal mode resources
            if demux:
                demux.stop()
                demux = None
            if dash:
                dash.stop()
                dash = None
            if sck:
                try: sck.close()
                except: pass
                sck = None

            # loop() returned — check why
            if switch_to_offline:
                switch_to_offline = False
                print(Fore.GREEN + Style.BRIGHT + "\n正在切换至离线浏览模式...\n")
                current_mode = "offline"
                continue
            else:
                # FILE mode completed normally
                return


def loop():
    """
    Handles data from the selected input source
    """
    global demux
    global source
    global sck
    global buflen
    global switch_to_offline

    # Set socket timeout for TCP/UDP sources so we can check switch_to_offline
    if source in ("GOESRECV", "OSP", "UDP") and sck:
        try:
            sck.settimeout(0.5)
        except:
            pass

    while True:
        # Check for mode switch request
        if switch_to_offline:
            print(Fore.YELLOW + Style.BRIGHT + "\n正在停止接收...")
            return

        if source == "GOESRECV":
            try:
                data = sck.recv(buflen + 8)
            except socket.timeout:
                continue
            except ConnectionResetError:
                print(Fore.WHITE + Back.RED + Style.BRIGHT + "丢失与 GOESRECV 的连接，正在重连...")
                winsound.Beep(800, 500)
                sleep(3)
                reconnect_source()
                continue
            except:
                continue

            if len(data) == buflen + 8:
                demux.push(data[8:])

        elif source == "OSP":
            try:
                data = sck.recv(buflen)
            except socket.timeout:
                continue
            except ConnectionResetError:
                print(Fore.WHITE + Back.RED + Style.BRIGHT + "丢失与 Open Satellite Project 的连接，正在重连...")
                winsound.Beep(800, 500)
                sleep(3)
                reconnect_source()
                continue
            except:
                continue

            demux.push(data)

        elif source == "UDP":
            try:
                data, address = sck.recvfrom(buflen)
            except socket.timeout:
                continue
            except Exception as e:
                print(e)
                safe_stop()
                return

            demux.push(data)

        elif source == "FILE":
            global packetf
            global stime

            if not packetf.closed:
                # Read VCDU from file
                data = packetf.read(buflen)

                # No more data to read from file
                if data == b'':
                    packetf.close()

                    # Append single fill VCDU (VCID 63)
                    # Triggers TP_File processing inside channel handlers
                    demux.push(b'\x70\xFF\x00\x00\x00\x00')

                    continue

                # Push VCDU to demuxer
                demux.push(data)
            else:
                # Demuxer has all VCDUs from file, wait for processing
                if demux.complete():
                    runTime = round(time() - stime, 3)
                    print("\n文件处理完成（{} 秒）".format(runTime))
                    return  # Don't safe_stop, let init decide
                else:
                    # Limit loop speed when waiting for demuxer to finish processing
                    sleep(0.5)


def config_input():
    """
    Configures the selected input source
    """

    global source
    global sck

    if source == "GOESRECV":
        sck = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        ip = config.get('goesrecv', 'ip')
        port = int(config.get('goesrecv', 'vchan'))
        addr = (ip, port)

        print("正在连接 goesrecv（{}）...".format(ip), end='')
        connect_socket(addr)
        nanomsg_init()
    
    elif source == "OSP":
        sck = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        ip = config.get('osp', 'ip')
        port = int(config.get('osp', 'vchan'))
        addr = (ip, port)

        print("正在连接 Open Satellite Project（{}）...".format(ip), end='')
        connect_socket(addr)
    
    elif source == "UDP":
        sck = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        ip = config.get('udp', 'ip')
        port = int(config.get('udp', 'vchan'))
        addr = (ip, port)
        
        print("正在绑定 UDP 套接字（{}:{}）...".format(ip, port), end='')
        try:
            sck.bind(addr)
            print(Fore.GREEN + Style.BRIGHT + "成功")
        except socket.error as e:
            print(Fore.WHITE + Back.RED + Style.BRIGHT + "失败")
            print(e)
            safe_stop()

    elif source == "FILE":
        global packetf

        # Check VCDU file exists
        if not path.exists(args.file):
            print(Fore.WHITE + Back.RED + Style.BRIGHT + "输入文件不存在")
            safe_stop()

        packetf = open(args.file, 'rb')
        print(Fore.GREEN + Style.BRIGHT + "已打开数据包文件")

    else:
        print(Fore.WHITE + Back.RED + Style.BRIGHT + "未知输入模式：\"{}\"".format(source))
        safe_stop()


def connect_socket(addr):
    """
    Connects TCP socket to address and handle exceptions
    """

    try:
        sck.connect(addr)
        print(Fore.GREEN + Style.BRIGHT + "已连接")
    except socket.error as e:
        if e.errno == 10061:
            print(Fore.WHITE + Back.RED + Style.BRIGHT + "连接被拒绝")
        else:
            print(e)
    
        safe_stop()


def nanomsg_init():
    """
    Sets up nanomsg publisher in goesrecv to send VCDUs over TCP
    """

    global sck

    sck.send(b'\x00\x53\x50\x00\x00\x21\x00\x00')
    nmres = sck.recv(8)

    # Check nanomsg response
    if nmres != b'\x00\x53\x50\x00\x00\x20\x00\x00':
        print(Fore.WHITE + Back.RED + Style.BRIGHT + "  NANOMSG 配置失败（响应错误）")
        safe_stop()


def dirs():
    """
    Configures directories for demuxed files
    """

    global downlink
    global output

    absp = path.abspath(output)
    
    # Create output directory if it doesn't exist already
    if not path.isdir(absp):
        try:
            mkdir(absp)
        except OSError as e:
            print(Fore.WHITE + Back.RED + Style.BRIGHT + "ERROR CREATING OUTPUT FOLDERS\n{}".format(e))
            safe_stop()
    
    if not path.isdir(absp + "/" + downlink + "/"):
        try:
            mkdir(absp + "/" + downlink + "/")

            print(Fore.GREEN + Style.BRIGHT + "已创建输出文件夹")
        except OSError as e:
            print(Fore.WHITE + Back.RED + Style.BRIGHT + "创建输出文件夹失败\n{}".format(e))
            safe_stop()


def load_keys():
    """
    Loads key file and parses keys
    """

    global keypath
    global keys
    global output_images
    global output_xrit

    # Check key file exists
    if not path.exists(keypath):
        print(Fore.WHITE + Back.RED + Style.BRIGHT + "未找到密钥文件：仅保存加密的 xRIT 文件")
        
        # Only output xRIT files
        output_images = False
        output_xrit = True
        
        return False

    # Load key file
    keyf = open(keypath, mode='rb')
    fbytes = keyf.read()

    # Parse key count
    count = int.from_bytes(fbytes[:2], byteorder='big')

    # Parse keys
    for i in range(count):
        offset = (i * 10) + 2
        index = fbytes[offset : offset + 2]
        key = fbytes[offset + 2 : offset + 10]

        '''
        # Print keys
        i = hex(int.from_bytes(index, byteorder='big')).upper()[2:]
        k = hex(int.from_bytes(key, byteorder='big')).upper()[2:]
        print("{}: {}".format(i, k))
        '''

        # Add key to dictionary
        keys[index] = key

    print(Fore.GREEN + Style.BRIGHT + "解密密钥已加载")
    return True


def parse_args():
    """
    Parses command line arguments
    """
    
    argp = ArgumentParser()
    argp.description = "CCSDS 解复用器前端"
    argp.add_argument("--config", action="store", help="配置文件路径 (.ini)", default="xrit-rx.ini")
    argp.add_argument("--file", action="store", help="VCDU 数据包文件路径", default=None)
    argp.add_argument("-v", action="store_true", help="启用详细控制台输出（仅用于调试）", default=False)
    argp.add_argument("--dump", action="store", help="将 VCDU（填充除外）转储到文件（仅用于调试）", default=None)
    argp.add_argument("-offline", action="store_true", help="离线模式：仅启动 Web 服务器查看已接收的产品", default=False)

    return argp.parse_args()


def parse_config(path):
    """
    Parses configuration file
    """

    global source
    global spacecraft
    global downlink
    global output
    global output_images
    global output_xrit
    global blacklist
    global keypath
    global dashe
    global dashp
    global dashi

    cfgp = ConfigParser()
    cfgp.read(path, encoding='utf-8')

    if args.file == None:
        source = cfgp.get('rx', 'input').upper()
    else:
        source = "FILE"
    
    try:
        spacecraft = cfgp.get('rx', 'spacecraft').upper()
        downlink = cfgp.get('rx', 'mode').upper()
        output = cfgp.get('output', 'path')
        output_images = cfgp.getboolean('output', 'images')
        output_xrit = cfgp.getboolean('output', 'xrit')
        bl = cfgp.get('output', 'channel_blacklist')
        keypath = cfgp.get('rx', 'keys')
        dashe = cfgp.getboolean('dashboard', 'enabled')
        dashp = cfgp.get('dashboard', 'port')
        dashi = round((float(cfgp.get('dashboard', 'interval'))), 1)
    except (NoSectionError, NoOptionError) as e:
        print(Fore.WHITE + Back.RED + Style.BRIGHT + "解析配置文件错误：" + str(e).upper())
        safe_stop()

    # Limit dashboard refresh interval
    if dashi < 1: dashi = 1

    # If VCID blacklist is not empty
    if bl != "":
        # Parse blacklist string into int or list
        blacklist = ast.literal_eval(bl)

        # If parsed into int, wrap int in list
        if type(blacklist) == int: blacklist = [blacklist]

    return cfgp


def print_config():
    """
    Prints configuration information
    """

    print("航天器：          {}".format(spacecraft))

    if downlink == "LRIT":
        rate = "64 kbps"
    elif downlink == "HRIT":
        rate = "3 Mbps"
    print("下行链路：        {}（{}）".format(downlink, rate))

    if source == "GOESRECV":
        s = "goesrecv (github.com/sam210723/goestools)"
    elif source == "OSP":
        s = "Open Satellite Project (github.com/opensatelliteproject/xritdemod)"
    elif source == "FILE":
        s = "文件（{}）".format(args.file)
    else:
        s = "未知"

    print("输入源：          {}".format(s))

    absp = path.abspath(output)
    absp = absp[0].upper() + absp[1:]  # Fix lowercase drive letter
    print("输出路径：        {}".format(absp))

    if (len(blacklist) == 0):
        print("忽略的 VCID：     无")
    else:
        blacklist_str = ""
        for i, c in enumerate(blacklist):
            if i > 0: blacklist_str += ", "
            blacklist_str += "{} ({})".format(c, CCSDS.VCDU.get_VC(None, int(c)))

        print("忽略的 VCID：     {}".format(blacklist_str))

    print("密钥文件：        {}".format(keypath))

    if dashe:
        print("仪表板：          已启用（端口 {}）".format(dashp))
    else:
        print("仪表板：          已禁用")

    print("版本：            {}\n".format(ver))

    if args.dump:
        print(Fore.GREEN + Style.BRIGHT + "正在写入数据包到：\"{}\"".format(args.dump))


def reconnect_source():
    """
    Reconnect to the input source after a connection loss
    """

    global sck
    global source

    max_retries = 5
    retry_delay = 2

    for attempt in range(1, max_retries + 1):
        try:
            # Close old socket
            try:
                sck.close()
            except:
                pass

            if source == "GOESRECV":
                ip = config.get('goesrecv', 'ip')
                port = int(config.get('goesrecv', 'vchan'))
                addr = (ip, port)

                sck = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sck.settimeout(5)
                sck.connect(addr)
                sck.settimeout(None)

                # Re-init nanomsg
                sck.send(b'\x00\x53\x50\x00\x00\x21\x00\x00')
                nmres = sck.recv(8)
                if nmres == b'\x00\x53\x50\x00\x00\x20\x00\x00':
                    print(Fore.GREEN + Style.BRIGHT + "已重连 GOESRECV")
                    return True

            elif source == "OSP":
                ip = config.get('osp', 'ip')
                port = int(config.get('osp', 'vchan'))
                addr = (ip, port)

                sck = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sck.settimeout(5)
                sck.connect(addr)
                sck.settimeout(None)
                print(Fore.GREEN + Style.BRIGHT + "已重连 Open Satellite Project")
                return True

        except socket.timeout:
            print("  连接超时（第 {}/{} 次）".format(attempt, max_retries))
        except socket.error as e:
            print("  重连失败（第 {}/{} 次）：{}".format(attempt, max_retries, e))

        # Exponential backoff between retries
        if attempt < max_retries:
            wait = retry_delay * attempt
            print("  等待 {} 秒后重试...".format(wait))
            sleep(wait)

    print(Fore.WHITE + Back.RED + Style.BRIGHT + "重连失败，退出")
    safe_stop()
    return False


def safe_stop(message=True):
    """
    Safely kill threads and exit
    """

    if demux != None: demux.stop()
    if dash != None: dash.stop()

    if message: print("\n正在退出...")
    exit()


try:
    init()
except KeyboardInterrupt:
    safe_stop()
