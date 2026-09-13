# A .doc saved as .docx by Word itself, for the library loader (word.mjs).
#   powershell -File word-convert.ps1 <in.doc> <out.docx>
# Word is started hidden with its alerts off, opens the file with one
# argument (PowerShell cannot hand Word's COM the optional booleans), saves
# it as Word 2007+ XML (format 12), and quits.
param([string]$InputPath, [string]$OutputPath)
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $word.Options.ConfirmConversions = $false
  $doc = $word.Documents.Open($InputPath)
  $doc.SaveAs2($OutputPath, 12)
  $doc.Close(0)
  'ok'
} finally {
  $word.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
