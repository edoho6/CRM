# An old .ppt saved as .pptx by PowerPoint itself.
#   powershell -File ppt-convert.ps1 <in.ppt> <out.pptx>
param([string]$InputPath, [string]$OutputPath)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
try {
  # Open(FileName, ReadOnly, Untitled, WithWindow): msoTrue = -1, msoFalse = 0
  $pres = $app.Presentations.Open($InputPath, -1, 0, 0)
  $pres.SaveAs($OutputPath, 24)
  $pres.Close()
  'ok'
} finally {
  $app.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}
