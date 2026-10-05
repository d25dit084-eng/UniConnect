$localStatePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Local State"
if (Test-Path $localStatePath) {
    $json = Get-Content -Raw $localStatePath | ConvertFrom-Json
    $profiles = $json.profile.info_cache
    foreach ($prop in $profiles.PSObject.Properties) {
        $p = $prop.Value
        Write-Host "Profile Directory: $($prop.Name)"
        Write-Host "  Name: $($p.name)"
        Write-Host "  Email: $($p.user_name)"
        Write-Host "  Hosted Domain: $($p.hosted_domain)"
        Write-Host "--------------------------------"
    }
}
