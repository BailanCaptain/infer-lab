param(
  [Parameter(Mandatory=$true)][string]$Config,
  [string]$At = '03:00',
  [switch]$Install,
  [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskConfig = (Resolve-Path -LiteralPath $Config).Path
$taskName = 'LLM-Wiki-' + (Split-Path -Leaf $taskRoot)
if ($At -notmatch '^([01][0-9]|2[0-3]):[0-5][0-9]$') { throw 'At must be HH:mm' }
if ($Install -and $Remove) { throw 'Choose Install or Remove' }
if ($Remove) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false; exit }
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskScript = Join-Path $PSScriptRoot 'wiki-sync.ts'
if ($taskConfig.Contains('"') -or $taskScript.Contains('"')) { throw 'Invalid path quoting' }
$taskArgs = '--import tsx "' + $taskScript + '" --config "' + $taskConfig + '"'
if (-not $Install) { [pscustomobject]@{Name=$taskName; Execute=$taskNode; Arguments=$taskArgs; WorkingDirectory=$taskRoot; DailyAt=$At; Installed=$false} | ConvertTo-Json; exit }
$taskAction = New-ScheduledTaskAction -Execute $taskNode -Argument $taskArgs -WorkingDirectory $taskRoot
$taskTrigger = New-ScheduledTaskTrigger -Daily -At $At
$taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description 'Shared LLM Wiki incremental maintenance; budget and initial-import guards are enforced by wiki:sync.' -Force | Select-Object TaskName, State
