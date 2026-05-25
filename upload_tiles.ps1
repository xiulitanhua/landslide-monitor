# 创建 3D Tiles 数据包以便上传到 GitHub Release
# 在 landslide-monitor 目录下运行此脚本

$zipPath = "d:\3dwebgis\landslide-monitor\3d-tiles.zip"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "📦 正在打包 3D 点云数据..."
Compress-Archive -Path @(
    "public/2026 2 7 17 12",
    "public/liefeng3"
) -DestinationPath $zipPath -Force

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "✅ 打包完成: 3d-tiles.zip ($size MB)"
Write-Host ""
Write-Host "📋 下一步："
Write-Host "1. 打开 https://github.com/xiulitanhua/landslide-monitor/releases/new"
Write-Host "2. Tag 填: tiles"
Write-Host "3. Release title 填: 3D Tiles Data"
Write-Host "4. 点击 Attach binaries，选择 3d-tiles.zip"
Write-Host "5. 点击 Publish release"
Write-Host ""
Write-Host "发布后，GitHub Actions 会自动下载并部署完整网站。"
