<#
.SYNOPSIS
    Sanchez GK-2A 工具下载与运行启动器 (PowerShell 版)
.DESCRIPTION
    自动下载 aria2 和 Sanchez 到当前目录的 tools 文件夹下。
    解压过程在 temp 文件夹进行，下载成功后自动清理。
#>

# ==================== 配置变量 ====================
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$TempDir = Join-Path $ScriptPath "temp"
$ToolsDir = Join-Path $ScriptPath "tools"

# 定义 Aria2 相关路径
$Aria2FolderName = "aria2-1.36.0-win-64bit-build1"
$Aria2ExePath = Join-Path $ToolsDir $Aria2FolderName "aria2c.exe"
$Aria2ZipName = "Aria2-win-x64.zip"
$Aria2Url = "https://github.com/aria2/aria2/releases/download/release-1.36.0/aria2-1.36.0-win-64bit-build1.zip"

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

# ==================== 核心函数：带重试机制的下载 ====================
function Download-File {
    param (
        [string]$Url,
        [string]$OutputFile
    )
    $maxRetries = 3
    $retryCount = 0
    $downloaded = $false

    while ($retryCount -lt $maxRetries -and -not $downloaded) {
        try {
            $retryCount++
            Write-Host "正在下载: $(Split-Path $OutputFile -Leaf) (尝试 $retryCount / $maxRetries)..."
            
            # 使用 WebClient 下载，比 Invoke-WebRequest 对 GitHub 这种大文件更稳定
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($Url, $OutputFile)
            
            if (Test-Path $OutputFile) {
                Write-Host "下载成功！" -ForegroundColor Cyan
                $downloaded = $true
            }
        }
        catch {
            Write-Host "下载失败 ($($_.Exception.Message))" -ForegroundColor Red
            if ($retryCount -lt $maxRetries) {
                Write-Host "等待 3 秒后重试..." -ForegroundColor Yellow
                Start-Sleep -Seconds 3
            }
        }
    }
    return $downloaded
}

# ==================== 1. 检查并下载 Aria2 ====================
if (-not (Test-Path $Aria2ExePath)) {
    Write-Host "`n[1/2] 检测到 Aria2 缺失，准备下载..." -ForegroundColor Yellow
    $TempAria2Zip = Join-Path $TempDir $Aria2ZipName
    
    if (Download-File -Url $Aria2Url -OutputFile $TempAria2Zip) {
        Write-Host "正在解压 Aria2..."
        try {
            # 解压到 temp 文件夹
            Expand-Archive -Path $TempAria2Zip -DestinationPath $TempDir -Force
            
            # 将解压出来的文件夹移动到 tools 文件夹
            $SourceAria2Folder = Join-Path $TempDir $Aria2FolderName
            $DestAria2Folder = Join-Path $ToolsDir $Aria2FolderName
            
            if (Test-Path $DestAria2Folder) {
                Remove-Item -Path $DestAria2Folder -Recurse -Force
            }
            Move-Item -Path $SourceAria2Folder -Destination $DestAria2Folder -Force
            
            # 清理垃圾文件
            Remove-Item -Path $TempAria2Zip -Force
            Write-Host "Aria2 安装完成！" -ForegroundColor Cyan
        }
        catch {
            Write-Host "Aria2 解压或移动失败：$($_.Exception.Message)" -ForegroundColor Red
            Pause
            Exit 1
        }
    }
    else {
        Write-Host "Aria2 下载失败，请检查网络连接。" -ForegroundColor Red
        Pause
        Exit 1
    }
} else {
    Write-Host "[1/2] Aria2 已存在，跳过。" -ForegroundColor Cyan
}

# ==================== 2. 检查并下载 Sanchez ====================
if (-not (Test-Path $SanchezExePath)) {
    Write-Host "`n[2/2] 检测到 Sanchez 缺失，准备下载..." -ForegroundColor Yellow
    $TempSanchezZip = Join-Path $TempDir $SanchezZipName
    
    # **关键修复**：使用刚才安装好的 Aria2 来下载 Sanchez，规避 GitHub 复杂链接的解析问题
    if (Test-Path $Aria2ExePath) {
        Write-Host "调用本地 Aria2 下载 Sanchez (这能防止特殊链接导致报错)..."
        
        # 使用 Start-Process 等待 Aria2 执行完成
        $process = Start-Process -FilePath $Aria2ExePath -ArgumentList "-s 64 -x 10 `"$SanchezUrl`" -o `"$TempSanchezZip`"" -Wait -PassThru
        
        if ($process.ExitCode -ne 0) {
            Write-Host "Sanchez 下载失败，Aria2 返回错误码: $($process.ExitCode)" -ForegroundColor Red
            Pause
            Exit 1
        }
    }
    else {
        # 如果 Aria2 都没装上，就用 PowerShell 原生方法试试（兜底）
        Write-Host "尝试使用 PowerShell 下载 Sanchez..."
        if (-not (Download-File -Url $SanchezUrl -OutputFile $TempSanchezZip)) {
            Write-Host "Sanchez 下载失败。" -ForegroundColor Red
            Pause
            Exit 1
        }
    }

    # 解压并移动
    if (Test-Path $TempSanchezZip) {
        Write-Host "正在解压 Sanchez..."
        try {
            # 解压到 temp 文件夹
            Expand-Archive -Path $TempSanchezZip -DestinationPath $TempDir -Force
            
            # 将解压出来的文件夹移动到 tools 文件夹
            $SourceSanchezFolder = Join-Path $TempDir $SanchezFolderName
            $DestSanchezFolder = Join-Path $ToolsDir $SanchezFolderName
            
            if (Test-Path $DestSanchezFolder) {
                Remove-Item -Path $DestSanchezFolder -Recurse -Force
            }
            Move-Item -Path $SourceSanchezFolder -Destination $DestSanchezFolder -Force
            
            # 清理垃圾文件
            Remove-Item -Path $TempSanchezZip -Force
            Write-Host "Sanchez 安装完成！" -ForegroundColor Cyan
        }
        catch {
            Write-Host "Sanchez 解压或移动失败：$($_.Exception.Message)" -ForegroundColor Red
            Pause
            Exit 1
        }
    }
} else {
    Write-Host "[2/2] Sanchez 已存在，跳过。" -ForegroundColor Cyan
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