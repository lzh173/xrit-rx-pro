<#
.SYNOPSIS
    Sanchez GK-2A 工具下载与运行启动器 (完全抛弃 Aria2 纯净版)
.DESCRIPTION
    自动下载 Sanchez 到当前目录的 tools 文件夹下，使用原生 PowerShell 下载。
    解压过程在 temp 文件夹进行，下载成功后自动清理。
#>

# ==================== 配置变量 ====================
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$TempDir = Join-Path $ScriptPath "temp"
$ToolsDir = Join-Path $ScriptPath "tools"

# 定义 Sanchez 相关路径
$SanchezFolderName = "Sanchez"
$SanchezExePath = Join-Path $ToolsDir $SanchezFolderName "Sanchez.exe"
$SanchezZipName = "Sanchez-win-x64.zip"
$SanchezUrl = "https://github.com/nullpainter/sanchez/releases/download/v1.0.24/sanchez-v1.0.24-win-x64.zip"

# ==================== 准备环境 ====================
# 创建 temp 和 tools 文件夹（如果不存在）
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir -Force | Out-Null }
if (-not (Test-Path $ToolsDir)) { New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null }

# 设置控制台颜色
$Host.UI.RawUI.ForegroundColor = "Green"

# ==================== 核心函数：原生下载并带自动重试 ====================
function Download-File {
    param (
        [string]$Url,
        [string]$OutputFile
    )
    $maxRetries = 5  # 尝试5次
    $retryCount = 0
    $downloaded = $false

    while ($retryCount -lt $maxRetries -and -not $downloaded) {
        try {
            $retryCount++
            Write-Host "正在下载: $(Split-Path $OutputFile -Leaf) (尝试 $retryCount / $maxRetries)..." -ForegroundColor Yellow
            
            # 使用 .NET WebClient (原生且稳定，支持 GitHub 链接)
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36")
            $wc.DownloadFile($Url, $OutputFile)
            
            if (Test-Path $OutputFile) {
                Write-Host "下载成功！" -ForegroundColor Cyan
                $downloaded = $true
            }
        }
        catch {
            Write-Host "下载失败 ($($_.Exception.Message))" -ForegroundColor Red
            if ($retryCount -lt $maxRetries) {
                Write-Host "等待 1 秒后重试..." -ForegroundColor Yellow
                Start-Sleep -Seconds 1
            }
        }
    }
    return $downloaded
}

# ==================== 检查并下载 Sanchez ====================
if (-not (Test-Path $SanchezExePath)) {
    Write-Host "`n[1/1] 检测到 Sanchez 缺失，准备下载..." -ForegroundColor Yellow
    $TempSanchezZip = Join-Path $TempDir $SanchezZipName
    $DestSanchezFolder = Join-Path $ToolsDir $SanchezFolderName
    
    # 调用原生下载函数
    if (-not (Download-File -Url $SanchezUrl -OutputFile $TempSanchezZip)) {
        Write-Host "Sanchez 下载失败，已重试 5 次。请检查网络连接。" -ForegroundColor Red
        Pause
        Exit 1
    }

    # 解压并移动到 Tools 文件夹
    if (Test-Path $TempSanchezZip) {
        Write-Host "正在解压 Sanchez..."
        try {
            # 1. 解压到 temp 文件夹（可能会产生多层嵌套文件夹）
            Expand-Archive -Path $TempSanchezZip -DestinationPath $TempDir -Force
            
            # 2. 在 temp 里找到 Sanchez.exe 的真实位置
            $FoundExe = Get-ChildItem -Path $TempDir -Recurse -Filter "Sanchez.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            
            if ($FoundExe) {
                # 获取 exe 所在的父文件夹路径
                $SourceFolder = $FoundExe.Directory.FullName
                
                # 3. 如果 tools\Sanchez 已存在，先删除它 (保证覆盖安装)
                if (Test-Path $DestSanchezFolder) {
                    Remove-Item -Path $DestSanchezFolder -Recurse -Force
                }
                
                # 4. 将找到的正确文件夹整体移动到 tools 目录下并改名
                Move-Item -Path $SourceFolder -Destination $DestSanchezFolder -Force
                
                Write-Host "Sanchez 安装完成！(路径: $SanchezExePath)" -ForegroundColor Cyan
            } else {
                throw "在解压文件中未找到 Sanchez.exe"
            }
            
            # 5. 清理垃圾文件
            Remove-Item -Path $TempSanchezZip -Force
        }
        catch {
            Write-Host "Sanchez 解压或移动失败：$($_.Exception.Message)" -ForegroundColor Red
            Pause
            Exit 1
        }
    }
} else {
    Write-Host "[1/1] Sanchez 已存在，跳过下载。" -ForegroundColor Cyan
}

# ==================== 清理残留 Temp 文件夹 ====================
if (Test-Path $TempDir) {
    try {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "`n已清理临时文件夹 (temp)。"
    } catch {
        # 如果工具还在占用，忽略删除错误即可
    }
}

# ==================== 启动主菜单 ====================
# 清屏并进入交互菜单
Clear-Host
$Host.UI.RawUI.ForegroundColor = "Cyan"

# 菜单循环
do {
    Write-Host "`n====== Sanchez GK-2A 图片上色处理小脚本 ======" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. GK-2A 图片球面彩色处理 (单张 & 批量)"
    Write-Host "2. GK-2A 图片平面彩色处理 (单张 & 批量)"
    Write-Host "3. 自定义参数处理 (单张 & 批量)"
    Write-Host "Q. 退出脚本"
    Write-Host ""

    $choice = Read-Host "请选择选项"

    switch ($choice) {
        "1" {
            $Input_Image = Read-Host "请输入要处理的源图像路径"
            $Output_Image = Read-Host "请输入处理过后的输出路径"
            & $SanchezExePath -s $Input_Image -o $Output_Image
            if ($LASTEXITCODE -ne 0) {
                Write-Host "图片处理失败，请检查输入路径和参数。" -ForegroundColor Red
            } else {
                Write-Host "图片处理完成！已保存在输出目录。" -ForegroundColor Green
            }
            Read-Host "按 Enter 继续"
        }
        "2" {
            $Input_Image = Read-Host "请输入要处理的源图像路径"
            $Output_Image = Read-Host "请输入处理过后的输出路径"
            & $SanchezExePath reproject -s $Input_Image stitch -fa -b 1.2 -o $Output_Image
            if ($LASTEXITCODE -ne 0) {
                Write-Host "图片处理失败，请检查输入路径和参数。" -ForegroundColor Red
            } else {
                Write-Host "图片处理完成！已保存在输出目录。" -ForegroundColor Green
            }
            Read-Host "按 Enter 继续"
        }
        "3" {
            $Input_Image = Read-Host "请输入要处理的源图像路径"
            $Output_Image = Read-Host "请输入处理过后的输出路径"
            $Custom_Option = Read-Host "请输入自定义参数"
            & $SanchezExePath -s $Input_Image -o $Output_Image $Custom_Option
            if ($LASTEXITCODE -ne 0) {
                Write-Host "图片处理失败，请检查输入路径和参数。" -ForegroundColor Red
            } else {
                Write-Host "图片处理完成！已保存在输出目录。" -ForegroundColor Green
            }
            Read-Host "按 Enter 继续"
        }
    }
} while ($choice -ne "Q" -and $choice -ne "q")

Write-Host "脚本退出。" -ForegroundColor Cyan