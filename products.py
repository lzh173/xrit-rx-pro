"""
products.py
https://github.com/lzh173/xrit-rx

Parsing and assembly functions for downlinked products
"""

import collections
import colorama
from colorama import Fore, Back, Style
import io
import json
import numpy as np
import os
import pathlib
import sys
import threading
from PIL import Image, ImageFile, UnidentifiedImageError
import subprocess

# Schedule update lock
_schedule_lock = threading.Lock()

# Schedule types known to GK-2A DOP
DOP_TYPES = {
    "FD": "FD", "EGMSG": "EGMSG", "TYIA": "TYIA", "TYIB": "TYIB",
    "RWW3A": "RWW3A", "RWW3F": "RWW3F", "RWW3M": "RWW3M",
    "GWW3F": "GWW3F", "SUFA03": "SUFA03", "SUFA12": "SUFA12",
    "SUFF24": "SUFF24", "UP50A": "UP50A", "UP50F24": "UP50F24",
    "UP50F48": "UP50F48", "SSTA": "SSTA", "SSTF24": "SSTF24",
    "SSTF48": "SSTF48", "SSTF72": "SSTF72", "SICEA": "SICEA",
    "SICEF24": "SICEF24", "SICEF48": "SICEF48", "FOGVIS": "FOGVIS",
    "ANT": "ANT", "COMSFOG": "COMSFOG", "COMSIR1": "COMSIR1",
    "FCT": "FCT",
}


def _schedule_json_path():
    """Get path to schedule.json (same dir as this file + html/schedule.json)."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "html", "schedule.json")


def _parse_dop_text(text):
    """
    Parse GK-2A DOP text into schedule array [[start,end,type,seq,mode,true],...]
    Returns None if not valid DOP.
    Matches dash.py:parse_dop_text() logic exactly.
    """
    if "DISSEMINATION SCHEDULE" not in text:
        return None

    lines = text.split('\n')
    schedule = []
    in_table = False

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if "TIME(UTC)" in line and "ABBR_ID" in line:
            in_table = True
            continue
        if line.startswith("ABBREVIATIONS") or line.startswith("REMARKS"):
            break
        if "GK-2A AMI LRIT DOP END" in line:
            break
        if not in_table:
            continue

        parts = line.split('\t')
        if len(parts) < 3:
            parts = [p for p in line.replace('\t', ' ').split(' ') if p]
            if len(parts) < 3:
                continue

        time_range = parts[0].replace(' ', '')
        if '-' not in time_range:
            continue
        time_parts = time_range.split('-')
        if len(time_parts) != 2:
            continue
        start = time_parts[0].strip()
        end = time_parts[1].strip()
        abbr = parts[1].strip()

        type_str = ""
        seq_str = ""
        mode_str = ""

        # Try known prefixes from longest to shortest
        known = sorted(DOP_TYPES.keys(), key=len, reverse=True)
        for prefix in known:
            if abbr.startswith(prefix):
                suffix = abbr[len(prefix):]
                if suffix.isdigit() or not suffix:
                    type_str = prefix
                    seq_str = suffix
                    if prefix == "FD":
                        mode_str = "FD"
                    break

        if not type_str:
            continue

        schedule.append([start, end, type_str, seq_str, mode_str, True])

    return schedule if schedule else None


def _update_schedule_from_text(text):
    """If text is a valid DOP, parse it and save to schedule.json."""
    try:
        payload_str = text
        if isinstance(text, bytes):
            payload_str = text.decode('utf-8')
    except UnicodeDecodeError:
        return False

    schedule = _parse_dop_text(payload_str)
    if schedule is None:
        return False

    # Filter out EGMSG (emergency messages, rarely transmitted)
    schedule_clean = [e for e in schedule if e[2] != 'EGMSG']

    try:
        with _schedule_lock:
            with open(_schedule_json_path(), 'w', encoding='utf-8') as f:
                json.dump(schedule_clean, f, ensure_ascii=False)
        print("    " + Fore.GREEN + Style.BRIGHT + "计划表已自动更新（{} 条记录，已过滤 EGMSG）".format(len(schedule_clean)))
        return True
    except Exception as e:
        print("    " + Fore.WHITE + Back.RED + Style.BRIGHT + "计划表写入失败: {}".format(e))
        return False


def new(config, name):
    """
    Get new product class
    """

    types = {
        "GK-2A": {
            "LRIT": {
                "FD": MultiSegmentImage,
                "ANT": AlphanumericText
            },
            "HRIT": {
                "FD": MultiSegmentImage
            }
        }
    }

    # Observation mode
    mode = name.split("_")[1]

    try:
        # Get product type from dict
        pclass = types[config.spacecraft][config.downlink][mode]
    except KeyError:
        # Treat all other products as single segment images
        pclass = SingleSegmentImage
    
    return pclass(config, name)


class Product:
    """
    Product base class
    """

    def __init__(self, config, name):
        self.config = config                # Configuration tuple
        self.name = self.parse_name(name)   # Product name
        self.alias = "产品"                  # Product type alias
        self.complete = False               # Completed product flag
        self.last = None                    # Path to last file saved
    
    def parse_name(self, n):
        """
        Parse file name into namedtuple
        """

        name = collections.namedtuple("name", "type mode sequence date time full")
        parts = n.split("_")
        full = n.split(".")[0][:-3]

        if parts[0] == "IMG":
            # Generalise filename for multi-channel HRIT images
            if self.config.downlink == "HRIT":
                gen = n.split("_")
                gen[3] = "<CHANNEL>"
                full = "_".join(gen).split(".")[0][:-3]
            
            tup = name(
                parts[0],
                parts[1],
                int(parts[2]),
                self.parse_date(parts[4]),
                self.parse_time(parts[5]),
                full
            )
        else:
            tup = name(
                parts[0],
                parts[1],
                int(parts[2]),
                self.parse_date(parts[3]),
                self.parse_time(parts[4]),
                full
            )
        
        return tup

    def parse_date(self, date):
        d = date[6:]
        m = date[4:6]
        y = date[:4]

        return (d, m, y)

    def parse_time(self, time):
        h = time[:2]
        m = time[2:4]
        s = time[4:6]

        return (h, m ,s)

    def get_save_path(self, ext="", filename=True):
        """
        Get save path of product (without extension)
        """

        # Build file output path (root + date + observation mode)
        root = self.config.output
        date = "{2}{1}{0}".format(*self.name.date)
        path = "{}/{}/{}".format(root, date, self.name.mode) + "/"

        # Check output directories exist
        pathlib.Path(path).mkdir(parents=True, exist_ok=True)

        # Assemble final file path and name
        return "{}{}{}".format(
            path,
            "" if not filename else self.name.full,
            "" if not ext else ".{}".format(ext)
        )

    def print_info(self):
        """
        Print product info
        """

        print("  [产品] {} 第{}号    {}:{}:{} UTC    {}/{}/{}".format(
            self.name.mode,
            self.name.sequence,
            *self.name.time,
            *self.name.date
        ))


class MultiSegmentImage(Product):
    """
    Multi-segment image products (e.g. Full Disk)
    """

    def __init__(self, config, name):
        # Call parent class init method
        Product.__init__(self, config, name)
        
        # Product specific setup
        self.counter = 0                    # Segment counter
        self.images = {}                    # Image list
        self.ext = "jpg"                    # Output file extension
        self.lastproglen = 0                # Last number of lines in progress indicator

    def add(self, xrit):
        """
        Add data to product
        """

        # Get channel and segment number
        chan = xrit.FILE_NAME.split("_")[3]
        num = int(xrit.FILE_NAME.split(".")[0][-2:])

        # Check object for current channel exists
        try:
            self.images[chan]
        except:
            self.images[chan] = {}

        # Get file name
        fname = xrit.FILE_NAME.split(".")[0]

        if self.config.downlink == "LRIT":
            # Get image from JPG payload
            buf = io.BytesIO(xrit.DATA_FIELD)
            
            try:
                img = Image.open(buf)
            except UnidentifiedImageError:
                print("    " + Fore.WHITE + Back.RED + Style.BRIGHT + "在 xRIT 文件中未找到图像")
                return
        else:
            # Get image from J2K payload
            img = self.convert_to_img(self.get_save_path(filename=False), fname, xrit.DATA_FIELD)

        # Add segment to channel object
        self.images[chan][num] = img
        self.counter += 1

        # Update progress bar
        if not self.config.verbose:
            self.progress()

        # Mark product as complete
        total_segs = { "LRIT": 10, "HRIT": 50 }
        if self.counter == total_segs[self.config.downlink]: self.complete = True

    def save(self):
        """
        Save product to disk
        """
        
        path = self.get_save_path(filename=False)

        for c in self.images:
            # Create output image
            img = Image.new("RGB", self.get_res(c))

            # Combine segments into final image
            for s in self.images[c]:
                height = self.images[c][s].size[1]
                offset = height * (s - 1)
                
                try:
                    img.paste(
                        self.images[c][s],
                        ( 0, offset )
                    )
                except OSError:
                    print("    " + Fore.WHITE + Back.RED + Style.BRIGHT + "跳过截断的图像片段")
            
            # Get image path for current channel
            channel_path = "{}{}.{}".format(
                path,
                self.name.full.replace("<CHANNEL>", c),
                self.ext
            )

            # Save final image
            img.save(channel_path, format='JPEG', subsampling=0, quality=100)
            print("    " + Fore.GREEN + Style.BRIGHT + "已保存 \"{}\"".format(channel_path))
            self.last = channel_path

            # Auto-generate False Color (FC) for Full Disk images
            if self.name.mode == "FD":
                self._generate_fc(channel_path)
                self._generate_ire(channel_path)
    
    def convert_to_img(self, path, name, data):
        """
        Converts J2K to Pillow Image object via PPM using libjpeg

        Arguments:
            path {string} -- Path for temporary files
            data {bytes} -- JPEG2000 image

        Returns:
            Pillow.Image -- Pillow Image object
        """

        # Save JP2 to disk
        jp2Name = path + name + ".jp2"
        with open(jp2Name, "wb") as f:
            f.write(data)

        # Convert J2P to PPM
        ppmName = path + name + ".ppm"
        subprocess.call(["tools\\libjpeg\\jpeg", jp2Name, ppmName], stdout=subprocess.DEVNULL)
        pathlib.Path(jp2Name).unlink()
        
        # Load and convert 16-bit PPM to 8-bit image
        img = Image.open(ppmName)
        iarr = np.uint8(np.array(img) / 4)
        img = Image.fromarray(iarr)
        pathlib.Path(ppmName).unlink()
        return img
    
    def get_res(self, channel):
        """
        Returns the horizontal and vertical resolution of the given satellte, downlink, observation mode and channel
        """

        res = {
            "GK-2A": {
                "LRIT": {
                    "FD": {
                        "IR105": (2200, 2200)
                    }
                },
                "HRIT": {
                    "FD": {
                        "IR105": (2750, 2750),
                        "IR123": (2750, 2750),
                        "SW038": (2750, 2750),
                        "WV069": (2750, 2750),
                        "VI006": (11000, 11000)
                    }
                }
            }
        }

        try:
            return res[self.config.spacecraft][self.config.downlink][self.name.mode][channel]
        except:
            return (None, None)

    def progress(self):
        """
        Renders progress bar for multi-segment mult-wavelength images
        """

        # Clear previous console lines
        for i in range(self.lastproglen):
            print("\33[2K\r", end="", flush=True)
            print("\033[1A", end="", flush=True)

        line = ""
        self.lastproglen = 0

        # Loop through channels
        for c in self.images:
            line += "    {}  {}{}{}{}{}{}{}{}{}{}  {}/{}\n".format(
                c,
                "\u2588\u2588" if 1 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 2 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 3 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 4 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 5 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 6 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 7 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 8 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 9 in self.images[c].keys() else "\u2591\u2591",
                "\u2588\u2588" if 10 in self.images[c].keys() else "\u2591\u2591",
                len(self.images[c]),
                10
            )
            self.lastproglen += 1
        
        print(line, end="", flush=True)

    def _generate_fc(self, source_path):
        """
        Auto-generate False Color (FC) image using Sanchez reproject
        Only runs if Sanchez.exe exists
        """

        sanchez = os.path.join(os.path.dirname(__file__), "tools", "Sanchez", "Sanchez.exe")
        if not os.path.isfile(sanchez):
            return

        # Build FC output path: .../FD/FC/same_filename.jpg
        fc_dir = os.path.join(os.path.dirname(source_path), "FC")
        os.makedirs(fc_dir, exist_ok=True)
        fc_path = os.path.join(fc_dir, os.path.basename(source_path))

        # Skip if FC already exists
        if os.path.isfile(fc_path):
            print("    FC 已存在，跳过：\"{}\"".format(fc_path))
            return

        print("    " + Fore.CYAN + Style.BRIGHT + "正在生成假彩色...", end="")
        try:
            subprocess.run(
                [sanchez, "-s", source_path, "-o", fc_path],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120
            )
            if os.path.isfile(fc_path):
                print(Fore.GREEN + Style.BRIGHT + "已保存 \"{}\"".format(fc_path))
            else:
                print(Fore.WHITE + Back.RED + Style.BRIGHT + "失败")
        except Exception as e:
            print(Fore.WHITE + Back.RED + Style.BRIGHT + "错误：{}".format(e))

    def _generate_ire(self, source_path):
        """
        Auto-generate Infrared Enhanced (IRE) image using enhance-ir.py
        """

        script = os.path.join(os.path.dirname(__file__), "tools", "enhance-ir.py")
        if not os.path.isfile(script):
            return

        print("    " + Fore.CYAN + Style.BRIGHT + "正在增强红外...", end="")
        try:
            # Use absolute paths
            abs_source = os.path.abspath(source_path)
            ire_dir = os.path.join(os.path.dirname(abs_source), "IRE")
            os.makedirs(ire_dir, exist_ok=True)
            ire_path = os.path.join(ire_dir, os.path.basename(abs_source))

            # Skip if IRE already exists
            if os.path.isfile(ire_path):
                print("    IRE 已存在，跳过：\"{}\"".format(ire_path))
                return

            # Run enhance-ir directly on FD source, output lands in IRE (cwd)
            result = subprocess.run(
                [sys.executable, script, abs_source, "-s", "-o"],
                cwd=ire_dir,
                capture_output=True, timeout=120
            )

            # enhance-ir outputs basename_ENHANCED.jpg in cwd (ire_dir) → rename to final name
            enhanced_tmp = os.path.join(ire_dir, os.path.splitext(os.path.basename(abs_source))[0] + '_ENHANCED.jpg')
            if os.path.isfile(enhanced_tmp):
                os.rename(enhanced_tmp, ire_path)
                print(Fore.GREEN + Style.BRIGHT + "已保存 \"{}\"".format(ire_path))
            else:
                err = result.stderr.decode('utf-8', errors='ignore')[-200:]
                print(Fore.WHITE + Back.RED + Style.BRIGHT + "失败")
                if err:
                    print("    " + err.replace("\n", "\n    "))
        except Exception as e:
            print(Fore.WHITE + Back.RED + Style.BRIGHT + "错误：{}".format(e))


class SingleSegmentImage(Product):
    """
    Single segment image products (e.g. Additional Data)
    """

    def __init__(self, config, name):
        # Call parent class init method
        Product.__init__(self, config, name)
        
        # Product specific setup
        self.payload = None

    def add(self, xrit):
        """
        Add data to product
        """

        self.payload = xrit.DATA_FIELD
        self.complete = True

    def save(self):
        """
        Save product to disk
        """

        self.ext = self.get_ext()
        path = self.get_save_path(self.ext)

        with open(path, mode="wb") as outf:
            outf.write(self.payload)

        print("    " + Fore.GREEN + Style.BRIGHT + "已保存 \"{}\"".format(path))
        self.last = path

    def get_ext(self):
        """
        Detects output extension based on file signature
        """

        ext = "bin"
        if self.payload[:3] == b'GIF':
            ext = "gif"
        elif self.payload[1:4] == b'PNG':
            ext = "png"

        return ext


class AlphanumericText(Product):
    """
    Plain text products (e.g. Transmission Schedule)
    """

    def __init__(self, config, name):
        # Call parent class init method
        Product.__init__(self, config, name)
        
        # Product specific setup
        self.payload = None
        self.ext = "txt"

    def add(self, xrit):
        """
        Add data to product
        """

        self.payload = xrit.DATA_FIELD
        self.complete = True

    def save(self):
        """
        Save product to disk
        """

        path = self.get_save_path(self.ext)

        with open(path, mode="wb") as outf:
            outf.write(self.payload)

        # Detect GK-2A LRIT DOP and auto-update schedule
        if b"GK-2A AMI LRIT DOP" in self.payload[:60]:
            print("    GK-2A LRIT Daily Operation Plan")
            try:
                text = self.payload.decode('utf-8')
                # Only update schedule if this is for today
                if "DISSEMINATION SCHEDULE FROM" in text:
                    _update_schedule_from_text(text)
            except UnicodeDecodeError:
                pass

        print("    " + Fore.GREEN + Style.BRIGHT + "已保存 \"{}\"".format(path))
        self.last = path
