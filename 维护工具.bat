@echo off
title Antigravity HanHua Maintenance

echo ============================================
echo   Antigravity 汉化维护工具
echo ============================================
echo.
echo  [1] 采集漏译清单   请先打开客户端，并停留在漏译页面
echo  [2] 校验字典       检查跨文件冲突与空值
echo  [3] 检查字典质量   检查大小写变体一致性等
echo  [4] 检查主进程文案 检查菜单/托盘/对话框的字典覆盖
echo  [5] 活体验证       不重装客户端，直接验证新引擎效果
echo  [6] 同类翻译检查   检查同类列表(低中高/频率/状态等)是否翻译完整
echo  [0] 退出
echo.
set /p CHOICE=请输入选项后按回车: 

chcp 65001 >nul
if "%CHOICE%"=="1" node "%~dp0scratch\dump_missing.js"
if "%CHOICE%"=="2" node "%~dp0scratch\dict_check.js"
if "%CHOICE%"=="3" node "%~dp0scratch\dict_quality_check.js"
if "%CHOICE%"=="4" node "%~dp0scratch\mainproc_keys_check.js"
if "%CHOICE%"=="5" node "%~dp0scratch\verify_fix_live.js"
if "%CHOICE%"=="6" node "%~dp0scratch\enum_group_check.js"

echo.
echo 操作结束，按任意键关闭窗口...
pause >nul