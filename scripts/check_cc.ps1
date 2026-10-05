$sh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "cc.lnk"
if (Test-Path $shortcutPath) {
    $s = $sh.CreateShortcut($shortcutPath)
    Write-Host "Target: $($s.TargetPath)"
    Write-Host "Args: $($s.Arguments)"
    Write-Host "WorkDir: $($s.WorkingDirectory)"
} else {
    Write-Host "cc.lnk not found on Desktop"
}
