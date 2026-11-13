<#
    Replace-System32-File.ps1
    ---------------------------------------------------------------
    Безопасная замена защищённого файла в C:\Windows\System32
    (например c_1251.nls — таблица кодировки 1251 для программы "Фаворит").

    Что делает:
      - делает резервную копию оригинала в C:\System32-Backup
      - забирает права владельца и даёт доступ администраторам
      - заменяет системный файл на ваш
      - умеет вернуть оригинал обратно (режим -Restore)

    ВАЖНО:
      - Запускать ТОЛЬКО от имени Администратора.
      - Замена системных файлов рискованна. Бэкап делается автоматически,
        но если после замены Windows или программы работают неправильно —
        выполните откат (пример в конце файла).
      - Делайте это на своём компьютере и под свою ответственность.
    ---------------------------------------------------------------

    Примеры запуска (в PowerShell от Администратора):

      # Заменить c_1251.nls на свой файл:
      .\Replace-System32-File.ps1 -SourceFile "C:\Users\Me\Downloads\c_1251.nls" -TargetName "c_1251.nls"

      # Вернуть оригинал обратно:
      .\Replace-System32-File.ps1 -TargetName "c_1251.nls" -Restore
#>

[CmdletBinding()]
param(
    # Путь к вашему файлу, который нужно поставить вместо системного
    [string]$SourceFile,

    # Имя файла в System32, который заменяем (по умолчанию c_1251.nls)
    [string]$TargetName = "c_1251.nls",

    # Папка для резервных копий
    [string]$BackupDir = "C:\System32-Backup",

    # Режим отката: вернуть оригинал из бэкапа
    [switch]$Restore
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Запустите PowerShell от имени Администратора (правый клик -> 'Запуск от имени администратора')."
    }
}

function Take-OwnershipAndGrant {
    param([string]$Path)
    # Забрать владельца на группу Администраторов и дать полный доступ
    & takeown.exe /F $Path | Out-Null
    & icacls.exe $Path /grant "*S-1-5-32-544:F" | Out-Null   # *S-1-5-32-544 = встроенная группа "Администраторы" (не зависит от языка Windows)
}

Assert-Admin

$system32 = Join-Path $env:WINDIR "System32"
$targetPath = Join-Path $system32 $TargetName
$backupPath = Join-Path $BackupDir $TargetName

# ----------------------- РЕЖИМ ОТКАТА -----------------------
if ($Restore) {
    if (-not (Test-Path $backupPath)) {
        throw "Резервная копия не найдена: $backupPath. Откат невозможен."
    }
    Write-Host "Восстанавливаю оригинал из: $backupPath" -ForegroundColor Cyan
    Take-OwnershipAndGrant -Path $targetPath
    Copy-Item -Path $backupPath -Destination $targetPath -Force
    Write-Host "Готово. Оригинал '$TargetName' возвращён в System32." -ForegroundColor Green
    Write-Host "Рекомендуется перезагрузить компьютер." -ForegroundColor Yellow
    return
}

# ----------------------- РЕЖИМ ЗАМЕНЫ -----------------------
if (-not $SourceFile) {
    throw "Укажите путь к вашему файлу: параметр -SourceFile 'C:\путь\к\вашему\$TargetName'"
}
if (-not (Test-Path $SourceFile)) {
    throw "Ваш файл не найден: $SourceFile"
}
if (-not (Test-Path $targetPath)) {
    throw "Системный файл не найден: $targetPath. Проверьте имя (-TargetName)."
}

# 1. Резервная копия оригинала (с датой, чтобы не затереть прошлый бэкап)
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$datedBackup = Join-Path $BackupDir ("{0}.{1}.bak" -f $TargetName, $stamp)

Copy-Item -Path $targetPath -Destination $datedBackup -Force
# "Главная" резервная копия для быстрого отката (-Restore)
if (-not (Test-Path $backupPath)) {
    Copy-Item -Path $targetPath -Destination $backupPath -Force
}
Write-Host "Резервная копия сохранена:" -ForegroundColor Cyan
Write-Host "  $datedBackup"
Write-Host "  $backupPath  (используется для отката -Restore)"

# 2. Права на системный файл
Write-Host "Забираю права на '$TargetName'..." -ForegroundColor Cyan
Take-OwnershipAndGrant -Path $targetPath

# 3. Замена
Write-Host "Заменяю '$TargetName' на ваш файл..." -ForegroundColor Cyan
Copy-Item -Path $SourceFile -Destination $targetPath -Force

Write-Host ""
Write-Host "Готово. Файл заменён." -ForegroundColor Green
Write-Host "Перезагрузите компьютер, затем проверьте программу 'Фаворит'." -ForegroundColor Yellow
Write-Host ""
Write-Host "Если что-то работает неправильно — откат:" -ForegroundColor Yellow
Write-Host "  .\Replace-System32-File.ps1 -TargetName '$TargetName' -Restore"
