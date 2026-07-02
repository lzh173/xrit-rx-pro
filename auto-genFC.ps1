<#
.SYNOPSIS
    循环检测 FD 目录，自动处理新图片为圆盘彩色（Sanchez GK-2A）
.DESCRIPTION
    每 10 秒扫描一次 received\LRIT\当日日期\FD，处理未处理的新图片，
    输出到同目录下的 FC 子文件夹，跳过已有文件。
    按 Ctrl+C 退出脚本。
#>

# 脚本目录及 Sanchez 路径
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ToolsDir = Join-Path $ScriptPath "tools"
$SanchezExe = Join-Path $ToolsDir "Sanchez\Sanchez.exe"

if (-not (Test-Path $SanchezExe)) {
    Write-Host "错误: 未找到 Sanchez.exe，请先运行下载脚本。" -ForegroundColor Red
    exit 1
}

# 支持的图片扩展名
$extensions = @("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.tif", "*.tiff")

# 扫描间隔（秒），可根据需要调整
$scanInterval = 10

Write-Host "循环监控已启动，按 Ctrl+C 停止..." -ForegroundColor Yellow

# 无限循环
while ($true) {
    # 动态获取当天日期
    $today = Get-Date -Format "yyyyMMdd"
    $sourceRoot = "received\LRIT\$today\FD"
    $destRoot = Join-Path $sourceRoot "FC"

    # 检查源目录是否存在
    if (-not (Test-Path $sourceRoot)) {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') 源目录不存在: $sourceRoot，等待..." -ForegroundColor Gray
        Start-Sleep -Seconds $scanInterval
        continue
    }

    # 确保目标目录存在
    if (-not (Test-Path $destRoot)) {
        New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
    }

    # 获取当前源目录下的所有图片文件
    $files = @()
    foreach ($ext in $extensions) {
        $files += Get-ChildItem -Path $sourceRoot -Filter $ext -File
    }

    if ($files.Count -eq 0) {
        # 无文件则等待
        Start-Sleep -Seconds $scanInterval
        continue
    }

    # 筛选出尚未处理（即目标文件不存在）的文件
    $pendingFiles = @()
    foreach ($file in $files) {
        $outFile = Join-Path $destRoot $file.Name
        if (-not (Test-Path $outFile)) {
            $pendingFiles += $file
        }
    }

    if ($pendingFiles.Count -gt 0) {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') 发现 $($pendingFiles.Count) 个新文件，开始处理..." -ForegroundColor Cyan
        foreach ($file in $pendingFiles) {
            $outFile = Join-Path $destRoot $file.Name
            Write-Host "  处理: $($file.Name)" -ForegroundColor Cyan
            try {
                & $SanchezExe -s $file.FullName -o $outFile
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "    成功" -ForegroundColor Green
                } else {
                    Write-Host "    失败 (错误代码 $LASTEXITCODE)" -ForegroundColor Red
                }
            } catch {
                Write-Host "    异常: $_" -ForegroundColor Red
            }
        }
    }

    # 等待下次扫描
    Start-Sleep -Seconds $scanInterval
}