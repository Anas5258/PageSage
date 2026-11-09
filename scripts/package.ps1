# Builds dist/pagesage-<version>.zip from src/ with manifest.json at the zip root.
# Uses forward-slash entry names, which Firefox and addons.mozilla.org require.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$src = Join-Path $root 'src'
$version = (Get-Content (Join-Path $src 'manifest.json') -Raw | ConvertFrom-Json).version
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$out = Join-Path $dist "pagesage-$version.zip"
if (Test-Path $out) { Remove-Item $out }

$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')
try {
  Get-ChildItem $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, 'Optimal')
  }
} finally {
  $zip.Dispose()
}
Write-Host "Built $out"
